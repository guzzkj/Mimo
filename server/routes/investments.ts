import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { investments } from "../db/schema";
import { ApiError, notFound } from "../errors";
import { param, readJson, uuidSchema } from "../http";

// Fase 2 do roadmap de integrações: carteira cadastrada à mão (ticker,
// quantidade, preço médio). Cotações (brapi.dev) ficam para depois.

const tickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.]{1,12}$/, "Ticker inválido.");
const quantitySchema = z.string().regex(/^\d{1,12}(\.\d{1,8})?$/, "Quantidade inválida.").refine((q) => Number(q) > 0, "Quantidade deve ser maior que zero.");
const createSchema = z.object({
  ticker: tickerSchema,
  quantity: quantitySchema,
  averagePriceCents: z.number().int().min(0).max(1_000_000_000_00),
  ownerUserId: uuidSchema.nullable().optional(),
});
const patchSchema = createSchema.partial().strict();

const toDto = (i: typeof investments.$inferSelect) => ({
  id: i.id, ticker: i.ticker, quantity: i.quantity, averagePriceCents: i.averagePriceCents, ownerUserId: i.ownerUserId,
  updatedAt: i.updatedAt.toISOString(),
});

export const investmentRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { account } = c.get("access");
    const rows = await c.get("db").select().from(investments).where(eq(investments.accountId, account.id)).orderBy(asc(investments.ticker));
    return c.json({ investments: rows.map(toDto) });
  })

  .post("/", async (c) => {
    const body = await readJson(c, createSchema);
    const { account, me, isMember } = c.get("access");
    const owner = body.ownerUserId === undefined ? me.userId : body.ownerUserId;
    if (owner && !isMember(owner)) throw new ApiError("validation_failed", "Dono inválido para esta conta.");
    const [row] = await c.get("db").insert(investments).values({ ...body, ownerUserId: owner, accountId: account.id }).returning();
    return c.json({ investment: toDto(row) }, 201);
  })

  .patch("/:investmentId", async (c) => {
    const id = param(c, "investmentId");
    const body = await readJson(c, patchSchema);
    const { account, isMember } = c.get("access");
    if (body.ownerUserId && !isMember(body.ownerUserId)) throw new ApiError("validation_failed", "Dono inválido para esta conta.");
    const [row] = await c.get("db").update(investments).set({ ...body, updatedAt: new Date() })
      .where(and(eq(investments.id, id), eq(investments.accountId, account.id))).returning();
    if (!row) throw notFound("Investimento");
    return c.json({ investment: toDto(row) });
  })

  .delete("/:investmentId", async (c) => {
    const id = param(c, "investmentId");
    const { account } = c.get("access");
    const [row] = await c.get("db").delete(investments).where(and(eq(investments.id, id), eq(investments.accountId, account.id))).returning({ id: investments.id });
    if (!row) throw notFound("Investimento");
    return c.body(null, 204);
  });
