import { and, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Ctx } from "../context";
import { accountMembers, accounts, invites, transactions, users } from "../db/schema";
import { ApiError } from "../errors";
import { readJson } from "../http";
import { currentUser, requireUser, requireVerifiedUser } from "../auth/access";
import { clearSessionCookie } from "../auth/cookies";
import { verifyPassword } from "../auth/crypto";
import { ensureOpenDuoAccount, findLinkedDuoAccount, listAccountsFor, revokePendingInvites, toUserDto } from "../domain/users";
import { notify } from "../domain/notify";
import { findOpenSoloAccount, importSoloHistory, soloHistoryStatus } from "../domain/solo-history";
import { recordAudit } from "../domain/audit";
import { CONSENT_PURPOSES, consentUpdateSchema, listConsents, setConsent } from "../domain/consent";
import { exportUserData } from "../domain/export";
import { PRIVACY_VERSION } from "../legal";
import { clientIp } from "../rate-limit";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Como podemos te chamar?").max(60).optional(),
  avatar: z.number().int().min(0).max(31).optional(),
  monthlyIncomeCents: z.number().int().min(0).max(1_000_000_000_00).optional(),
}).strict();

const onboardingSchema = z.object({
  plan: z.enum(["solo", "duo"]),
  name: z.string().trim().min(1, "Como podemos te chamar?").max(60),
  monthlyIncomeCents: z.number().int().min(1, "Informe um valor aproximado. Pode ser redondo.").max(1_000_000_000_00),
});

const deleteSchema = z.object({ password: z.string().min(1).max(128) });

/** Convites pendentes enviados para o e-mail da pessoa (aparecem no onboarding e no sino). */
async function pendingInvitesFor(db: AppEnv["Variables"]["db"], email: string) {
  return db.select({ id: invites.id, accountId: invites.accountId, inviterName: users.name, message: invites.message, expiresAt: invites.expiresAt })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.inviterId))
    .where(and(eq(invites.email, email), eq(invites.status, "pending"), gt(invites.expiresAt, new Date())));
}

/** Conta Solo guardada e Duo vinculada da pessoa (o histórico só faz sentido no Duo). */
async function soloAndDuo(c: Ctx) {
  const user = currentUser(c);
  const db = c.get("db");
  const [soloId, duoId] = await Promise.all([findOpenSoloAccount(db, user.id), findLinkedDuoAccount(db, user.id)]);
  if (!duoId) throw new ApiError("conflict", "Isso só vale para quem está numa conta Duo com o par vinculado.");
  if (!soloId) throw new ApiError("not_found", "Conta Solo não encontrada.");
  return { soloId, duoId };
}

export const meRoutes = new Hono<AppEnv>()
  .get("/", requireUser, async (c) => {
    const user = currentUser(c);
    const db = c.get("db");
    const [accountList, pending] = await Promise.all([listAccountsFor(db, user.id), pendingInvitesFor(db, user.email)]);
    return c.json({
      user: toUserDto(user),
      accounts: accountList,
      pendingInvites: pending.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })),
    });
  })

  .patch("/", requireVerifiedUser, async (c) => {
    const body = await readJson(c, profileSchema);
    const user = currentUser(c);
    if (!Object.keys(body).length) return c.json({ user: toUserDto(user) });
    const [updated] = await c.get("db").update(users).set({ ...body, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    return c.json({ user: toUserDto(updated) });
  })

  /**
   * Passos 1 e 2 do onboarding: plano, nome e renda. No Duo, abre a conta do
   * casal, mas a pessoa só passa para a visão Duo quando o par aceitar o convite.
   */
  .post("/onboarding", requireVerifiedUser, async (c) => {
    const body = await readJson(c, onboardingSchema);
    const user = currentUser(c);
    const db = c.get("db");
    if (body.plan === "duo") await ensureOpenDuoAccount(db, user.id);
    const plan = (await findLinkedDuoAccount(db, user.id)) ? "duo" : "solo";
    const [updated] = await db.update(users).set({
      plan, name: body.name, monthlyIncomeCents: body.monthlyIncomeCents,
      onboardedAt: sql`coalesce(${users.onboardedAt}, now())`, updatedAt: new Date(),
    }).where(eq(users.id, user.id)).returning();
    return c.json({ user: toUserDto(updated), accounts: await listAccountsFor(db, user.id) });
  })

  /**
   * Pede o plano. "duo" abre a conta do casal (para convidar), mas a visão Duo
   * só vale com o par vinculado. Com par vinculado não dá para voltar ao Solo:
   * o caminho é desvincular a conta Duo.
   */
  .post("/plan", requireVerifiedUser, async (c) => {
    const { plan: wanted } = await readJson(c, z.object({ plan: z.enum(["solo", "duo"]) }));
    const user = currentUser(c);
    const db = c.get("db");
    if (wanted === "duo") await ensureOpenDuoAccount(db, user.id);
    const linked = Boolean(await findLinkedDuoAccount(db, user.id));
    if (wanted === "solo" && linked) throw new ApiError("conflict", "Você está numa conta Duo. Para voltar ao Solo, desvincule a conta Duo em Configurações.");
    const plan = linked ? "duo" : "solo";
    const [u] = await db.update(users).set({ plan, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    return c.json({ user: toUserDto(u), accounts: await listAccountsFor(db, user.id) });
  })

  /** Histórico do Solo de quem está numa Duo: quanto existe e quanto ainda não foi trazido. */
  .get("/solo-history", requireVerifiedUser, async (c) => {
    const { soloId, duoId } = await soloAndDuo(c);
    return c.json({ soloAccountId: soloId, ...(await soloHistoryStatus(c.get("db"), soloId, duoId)) });
  })

  /** Traz o histórico do Solo para a Duo como lançamentos privados (só o que falta). */
  .post("/solo-history/import", requireVerifiedUser, async (c) => {
    const { soloId, duoId } = await soloAndDuo(c);
    const db = c.get("db");
    const imported = await importSoloHistory(db, currentUser(c).id, soloId, duoId);
    return c.json({ imported, ...(await soloHistoryStatus(db, soloId, duoId)) });
  })

  /** Consentimentos opcionais atuais (LGPD art. 8º). */
  .get("/consents", requireUser, async (c) => {
    const user = currentUser(c);
    return c.json({ consents: await listConsents(c.get("db"), user.id) });
  })

  /** Concede ou revoga consentimentos opcionais (LGPD art. 18, IX). */
  .put("/consents", requireUser, async (c) => {
    const body = await readJson(c, consentUpdateSchema);
    const user = currentUser(c);
    const db = c.get("db");
    for (const purpose of CONSENT_PURPOSES) {
      const value = body[purpose];
      if (value === undefined) continue;
      await setConsent(db, user.id, purpose, value, PRIVACY_VERSION);
      await recordAudit(db, { userId: user.id, action: "consent_updated", ip: clientIp(c), metadata: { purpose, granted: value } });
    }
    return c.json({ consents: await listConsents(db, user.id) });
  })

  /** Exportação dos dados pessoais em JSON (LGPD art. 18, V — portabilidade/acesso). */
  .get("/export", requireUser, async (c) => {
    const user = currentUser(c);
    const db = c.get("db");
    const data = await exportUserData(db, user.id);
    if (!data) throw new ApiError("not_found", "Conta não encontrada.");
    await recordAudit(db, { userId: user.id, action: "data_exported", ip: clientIp(c) });
    c.header("Content-Disposition", `attachment; filename="mimo-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`);
    return c.json(data);
  })

  /**
   * Exclusão da conta (LGPD). Apaga a pessoa e as contas em que ela é a única
   * participante. Numa conta Duo com par, a conta é desvinculada como no
   * "desvincular": fica encerrada (histórico só leitura, sem os dados pessoais
   * dela, autor vira nulo pelas FKs "set null") e o par volta para o Solo.
   */
  .delete("/", requireUser, async (c) => {
    const { password } = await readJson(c, deleteSchema);
    const user = currentUser(c);
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError("validation_failed", "A senha não confere.", { fields: { password: "A senha não confere." } });
    }
    const db = c.get("db");
    await db.transaction(async (tx) => {
      const mine = await tx.select({ accountId: accountMembers.accountId }).from(accountMembers).where(eq(accountMembers.userId, user.id));
      const ids = mine.map((m) => m.accountId);
      if (ids.length) {
        const shared = await tx.select({ accountId: accountMembers.accountId, userId: accountMembers.userId }).from(accountMembers)
          .where(and(inArray(accountMembers.accountId, ids), ne(accountMembers.userId, user.id)));
        const sharedIds = new Set(shared.map((s) => s.accountId));
        const solo = ids.filter((id) => !sharedIds.has(id));
        if (solo.length) await tx.delete(accounts).where(inArray(accounts.id, solo));
        // lançamentos privados nunca podem "virar" da conta conjunta quando o autor some
        if (sharedIds.size) {
          await tx.delete(transactions).where(and(
            inArray(transactions.accountId, [...sharedIds]), eq(transactions.authorUserId, user.id), eq(transactions.isPrivate, true),
          ));
          // Duo sem uma das pessoas não é mais Duo: encerra e devolve o par ao Solo
          const partners = shared.map((s) => s.userId);
          await tx.update(accounts).set({ closedAt: new Date() }).where(and(inArray(accounts.id, [...sharedIds]), isNull(accounts.closedAt)));
          for (const id of sharedIds) await revokePendingInvites(tx, id);
          await tx.update(users).set({ plan: "solo", updatedAt: new Date() }).where(inArray(users.id, partners));
          await notify(tx, shared.map((s) => ({
            userId: s.userId, accountId: s.accountId, kind: "partner" as const,
            title: `${user.name || "Seu par"} excluiu a conta no Mimo`,
            body: "A conta Duo foi encerrada e você voltou para a sua conta Solo. O histórico do casal continua disponível para consulta.",
            dedupeKey: `partner-deleted:${s.accountId}`,
          })));
        }
      }
      // registra antes de apagar: o FK (set null) preserva o registro de auditoria
      await recordAudit(tx, { userId: user.id, action: "account_deleted", ip: clientIp(c) });
      await tx.delete(users).where(eq(users.id, user.id));
    });
    clearSessionCookie(c);
    return c.body(null, 204);
  });
