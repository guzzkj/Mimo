// Worker agendador: Pages Functions não têm Cron Triggers, então este Worker
// separado chama os endpoints internos da API (um por expressão cron).
// Segredo: `wrangler secret put CRON_SECRET -c workers/cron/wrangler.toml`
// (mesmo valor configurado no projeto Pages).

interface CronEnv {
  APP_URL: string;
  CRON_SECRET: string;
}

// precisa bater com [triggers].crons em wrangler.toml
const REMINDERS = "0 11 * * *";
const MARKET_QUOTES = "0 13-21 * * MON-FRI";
const MARKET_EOD = "0 1 * * TUE-SAT";

/** Teto de lotes por disparo da cotação (40 tickers cada = até 800 tickers). */
const MAX_QUOTE_BATCHES = 20;

async function callInternal(env: CronEnv, path: string): Promise<string> {
  const res = await fetch(new URL(`/api/internal/${path}`, env.APP_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${path} falhou: HTTP ${res.status} ${body.slice(0, 200)}`);
  console.log(`${path} ok: ${body}`);
  return body;
}

async function runMarketQuotes(env: CronEnv): Promise<void> {
  for (let i = 0; i < MAX_QUOTE_BATCHES; i++) {
    const { remaining } = JSON.parse(await callInternal(env, "market/quotes")) as { remaining: number };
    if (remaining <= 0) return;
  }
}

export default {
  async scheduled(controller, env, ctx) {
    switch (controller.cron) {
      case MARKET_QUOTES: ctx.waitUntil(runMarketQuotes(env)); break;
      case MARKET_EOD: ctx.waitUntil(callInternal(env, "market/eod")); break;
      case REMINDERS:
      default: ctx.waitUntil(callInternal(env, "reminders"));
    }
  },
} satisfies ExportedHandler<CronEnv>;
