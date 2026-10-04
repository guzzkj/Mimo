import { and, asc, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { defer, type AppEnv } from "../context";
import { accountMembers, accounts, transactions, users } from "../db/schema";
import { ApiError } from "../errors";
import { addDaysIso, todayIso } from "../http";

const quotesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(40),
  freshMinutes: z.coerce.number().int().min(0).max(24 * 60).default(30),
});
import { timingSafeEqual } from "../auth/crypto";
import { resolveMemberPrefs } from "../domain/settings";
import { isHiddenFrom } from "../domain/transactions";
import { notify } from "../domain/notify";
import { pruneExpiredData } from "../domain/retention";
import { billsDueMessage } from "../email/templates";
import { pruneRateLimits } from "../rate-limit";
import { syncDailyCloses, syncQuotes } from "../market/sync";

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
    // faxina diária: contadores de rate limit vencidos + retenção (LGPD art. 15/16)
    await pruneRateLimits(db);
    await pruneExpiredData(db);
    const today = todayIso();
    const members = await db
      .select({ accountId: accountMembers.accountId, userId: accountMembers.userId, prefs: accountMembers.prefs, email: users.email, kind: accounts.kind })
      .from(accountMembers)
      .innerJoin(users, eq(users.id, accountMembers.userId))
      .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
      // quem está no Duo só vê a conta do casal: a Solo fica parada e não gera aviso
      .where(and(isNull(accounts.closedAt), isNotNull(users.emailVerifiedAt), or(eq(accounts.kind, "duo"), sql`${users.plan} is distinct from 'duo'`)))
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
      const message = billsDueMessage(due.map((b) => ({ description: b.description, amountCents: b.amountCents, dueOn: b.occurredOn })), `${c.env.APP_URL}${m.kind === "duo" ? "/duo" : "/"}`);
      defer(c, c.get("mailer").send({ to: m.email, ...message, idempotencyKey: `bills-${m.accountId}-${m.userId}-${today}` }));
      sent++;
    }
    return c.json({ sent });
  })

  /**
   * Cotação + histórico + proventos (Yahoo) de um lote de tickers em carteira.
   * Lote pequeno por causa do teto de subrequests do Workers: o cron repete a
   * chamada enquanto `remaining` > 0.
   */
  .post("/market/quotes", async (c) => {
    const query = quotesQuery.safeParse(c.req.query());
    if (!query.success) throw new ApiError("validation_failed", "Parâmetros inválidos.");
    return c.json(await syncQuotes(c.get("db"), c.get("fetch"), query.data));
  })

  /** Fechamento oficial do último pregão (arquivo COTAHIST da B3). */
  .post("/market/eod", async (c) => c.json(await syncDailyCloses(c.get("db"), c.get("fetch"), todayIso())));
