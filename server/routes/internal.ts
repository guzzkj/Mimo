import { and, asc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import { defer, type AppEnv } from "../context";
import { accountMembers, accounts, transactions, users } from "../db/schema";
import { ApiError } from "../errors";
import { addDaysIso, todayIso } from "../http";
import { timingSafeEqual } from "../auth/crypto";
import { resolveMemberPrefs } from "../domain/settings";
import { isHiddenFrom } from "../domain/transactions";
import { notify } from "../domain/notify";
import { billsDueMessage } from "../email/templates";
import { pruneRateLimits } from "../rate-limit";

// Endpoints chamados por um agendador externo (Pages Functions não têm Cron
// Triggers). Protegidos por "Authorization: Bearer <CRON_SECRET>".

const encoder = new TextEncoder();

export const internalRoutes = new Hono<AppEnv>()
  .use("*", async (c, next) => {
    const secret = c.env.CRON_SECRET;
    const given = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!secret || !timingSafeEqual(encoder.encode(given), encoder.encode(secret))) throw new ApiError("not_found", "Recurso não encontrado.");
    await next();
  })

  /** Lembrete diário por e-mail das contas a pagar que vencem nos próximos dias (respeita as preferências). */
  .post("/reminders", async (c) => {
    const db = c.get("db");
    // faxina diária: contadores de rate limit vencidos
    await pruneRateLimits(db);
    const today = todayIso();
    const members = await db
      .select({ accountId: accountMembers.accountId, userId: accountMembers.userId, prefs: accountMembers.prefs, email: users.email })
      .from(accountMembers)
      .innerJoin(users, eq(users.id, accountMembers.userId))
      .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
      .where(and(isNull(accounts.closedAt), isNotNull(users.emailVerifiedAt)))
      .limit(2000);
    const wanted = members
      .map((m) => ({ ...m, prefs: resolveMemberPrefs(m.prefs) }))
      .filter((m) => m.prefs.alerts.bills && m.prefs.alerts.email);
    if (!wanted.length) return c.json({ sent: 0 });

    const bills = await db.select().from(transactions)
      .where(and(
        eq(transactions.type, "expense"), eq(transactions.status, "pending"),
        gte(transactions.occurredOn, today), lte(transactions.occurredOn, addDaysIso(today, 30)),
      ))
      .orderBy(asc(transactions.occurredOn));

    let sent = 0;
    for (const m of wanted) {
      const limit = addDaysIso(today, m.prefs.alerts.billsDaysAhead);
      const due = bills.filter((b) => b.accountId === m.accountId && b.occurredOn <= limit && !isHiddenFrom(b, m.userId));
      if (!due.length) continue;
      const created = await notify(db, [{
        userId: m.userId, accountId: m.accountId, kind: "bills",
        title: due.length === 1 ? `${due[0].description} vence em breve` : `${due.length} contas vencem em breve`,
        body: due.map((b) => b.description).join(", "),
        dedupeKey: `bills:${m.accountId}:${today}`,
      }]);
      if (!created.length) continue; // já avisado hoje
      const message = billsDueMessage(due.map((b) => ({ description: b.description, amountCents: b.amountCents, dueOn: b.occurredOn })), `${c.env.APP_URL}/`);
      defer(c, c.get("mailer").send({ to: m.email, ...message, idempotencyKey: `bills-${m.accountId}-${m.userId}-${today}` }));
      sent++;
    }
    return c.json({ sent });
  });
