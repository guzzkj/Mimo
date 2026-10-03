import { and, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { accountMembers, accounts, invites, transactions, users } from "../db/schema";
import { ApiError } from "../errors";
import { readJson } from "../http";
import { currentUser, requireUser, requireVerifiedUser } from "../auth/access";
import { clearSessionCookie } from "../auth/cookies";
import { verifyPassword } from "../auth/crypto";
import { ensureOpenDuoAccount, listAccountsFor, toUserDto } from "../domain/users";

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

  /** Passos 1 e 2 do onboarding: plano, nome e renda. No Duo, abre a conta do casal. */
  .post("/onboarding", requireVerifiedUser, async (c) => {
    const body = await readJson(c, onboardingSchema);
    const user = currentUser(c);
    const db = c.get("db");
    if (body.plan === "duo") await ensureOpenDuoAccount(db, user.id);
    const [updated] = await db.update(users).set({
      plan: body.plan, name: body.name, monthlyIncomeCents: body.monthlyIncomeCents,
      onboardedAt: sql`coalesce(${users.onboardedAt}, now())`, updatedAt: new Date(),
    }).where(eq(users.id, user.id)).returning();
    return c.json({ user: toUserDto(updated), accounts: await listAccountsFor(db, user.id) });
  })

  /** Troca o plano em uso (ex.: voltar para o Solo enquanto o convite não é aceito). */
  .post("/plan", requireVerifiedUser, async (c) => {
    const { plan } = await readJson(c, z.object({ plan: z.enum(["solo", "duo"]) }));
    const user = currentUser(c);
    const db = c.get("db");
    if (plan === "duo") await ensureOpenDuoAccount(db, user.id);
    const [u] = await db.update(users).set({ plan, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    return c.json({ user: toUserDto(u), accounts: await listAccountsFor(db, user.id) });
  })

  /**
   * Exclusão da conta (LGPD). Apaga a pessoa e as contas em que ela é a única
   * participante. Numa conta Duo com par, a conta continua para o par, sem
   * os dados pessoais dela (autor vira nulo pelas FKs "set null").
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
        const shared = await tx.select({ accountId: accountMembers.accountId }).from(accountMembers)
          .where(and(inArray(accountMembers.accountId, ids), ne(accountMembers.userId, user.id)));
        const sharedIds = new Set(shared.map((s) => s.accountId));
        const solo = ids.filter((id) => !sharedIds.has(id));
        if (solo.length) await tx.delete(accounts).where(inArray(accounts.id, solo));
        // lançamentos privados nunca podem "virar" da conta conjunta quando o autor some
        if (sharedIds.size) {
          await tx.delete(transactions).where(and(
            inArray(transactions.accountId, [...sharedIds]), eq(transactions.authorUserId, user.id), eq(transactions.isPrivate, true),
          ));
        }
      }
      await tx.delete(users).where(eq(users.id, user.id));
    });
    clearSessionCookie(c);
    return c.body(null, 204);
  });
