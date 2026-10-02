import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Ctx } from "../context";
import type { Db } from "../db/client";
import { transactions } from "../db/schema";
import { ApiError, forbidden, notFound } from "../errors";
import { isoDateSchema, param, parseWith, readJson } from "../http";
import {
  isHiddenFrom, mergePatch, normalizeTransaction, toTransactionDto, transactionInputSchema, transactionPatchSchema,
  type TransactionRow,
} from "../domain/transactions";

const MAX_BATCH = 120;
const MAX_LIST = 5000;
const txIdSchema = z.coerce.number().int().positive();

const listQuery = z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() });

const batchSchema = z.object({
  create: z.array(transactionInputSchema.extend({
    /** Id temporário do cliente, devolvido junto do registro criado. */
    ref: z.string().min(1).max(40),
    /** Itens com o mesmo groupRef ganham o mesmo group_id (parcelas, recorrência). */
    groupRef: z.string().min(1).max(40).nullable().optional(),
  })).max(MAX_BATCH).default([]),
  update: z.array(transactionPatchSchema.extend({ id: z.number().int().positive() })).max(MAX_BATCH).default([]),
  delete: z.array(z.number().int().positive()).max(MAX_BATCH).default([]),
}).refine((b) => b.create.length + b.update.length + b.delete.length > 0, { message: "Nada para gravar." });

const markPaidSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(MAX_BATCH) });

const ruleContext = (c: Ctx) => {
  const access = c.get("access");
  return { accountKind: access.account.kind, meId: access.me.userId, isMember: access.isMember };
};

/** Carrega movimentações da conta pelo id e barra as privadas do par. */
async function loadOwned(db: Db, accountId: string, ids: number[], meId: string): Promise<Map<number, TransactionRow>> {
  if (!ids.length) return new Map();
  const rows = await db.select().from(transactions).where(and(eq(transactions.accountId, accountId), inArray(transactions.id, ids)));
  const map = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const row = map.get(id);
    if (!row) throw notFound("Movimentação");
    if (isHiddenFrom(row, meId)) throw forbidden("Lançamento privado do seu par: só quem lançou pode alterar.");
  }
  return map;
}

async function nextGroupId(db: Db): Promise<number> {
  // os dois drivers (Neon e PGlite) devolvem { rows }
  const result = (await db.execute(sql`select nextval('transaction_group_seq') as v`)) as unknown as { rows: { v: string | number }[] };
  return Number(result.rows[0].v);
}

export const transactionRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { from, to } = parseWith(listQuery, c.req.query());
    const { account, me } = c.get("access");
    const rows = await c.get("db").select().from(transactions)
      .where(and(
        eq(transactions.accountId, account.id),
        from ? gte(transactions.occurredOn, from) : undefined,
        to ? lte(transactions.occurredOn, to) : undefined,
      ))
      .orderBy(asc(transactions.occurredOn), asc(transactions.id))
      .limit(MAX_LIST);
    return c.json({ transactions: rows.map((r) => toTransactionDto(r, me.userId)) });
  })

  /** Criações, edições e exclusões numa transação só (o app sincroniza por diferença). */
  .post("/batch", async (c) => {
    const body = await readJson(c, batchSchema);
    const { account, me } = c.get("access");
    const ctx = ruleContext(c);

    const result = await c.get("db").transaction(async (tx) => {
      const existing = await loadOwned(tx, account.id, [...body.update.map((u) => u.id), ...body.delete], me.userId);

      const groups = new Map<string, number>();
      const created: { ref: string; transaction: ReturnType<typeof toTransactionDto> }[] = [];
      if (body.create.length) {
        for (const item of body.create) {
          if (item.groupRef && !groups.has(item.groupRef)) groups.set(item.groupRef, await nextGroupId(tx));
        }
        const values = body.create.map((item) => ({
          ...normalizeTransaction(item, ctx),
          accountId: account.id,
          createdBy: me.userId,
          groupId: item.groupRef ? groups.get(item.groupRef)! : null,
        }));
        const rows = await tx.insert(transactions).values(values).returning();
        rows.forEach((row, i) => created.push({ ref: body.create[i].ref, transaction: toTransactionDto(row, me.userId) }));
      }

      const updated = [];
      for (const { id, ...patch } of body.update) {
        const row = existing.get(id)!;
        const next = normalizeTransaction(mergePatch(row, patch), ctx);
        const [saved] = await tx.update(transactions).set({ ...next, updatedAt: new Date() })
          .where(and(eq(transactions.id, id), eq(transactions.accountId, account.id))).returning();
        updated.push(toTransactionDto(saved, me.userId));
      }

      if (body.delete.length) {
        await tx.delete(transactions).where(and(eq(transactions.accountId, account.id), inArray(transactions.id, body.delete)));
      }

      return { created, updated, deleted: body.delete, groups: Object.fromEntries(groups) };
    });
    return c.json(result);
  })

  .post("/mark-paid", async (c) => {
    const { ids } = await readJson(c, markPaidSchema);
    const { account, me } = c.get("access");
    const db = c.get("db");
    await loadOwned(db, account.id, ids, me.userId);
    const rows = await db.update(transactions).set({ status: "paid", updatedAt: new Date() })
      .where(and(eq(transactions.accountId, account.id), inArray(transactions.id, ids))).returning();
    return c.json({ transactions: rows.map((r) => toTransactionDto(r, me.userId)) });
  })

  .post("/", async (c) => {
    const body = await readJson(c, transactionInputSchema);
    const { account, me } = c.get("access");
    const [row] = await c.get("db").insert(transactions)
      .values({ ...normalizeTransaction(body, ruleContext(c)), accountId: account.id, createdBy: me.userId }).returning();
    return c.json({ transaction: toTransactionDto(row, me.userId) }, 201);
  })

  .patch("/:txId", async (c) => {
    const id = Number(param(c, "txId", txIdSchema.transform(String)));
    const patch = await readJson(c, transactionPatchSchema);
    const { account, me } = c.get("access");
    const db = c.get("db");
    const row = (await loadOwned(db, account.id, [id], me.userId)).get(id)!;
    const [saved] = await db.update(transactions)
      .set({ ...normalizeTransaction(mergePatch(row, patch), ruleContext(c)), updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.accountId, account.id))).returning();
    return c.json({ transaction: toTransactionDto(saved, me.userId) });
  })

  .delete("/:txId", async (c) => {
    const id = Number(param(c, "txId", txIdSchema.transform(String)));
    const { account, me } = c.get("access");
    const db = c.get("db");
    await loadOwned(db, account.id, [id], me.userId);
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.accountId, account.id)));
    return c.body(null, 204);
  });

export function assertDuo(c: Ctx) {
  if (c.get("access").account.kind !== "duo") throw new ApiError("conflict", "Disponível só na conta Duo.");
}
