import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { defer, type AppEnv, type Ctx } from "../context";
import type { Db } from "../db/client";
import { accountMembers, accounts, invites, users } from "../db/schema";
import { ApiError, notFound } from "../errors";
import { emailSchema, param, parseWith, readJson, uuidSchema } from "../http";
import { currentUser, requireVerifiedUser } from "../auth/access";
import { randomToken, sha256Hex } from "../auth/crypto";
import { duoInviteMessage, inviteAcceptedMessage } from "../email/templates";
import { notify } from "../domain/notify";
import { findOpenDuoAccount, listAccountsFor, revokePendingInvites } from "../domain/users";
import { clientIp, enforce } from "../rate-limit";

const INVITE_LIMIT_MESSAGE = "Muitos convites enviados. Espere um pouco antes de enviar outro.";

/** Cada envio de convite (novo ou reenvio) conta na conta e no IP. */
async function limitInviteSends(c: Ctx, accountId: string) {
  await enforce(c, "invitePerIp", clientIp(c), INVITE_LIMIT_MESSAGE);
  await enforce(c, "invitePerAccount", accountId, INVITE_LIMIT_MESSAGE);
}

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESEND_SECONDS = 42;

const createSchema = z.object({ email: emailSchema, message: z.string().trim().max(280).nullable().optional() });
const respondSchema = z.union([z.object({ token: z.string().min(10).max(100) }), z.object({ inviteId: uuidSchema })]);

type InviteRow = typeof invites.$inferSelect;

const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
};

const toDto = (i: InviteRow) => ({
  id: i.id, email: i.email, message: i.message, status: i.status, expired: i.status === "pending" && i.expiresAt < new Date(),
  expiresAt: i.expiresAt.toISOString(), lastSentAt: i.lastSentAt.toISOString(), createdAt: i.createdAt.toISOString(),
});

const inviteUrl = (appUrl: string, token: string) => `${appUrl}/acesso/duo-convite?token=${encodeURIComponent(token)}`;

async function memberCount(db: Db, accountId: string) {
  const [{ n }] = await db.select({ n: count() }).from(accountMembers).where(eq(accountMembers.accountId, accountId));
  return n;
}

/** Rotas sob /accounts/:accountId/invites (dono ou membro da conta Duo). */
export const accountInviteRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { account } = c.get("access");
    const rows = await c.get("db").select().from(invites).where(eq(invites.accountId, account.id)).orderBy(desc(invites.createdAt)).limit(10);
    return c.json({ invites: rows.map(toDto) });
  })

  .post("/", async (c) => {
    const body = await readJson(c, createSchema);
    const { account, me, members } = c.get("access");
    if (account.kind !== "duo") throw new ApiError("conflict", "Convites só existem na conta Duo.");
    if (members.length >= 2) throw new ApiError("conflict", "Esta conta Duo já tem duas pessoas.");
    if (body.email === me.email) {
      throw new ApiError("validation_failed", "Esse é o seu próprio e-mail. Use o e-mail do(a) parceiro(a).", { fields: { email: "Esse é o seu próprio e-mail. Use o e-mail do(a) parceiro(a)." } });
    }
    await limitInviteSends(c, account.id);
    const db = c.get("db");
    const token = randomToken();
    const invite = await db.transaction(async (tx) => {
      // um convite pendente por vez: um novo substitui o anterior
      await revokePendingInvites(tx, account.id);
      const [row] = await tx.insert(invites).values({
        accountId: account.id, inviterId: me.userId, email: body.email, message: body.message || null,
        tokenHash: await sha256Hex(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      }).returning();
      // se a pessoa já tem conta, o convite também aparece no sino dela
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
      if (existing) {
        await notify(tx, [{
          userId: existing.id, accountId: null, kind: "invite",
          title: `${me.name || "Alguém"} convidou você para uma conta Duo`,
          body: "Vocês passam a dividir despesas e metas. O que você já registrou continua privado.",
          data: { inviteId: row.id }, dedupeKey: `invite:${row.id}`,
        }]);
      }
      return row;
    });
    defer(c, c.get("mailer").send({ to: body.email, ...duoInviteMessage(me.name, invite.message, inviteUrl(c.env.APP_URL, token)), idempotencyKey: `invite-${invite.id}` }));
    return c.json({ invite: toDto(invite) }, 201);
  })

  /** Reenvia com link novo e validade renovada (o token antigo deixa de valer). */
  .post("/:inviteId/resend", async (c) => {
    const inviteId = param(c, "inviteId");
    const { account, me } = c.get("access");
    const db = c.get("db");
    const [invite] = await db.select().from(invites).where(and(eq(invites.id, inviteId), eq(invites.accountId, account.id)));
    if (!invite) throw notFound("Convite");
    if (invite.status !== "pending") throw new ApiError("conflict", "Este convite já foi respondido ou cancelado.");
    const wait = Math.ceil(RESEND_SECONDS - (Date.now() - invite.lastSentAt.getTime()) / 1000);
    if (wait > 0) throw new ApiError("too_many_requests", `Espere ${wait}s para reenviar.`, { retryAfter: wait });
    await limitInviteSends(c, account.id);
    const token = randomToken();
    const [row] = await db.update(invites).set({
      tokenHash: await sha256Hex(token), lastSentAt: new Date(), expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    }).where(eq(invites.id, invite.id)).returning();
    defer(c, c.get("mailer").send({ to: row.email, ...duoInviteMessage(me.name, row.message, inviteUrl(c.env.APP_URL, token)) }));
    return c.json({ invite: toDto(row) });
  })

  .delete("/:inviteId", async (c) => {
    const inviteId = param(c, "inviteId");
    const { account } = c.get("access");
    const [row] = await c.get("db").update(invites).set({ status: "revoked", respondedAt: new Date() })
      .where(and(eq(invites.id, inviteId), eq(invites.accountId, account.id), eq(invites.status, "pending"))).returning({ id: invites.id });
    if (!row) throw notFound("Convite");
    return c.body(null, 204);
  });

async function findInvite(db: Db, ref: z.infer<typeof respondSchema>) {
  const where = "token" in ref ? eq(invites.tokenHash, await sha256Hex(ref.token)) : eq(invites.id, ref.inviteId);
  const [row] = await db.select({ invite: invites, inviterName: users.name, inviterEmail: users.email })
    .from(invites).innerJoin(users, eq(users.id, invites.inviterId)).where(where).limit(1);
  return row ?? null;
}

function assertOpen(invite: InviteRow) {
  if (invite.status === "accepted") throw new ApiError("conflict", "Este convite já foi aceito.");
  if (invite.status !== "pending") throw new ApiError("gone", "Este convite foi cancelado ou recusado.");
  if (invite.expiresAt < new Date()) throw new ApiError("gone", "Este convite expirou. Peça um novo para quem convidou você.");
}

/** Rotas globais de convite (quem recebe). */
export const inviteRoutes = new Hono<AppEnv>()
  /** Prévia pública pelo token do e-mail (para a tela de convite antes do login). */
  .get("/preview", async (c) => {
    const { token } = parseWith(z.object({ token: z.string().min(10).max(100) }), c.req.query());
    const found = await findInvite(c.get("db"), { token });
    if (!found) throw notFound("Convite");
    const { invite, inviterName } = found;
    return c.json({
      inviterName, emailMasked: maskEmail(invite.email), message: invite.message, status: invite.status,
      expired: invite.expiresAt < new Date(), expiresAt: invite.expiresAt.toISOString(),
    });
  })

  .post("/accept", requireVerifiedUser, async (c) => {
    const ref = await readJson(c, respondSchema);
    const user = currentUser(c);
    const db = c.get("db");
    const found = await findInvite(db, ref);
    if (!found) throw notFound("Convite");
    const { invite } = found;
    assertOpen(invite);
    // o convite vale para o e-mail convidado (link encaminhado não dá acesso à conta do casal)
    if (invite.email !== user.email) throw new ApiError("forbidden", "Este convite foi enviado para outro e-mail. Entre com a conta desse e-mail para aceitar.");
    // Duo própria ainda sem par (ex.: escolheu Duo no onboarding e depois recebeu
    // o convite) não impede o aceite: ela é encerrada no lugar. Com par, impede.
    const openDuo = await findOpenDuoAccount(db, user.id);
    if (openDuo && (openDuo === invite.accountId || (await memberCount(db, openDuo)) > 1)) {
      throw new ApiError("conflict", "Você já participa de uma conta Duo. Desvincule-a antes de aceitar outro convite.");
    }

    await db.transaction(async (tx) => {
      // marca o convite primeiro: dois aceites simultâneos não passam os dois
      const [claimed] = await tx.update(invites).set({ status: "accepted", respondedAt: new Date(), acceptedBy: user.id })
        .where(and(eq(invites.id, invite.id), eq(invites.status, "pending"))).returning({ id: invites.id });
      if (!claimed) throw new ApiError("conflict", "Este convite já foi respondido.");
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, invite.accountId));
      if (!account || account.closedAt) throw new ApiError("gone", "A conta Duo deste convite foi encerrada.");
      if ((await memberCount(tx, invite.accountId)) >= 2) throw new ApiError("conflict", "Esta conta Duo já tem duas pessoas.");
      if (openDuo) {
        await tx.update(accounts).set({ closedAt: new Date() }).where(eq(accounts.id, openDuo));
        await revokePendingInvites(tx, openDuo);
      }
      await tx.insert(accountMembers).values({ accountId: invite.accountId, userId: user.id, role: "partner" });
      await tx.update(users).set({ plan: "duo", updatedAt: new Date() }).where(eq(users.id, user.id));
      await notify(tx, [{
        userId: invite.inviterId, accountId: invite.accountId, kind: "invite_accepted",
        title: `${user.name || user.email} aceitou o convite`,
        body: "A conta Duo está ativa. O que cada um marcar como compartilhado aparece no painel do casal.",
        dedupeKey: `invite-accepted:${invite.id}`,
      }]);
    });
    defer(c, c.get("mailer").send({ to: found.inviterEmail, ...inviteAcceptedMessage(user.name, `${c.env.APP_URL}/duo`) }));
    return c.json({ accountId: invite.accountId, accounts: await listAccountsFor(db, user.id) });
  })

  .post("/decline", requireVerifiedUser, async (c) => {
    const ref = await readJson(c, respondSchema);
    const user = currentUser(c);
    const db = c.get("db");
    const found = await findInvite(db, ref);
    if (!found) throw notFound("Convite");
    const { invite } = found;
    assertOpen(invite);
    if (invite.email !== user.email) throw new ApiError("forbidden", "Este convite foi enviado para outro e-mail.");
    await db.update(invites).set({ status: "declined", respondedAt: new Date() }).where(eq(invites.id, invite.id));
    await notify(db, [{
      userId: invite.inviterId, accountId: invite.accountId, kind: "invite_declined",
      title: `${user.name || user.email} recusou o convite`, body: "Você pode enviar um novo convite quando quiser.",
      dedupeKey: `invite-declined:${invite.id}`,
    }]);
    return c.body(null, 204);
  });
