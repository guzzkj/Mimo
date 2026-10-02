// Aplica as migrations versionadas (server/db/migrations) no banco de DATABASE_URL.
// Uso: DATABASE_URL=... pnpm db:migrate   (ou defina DATABASE_URL em .dev.vars)
// Rode primeiro num branch de desenvolvimento do Neon; produção só via CI/revisão.
import { readFileSync, existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (existsSync(".dev.vars")) {
    const line = readFileSync(".dev.vars", "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
  }
  throw new Error("Defina DATABASE_URL (variável de ambiente ou .dev.vars).");
}

const pool = new Pool({ connectionString: databaseUrl() });
try {
  await migrate(drizzle(pool), { migrationsFolder: "server/db/migrations" });
  console.log("Migrations aplicadas.");
} finally {
  await pool.end();
}
