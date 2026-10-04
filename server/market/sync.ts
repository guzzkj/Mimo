import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { assetPricesDaily, assets, corporateEvents, investments } from "../db/schema";
import { fetchLatestCotahist } from "./cotahist";
import type { Fetcher } from "./types";
import { fetchYahooChart } from "./yahoo";

// Sincronização dos dados de mercado, chamada pelo cron. O custo cresce com a
// quantidade de tickers distintos em carteira, não com o número de usuários.

const CONCURRENCY = 6;
/** Ticker desconhecido volta a ser tentado depois disso (pode ter sido um IPO recente). */
const NOT_FOUND_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
const CHUNK = 500;

async function inChunks<T>(rows: T[], run: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await run(rows.slice(i, i + CHUNK));
}

export interface QuotesResult {
  synced: number;
  notFound: number;
  errors: number;
  /** Tickers ainda pendentes nesta rodada: o cron chama de novo enquanto > 0. */
  remaining: number;
}

/**
 * Atualiza cotação, histórico e proventos (Yahoo) de até `limit` tickers em
 * carteira, dos mais desatualizados para os mais recentes. Um ticker sincronizado
 * há menos de `freshMinutes` conta como em dia, então chamadas repetidas
 * avançam pela fila em vez de repetir os mesmos tickers. O limite por chamada
 * existe porque cada requisição do Workers tem um teto de subrequests.
 */
export async function syncQuotes(db: Db, fetcher: Fetcher, opts: { limit: number; freshMinutes: number; now?: Date }): Promise<QuotesResult> {
  const now = opts.now ?? new Date();
  await db.execute(sql`insert into ${assets} (symbol) select distinct ${investments.ticker} from ${investments} on conflict do nothing`);

  const stale = and(
    inArray(assets.symbol, db.selectDistinct({ t: investments.ticker }).from(investments)),
    or(isNull(assets.syncedAt), lt(assets.syncedAt, new Date(now.getTime() - opts.freshMinutes * 60_000))),
    or(eq(assets.notFound, false), lt(assets.syncedAt, new Date(now.getTime() - NOT_FOUND_RETRY_MS))),
  );
  const batch = await db.select().from(assets).where(stale).orderBy(sql`${assets.syncedAt} asc nulls first`, asc(assets.symbol)).limit(opts.limit);

  const result: QuotesResult = { synced: 0, notFound: 0, errors: 0, remaining: 0 };
  const queue = [...batch];
  const worker = async () => {
    for (let asset = queue.shift(); asset; asset = queue.shift()) {
      try {
        const chart = await fetchYahooChart(fetcher, asset.symbol, asset.backfilledAt ? "3mo" : "2y");
        if (!chart) {
          await db.update(assets).set({ notFound: true, syncedAt: now }).where(eq(assets.symbol, asset.symbol));
          result.notFound++;
          continue;
        }
        await saveChart(db, asset.symbol, chart, now, !asset.backfilledAt);
        result.synced++;
      } catch (err) {
        console.error("[market] cotação", asset.symbol, err instanceof Error ? err.message : err);
        // marca a tentativa para o ticker problemático não travar a fila
        await db.update(assets).set({ syncedAt: now }).where(eq(assets.symbol, asset.symbol));
        result.errors++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assets).where(stale);
  result.remaining = count;
  return result;
}

async function saveChart(db: Db, symbol: string, chart: NonNullable<Awaited<ReturnType<typeof fetchYahooChart>>>, now: Date, backfill: boolean) {
  await db.update(assets).set({
    name: chart.name, currency: chart.currency, notFound: false, syncedAt: now,
    ...(chart.priceCents != null ? { lastPriceCents: chart.priceCents, lastQuotedAt: chart.quotedAt ?? now } : {}),
    ...(backfill ? { backfilledAt: now } : {}),
  }).where(eq(assets.symbol, symbol));

  // fechamento do Yahoo só preenche buracos: o da B3 (cotahist) prevalece
  await inChunks(chart.closes, (rows) => db.insert(assetPricesDaily)
    .values(rows.map((r) => ({ symbol, date: r.date, closeCents: r.closeCents, source: "yahoo" })))
    .onConflictDoNothing());

  const events = [
    ...chart.dividends.map((d) => ({ symbol, kind: "dividend" as const, exDate: d.exDate, amount: d.amount.toFixed(8), source: "yahoo" })),
    ...chart.splits.map((s) => ({ symbol, kind: "split" as const, exDate: s.exDate, amount: s.ratio.toFixed(8), source: "yahoo" })),
  ];
  // proventos são retificados de vez em quando: o valor mais recente vence
  await inChunks(events, (rows) => db.insert(corporateEvents).values(rows)
    .onConflictDoUpdate({ target: [corporateEvents.symbol, corporateEvents.kind, corporateEvents.exDate], set: { amount: sql`excluded.amount` } }));
}

/**
 * Grava o fechamento oficial do último pregão (COTAHIST da B3) para os tickers
 * acompanhados e atualiza a última cotação de quem ficou sem nada mais novo.
 */
export async function syncDailyCloses(db: Db, fetcher: Fetcher, todayIso: string): Promise<{ date: string | null; saved: number }> {
  const file = await fetchLatestCotahist(fetcher, todayIso);
  if (!file) return { date: null, saved: 0 };
  const tracked = new Set((await db.select({ symbol: assets.symbol }).from(assets)).map((a) => a.symbol));
  const closes = file.closes.filter((c) => tracked.has(c.symbol));

  await inChunks(closes, (rows) => db.insert(assetPricesDaily)
    .values(rows.map((r) => ({ ...r, source: "cotahist" })))
    .onConflictDoUpdate({ target: [assetPricesDaily.symbol, assetPricesDaily.date], set: { closeCents: sql`excluded.close_cents`, source: sql`excluded.source` } }));

  // cotação "ao vivo" do Yahoo do mesmo dia ou mais nova continua valendo
  const closedAt = new Date(`${file.date}T21:00:00Z`); // ~18h de Brasília
  await inChunks(closes, (rows) => db.execute(sql`
    update ${assets} set last_price_cents = v.close_cents, last_quoted_at = ${closedAt.toISOString()}::timestamptz
    from (values ${sql.join(rows.map((r) => sql`(${r.symbol}, ${r.closeCents}::bigint)`), sql`, `)}) as v(symbol, close_cents)
    where ${assets.symbol} = v.symbol and (${assets.lastQuotedAt} is null or ${assets.lastQuotedAt} < ${closedAt.toISOString()}::timestamptz)`));
  return { date: file.date, saved: closes.length };
}
