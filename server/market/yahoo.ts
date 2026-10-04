import type { Fetcher } from "./types";

// Yahoo Finance via endpoint público de gráfico (v8/chart). NÃO é API oficial:
// os termos do Yahoo não permitem uso comercial e o formato pode mudar sem
// aviso. Serve para a fase gratuita; o resto do app só vê `YahooChart`, então
// trocar de fornecedor (ex.: brapi.dev) é trocar este arquivo.
// Limitações: provento vem só com data ex e valor (sem data de pagamento nem
// separação dividendo/JCP). A cotação em lote (v7/quote) exige autenticação.

export interface YahooChart {
  name: string | null;
  currency: string | null;
  priceCents: number | null;
  quotedAt: Date | null;
  closes: { date: string; closeCents: number }[];
  dividends: { exDate: string; amount: number }[];
  splits: { exDate: string; ratio: number }[];
}

export type YahooRange = "5d" | "1mo" | "3mo" | "1y" | "2y" | "5y";

const B3_TICKER = /^[A-Z]{4}\d{1,2}[A-Z]?$/;

/** PETR4 → PETR4.SA; tickers de fora da B3 (AAPL) seguem como estão. */
export const yahooSymbol = (symbol: string) => (B3_TICKER.test(symbol) ? `${symbol}.SA` : symbol);

const toCents = (v: number) => Math.round(v * 100);

interface ChartJson {
  chart?: {
    result?: {
      meta: { currency?: string; longName?: string; shortName?: string; regularMarketPrice?: number; regularMarketTime?: number; gmtoffset?: number };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
      events?: {
        dividends?: Record<string, { amount: number; date: number }>;
        splits?: Record<string, { date: number; numerator: number; denominator: number }>;
      };
    }[] | null;
    error?: { code?: string; description?: string } | null;
  };
}

/** `null` quando o Yahoo não conhece o ticker. */
export function parseChart(json: ChartJson): YahooChart | null {
  const result = json.chart?.result?.[0];
  if (!result) return null;
  const { meta } = result;
  // datas de calendário no fuso da bolsa (os timestamps vêm na abertura do pregão)
  const day = (unix: number) => new Date((unix + (meta.gmtoffset ?? 0)) * 1000).toISOString().slice(0, 10);
  const rawCloses = result.indicators?.quote?.[0]?.close ?? [];
  const closes = (result.timestamp ?? []).flatMap((t, i) => {
    const c = rawCloses[i];
    return c == null ? [] : [{ date: day(t), closeCents: toCents(c) }];
  });
  return {
    name: meta.longName ?? meta.shortName ?? null,
    currency: meta.currency ?? null,
    priceCents: meta.regularMarketPrice == null ? null : toCents(meta.regularMarketPrice),
    quotedAt: meta.regularMarketTime == null ? null : new Date(meta.regularMarketTime * 1000),
    closes,
    dividends: Object.values(result.events?.dividends ?? {}).map((d) => ({ exDate: day(d.date), amount: d.amount })),
    splits: Object.values(result.events?.splits ?? {})
      .filter((s) => s.denominator > 0)
      .map((s) => ({ exDate: day(s.date), ratio: s.numerator / s.denominator })),
  };
}

export async function fetchYahooChart(fetcher: Fetcher, symbol: string, range: YahooRange): Promise<YahooChart | null> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=${range}&interval=1d&events=div,split`;
  const res = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; MiauCash/1.0)" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  return parseChart(await res.json() as ChartJson);
}
