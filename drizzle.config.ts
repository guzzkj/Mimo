import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` gera SQL versionado em server/db/migrations a partir do schema.
// `pnpm db:migrate` aplica no banco de DATABASE_URL (use um branch de dev do Neon).
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
