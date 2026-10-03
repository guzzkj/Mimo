import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv, Ctx } from "../context";
import { accountMembers, accounts, notifications, users } from "../db/schema";
import { readJson } from "../http";
import { currentUser, requireVerifiedUser } from "../auth/access";
import { listAccountsFor, revokePendingInvites } from "../domain/users";
import { resolveAccountSettings, settingsPatchSchema } from "../domain/settings";
import { ApiError } from "../errors";

function settingsDto(c: Ctx) {
  const { account, me, partner } = c.get("access");
  return {
    accountId: account.id,
    kind: account.kind,
    closed: Boolean(account.closedAt),
    ...resolveAccountSettings(account.kind, account.settings),
    alerts: me.prefs.alerts,
    startHidden: me.prefs.startHidden,
    me: { userId: me.userId, name: me.name, email: me.email, avatar: me.avatar, monthlyIncomeCents: me.monthlyIncomeCents },
    partner: partner ? { userId: partner.userId, name: partner.name, avatar: partner.avatar, monthlyIncomeCents: partner.monthlyIncomeCents } : null,
  };
}

/** Rotas que não dependem de uma conta específica. */
export const accountListRoutes = new Hono<AppEnv>()
  .get("/", requireVerifiedUser, async (c) => c.json({ accounts: await listAccountsFor(c.get("db"), currentUser(c).id) }));

/** Rotas sob /accounts/:accountId (o middleware de acesso já validou a participação). */
export const accountRoutes = new Hono<AppEnv>()
  .get("/settings", (c) => c.json(settingsDto(c)))

  .patch("/settings", async (c) => {
    const patch = await readJson(c, settingsPatchSchema);
    const access = c.get("access");
    const db = c.get("db");
    const { alerts, startHidden, card, ...accountPatch } = patch;

    // ajustes da conta (compartilhados no Duo)
    if (Object.keys(accountPatch).length || card) {
      const current = resolveAccountSettings(access.account.kind, access.account.settings);
      const next = { ...current, ...accountPatch, card: { ...current.card, ...(card ?? {}) } };
      const [row] = await db.update(accounts).set({ settings: next }).where(eq(accounts.id, access.account.id)).returning();
      access.account = row;
    }
    // preferências pessoais nesta conta
    if (alerts || startHidden !== undefined) {
      const prefs = {
        alerts: { ...access.me.prefs.alerts, ...(alerts ?? {}) },
        startHidden: startHidden ?? access.me.prefs.startHidden,
      };
      await db.update(accountMembers).set({ prefs })
        .where(and(eq(accountMembers.accountId, access.account.id), eq(accountMembers.userId, access.me.userId)));
      access.me = { ...access.me, prefs };
    }
    return c.json(settingsDto(c));
  })

  /**
   * Desfaz a conta Duo: ela fica encerrada (só leitura, histórico dos dois) e
   * cada um volta para a própria conta Solo. O par recebe um aviso.
   */
  .post("/unlink", async (c) => {
    const { account, me, partner } = c.get("access");
    if (account.kind !== "duo") throw new ApiError("conflict", "Só contas Duo podem ser desvinculadas.");
    const db = c.get("db");
    await db.transaction(async (tx) => {
      await tx.update(accounts).set({ closedAt: new Date() }).where(eq(accounts.id, account.id));
      // convite ainda pendente para a conta encerrada não pode mais ser aceito
      await revokePendingInvites(tx, account.id);
      await tx.update(users).set({ plan: "solo", updatedAt: new Date() }).where(eq(users.id, me.userId));
      if (partner) {
        await tx.update(users).set({ plan: "solo", updatedAt: new Date() }).where(eq(users.id, partner.userId));
        await tx.insert(notifications).values({
          userId: partner.userId, accountId: account.id, kind: "partner",
          title: `${me.name || "Seu par"} desvinculou a conta Duo`,
          body: "Cada um voltou para a própria conta Solo. O histórico do casal continua disponível para consulta.",
          dedupeKey: `unlink:${account.id}`,
        }).onConflictDoNothing();
      }
    });
    return c.json({ accounts: await listAccountsFor(db, me.userId) });
  });
