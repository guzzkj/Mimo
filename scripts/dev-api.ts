// API local sem Neon nem Cloudflare: o mesmo app Hono das Pages Functions,
// rodando em Node com PGlite (Postgres em arquivo, em .data/pglite) e as
// mesmas migrations. E-mails só aparecem no terminal (nada é enviado).
//
//   pnpm dev:api:local   (porta 8788, a mesma que o proxy do Vite usa)
//   pnpm dev             (em outro terminal)
//
// Para usar o Neon de verdade em dev, prefira `pnpm dev:api` (wrangler).
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createApp } from "../server/app";
import type { Db } from "../server/db/client";
import * as schema from "../server/db/schema";
import type { Mailer } from "../server/email/mailer";
import type { Env } from "../server/env";

const DATA_DIR = process.env.PGLITE_DIR ?? ".data/pglite";
const PORT = Number(process.env.PORT ?? 8788);

mkdirSync(DATA_DIR, { recursive: true });
const client = new PGlite(DATA_DIR);
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: "server/db/migrations" });

const mailer: Mailer = {
  async send(m) {
    console.info(`\n[email] para: ${m.to}\n        assunto: ${m.subject}\n${m.text.split("\n").map((l) => "        " + l).join("\n")}\n`);
  },
};

const env: Env = {
  DATABASE_URL: "pglite",
  EMAIL_FROM: "Mimo <dev@localhost>",
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  APP_ENV: "development",
  CRON_SECRET: process.env.CRON_SECRET ?? "dev-cron-secret",
};

const app = createApp({ db: () => ({ db: db as unknown as Db, close: async () => {} }), mailer: () => mailer });

serve({ fetch: (req) => app.fetch(req, env), port: PORT }, (info) => {
  console.info(`API local em http://localhost:${info.port}/api (dados em ${DATA_DIR})`);
});
