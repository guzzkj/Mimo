import { Pool } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Tipo comum aos drivers usados (Neon via WebSocket em produção, PGlite nos
 * testes). Ambos suportam `db.transaction`, que o driver HTTP do Neon não tem.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  /** Fecha a conexão ao fim da requisição (Workers não reaproveitam sockets entre requisições). */
  close: () => Promise<void>;
}

export function createNeonDb(databaseUrl: string): DbHandle {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema }) as unknown as Db;
  return { db, close: () => pool.end() };
}

export { schema };
