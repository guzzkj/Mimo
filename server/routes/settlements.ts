import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { settlements } from "../db/schema";
import { ApiError, notFound } from "../errors";
import { centsSchema, isoDateSchema, monthSchema, param, parseWith, readJson, uuidSchema } from "../http";
import { assertDuo } from "./transactions";

const createSchema = z.object({
  month: monthSchema,
  paidOn: isoDateSchema,
  fromUserId: uuidSchema,
  toUserId: uuidSchema,
  amountCents: centsSchema,
}).refine((s) => s.fromUserId !== s.toUserId, { message: "Quem paga e quem recebe precisam ser pessoas diferentes.", path: ["toUserId"] });

const toDto = (s: typeof settlements.$inferSelect) => ({
  id: s.id, month: s.month, paidOn: s.paidOn, fromUserId: s.fromUserId, toUserId: s.toUserId, amountCents: s.amountCents, createdAt: s.createdAt.toISOString(),
});

/** Acertos da divisão (Pix entre os dois) — só na conta Duo. */
export const settlementRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    assertDuo(c);
    const { month } = parseWith(z.object({ month: monthSchema.optional() }), c.req.query());
    const { account } = c.get("access");
    const rows = await c.get("db").select().from(settlements)
      .where(and(eq(settlements.accountId, account.id), month ? eq(settlements.month, month) : undefined))
      .orderBy(asc(settlements.paidOn), asc(settlements.createdAt));
    return c.json({ settlements: rows.map(toDto) });
  })

  .post("/", async (c) => {
    assertDuo(c);
    const body = await readJson(c, createSchema);
    const { account, me, isMember } = c.get("access");
    if (!isMember(body.fromUserId) || !isMember(body.toUserId)) {
      throw new ApiError("validation_failed", "O acerto precisa ser entre os dois membros da conta.");
    }
    const [row] = await c.get("db").insert(settlements).values({ ...body, accountId: account.id, createdBy: me.userId }).returning();
    return c.json({ settlement: toDto(row) }, 201);
  })

  .delete("/:settlementId", async (c) => {
    assertDuo(c);
    const id = param(c, "settlementId");
    const { account } = c.get("access");
    const [row] = await c.get("db").delete(settlements).where(and(eq(settlements.id, id), eq(settlements.accountId, account.id))).returning({ id: settlements.id });
    if (!row) throw notFound("Acerto");
    return c.body(null, 204);
  });
