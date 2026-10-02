import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db, DbHandle } from "../db/client";
import * as schema from "../db/schema";

const MIGRATIONS = fileURLToPath(new URL("../db/migrations", import.meta.url));

/** Postgres real em memória (PGlite) com as mesmas migrations versionadas do Neon. */
export async function createTestDb(): Promise<DbHandle & { client: PGlite }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, client, close: () => client.close() };
}
