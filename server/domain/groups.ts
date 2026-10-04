import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

/** Novo id de grupo (parcelas de uma compra, repetições de uma recorrência). */
export async function nextGroupId(db: Db): Promise<number> {
  // os dois drivers (Neon e PGlite) devolvem { rows }
  const result = (await db.execute(sql`select nextval('transaction_group_seq') as v`)) as unknown as { rows: { v: string | number }[] };
  return Number(result.rows[0].v);
}
