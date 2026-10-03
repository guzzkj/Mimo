// Worker agendador: Pages Functions não têm Cron Triggers, então este Worker
// separado chama o endpoint interno da API uma vez por dia.
// Segredo: `wrangler secret put CRON_SECRET -c workers/cron/wrangler.toml`
// (mesmo valor configurado no projeto Pages).

interface CronEnv {
  APP_URL: string;
  CRON_SECRET: string;
}

async function runReminders(env: CronEnv): Promise<void> {
  const res = await fetch(new URL("/api/internal/reminders", env.APP_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`reminders falhou: HTTP ${res.status} ${body.slice(0, 200)}`);
  console.log(`reminders ok: ${body}`);
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runReminders(env));
  },
} satisfies ExportedHandler<CronEnv>;
