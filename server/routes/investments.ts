import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { assets, corporateEvents, investments } from "../db/schema";
import { ApiError, notFound } from "../errors";
import { addDaysIso, isoDateSchema, param, readJson, todayIso, uuidSchema } from "../http";

// Fase 2 do roadmap de integrações: carteira cadastrada à mão (ticker,
// quantidade, preço médio). Cotações e proventos vêm das tabelas de mercado,
// preenchidas pelo cron (server/market/).

const tickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.]{1,12}$/, "Ticker inválido.");
const quantitySchema = z.string().regex(/^\d{1,12}(\.\d{1,8})?$/, "Quantidade inválida.").refine((q) => Number(q) > 0, "Quantidade deve ser maior que zero.");
const createSchema = z.object({
  ticker: tickerSchema,
  quantity: quantitySchema,
  averagePriceCents: z.number().int().min(0).max(1_000_000_000_00),
  ownerUserId: uuidSchema.nullable().optional(),
});
const patchSchema = createSchema.partial().strict();

const dividendsQuery = z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() });

const toDto = (i: typeof investments.$inferSelect) => ({
  id: i.id, ticker: i.ticker, quantity: i.quantity, averagePriceCents: i.averagePriceCents, ownerUserId: i.ownerUserId,
  updatedAt: i.updatedAt.toISOString(),
});

type Quote = Pick<typeof assets.$inferSelect, "lastPriceCents" | "lastQuotedAt" | "currency" | "name"> | null;

/** Quantidade (numeric em string) × valor unitário, arredondado em centavos. */
const timesQuantity = (quantity: string, unitCents: number) => Math.round(Number(quantity) * unitCents);

const withQuote = (i: typeof investments.$inferSelect, q: Quote) => ({
  ...toDto(i),
  quote: q?.lastPriceCents == null ? null : {
    priceCents: q.lastPriceCents, quotedAt: q.lastQuotedAt?.toISOString() ?? null, currency: q.currency, name: q.name,
  },
  marketValueCents: q?.lastPriceCents == null ? null : timesQuantity(i.quantity, q.lastPriceCents),
});

export const investmentRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { account } = c.get("access");
    const rows = await c.get("db")
      .select({ i: investments, q: { lastPriceCents: assets.lastPriceCents, lastQuotedAt: assets.lastQuotedAt, currency: assets.currency, name: assets.name } })
      .from(investments).leftJoin(assets, eq(assets.symbol, investments.ticker))
      .where(eq(investments.accountId, account.id)).orderBy(asc(investments.ticker));
    return c.json({ investments: rows.map((r) => withQuote(r.i, r.q)) });
  })

  /**
   * Proventos dos ativos da carteira (padrão: últimos 12 meses + próximos 90
   * dias, por data ex). `estimatedCents` usa a quantidade ATUAL: sem histórico
   * de compras e vendas é uma estimativa, e o valor é bruto (antes do IR do JCP).
   */
  .get("/dividends", async (c) => {
    const query = dividendsQuery.safeParse(c.req.query());
    if (!query.success) throw new ApiError("validation_failed", "Use datas no formato AAAA-MM-DD.");
    const today = todayIso();
    const from = query.data.from ?? addDaysIso(today, -365);
    const to = query.data.to ?? addDaysIso(today, 90);
    const { account } = c.get("access");
    const rows = await c.get("db")
      .select({ i: investments, e: corporateEvents, currency: assets.currency })
      .from(investments)
      .innerJoin(corporateEvents, and(eq(corporateEvents.symbol, investments.ticker), eq(corporateEvents.kind, "dividend")))
      .leftJoin(assets, eq(assets.symbol, investments.ticker))
      .where(and(eq(investments.accountId, account.id), gte(corporateEvents.exDate, from), lte(corporateEvents.exDate, to)))
      .orderBy(asc(corporateEvents.exDate), asc(investments.ticker));
    return c.json({
      from, to,
      dividends: rows.map(({ i, e, currency }) => ({
        investmentId: i.id, ticker: i.ticker, ownerUserId: i.ownerUserId, exDate: e.exDate, amountPerShare: e.amount,
        currency, quantity: i.quantity, estimatedCents: timesQuantity(i.quantity, Number(e.amount) * 100), source: e.source,
      })),
    });
  })

  .post("/", async (c) => {
    const body = await readJson(c, createSchema);
    const { account, me, isMember } = c.get("access");
    const owner = body.ownerUserId === undefined ? me.userId : body.ownerUserId;
    if (owner && !isMember(owner)) throw new ApiError("validation_failed", "Dono inválido para esta conta.");
    const [row] = await c.get("db").insert(investments).values({ ...body, ownerUserId: owner, accountId: account.id }).returning();
    return c.json({ investment: toDto(row) }, 201);
  })

  .patch("/:investmentId", async (c) => {
    const id = param(c, "investmentId");
    const body = await readJson(c, patchSchema);
    const { account, isMember } = c.get("access");
    if (body.ownerUserId && !isMember(body.ownerUserId)) throw new ApiError("validation_failed", "Dono inválido para esta conta.");
    const [row] = await c.get("db").update(investments).set({ ...body, updatedAt: new Date() })
      .where(and(eq(investments.id, id), eq(investments.accountId, account.id))).returning();
    if (!row) throw notFound("Investimento");
    return c.json({ investment: toDto(row) });
  })

  .delete("/:investmentId", async (c) => {
    const id = param(c, "investmentId");
    const { account } = c.get("access");
    const [row] = await c.get("db").delete(investments).where(and(eq(investments.id, id), eq(investments.accountId, account.id))).returning({ id: investments.id });
    if (!row) throw notFound("Investimento");
    return c.body(null, 204);
  });
