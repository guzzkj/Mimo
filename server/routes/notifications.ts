import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../context";
import { notificationReceipts, notifications } from "../db/schema";
import { notFound } from "../errors";
import { param, parseWith, readJson, uuidSchema } from "../http";
import { currentUser, loadAccess, requireVerifiedUser } from "../auth/access";
import { ApiError } from "../errors";

const listQuery = z.object({ accountId: uuidSchema.optional() });
const receiptSchema = z.object({
  accountId: uuidSchema,
  key: z.string().min(1).max(160),
  read: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

const toDto = (n: typeof notifications.$inferSelect) => ({
  id: n.id, accountId: n.accountId, kind: n.kind, title: n.title, body: n.body, data: n.data,
  read: Boolean(n.readAt), createdAt: n.createdAt.toISOString(),
});

export const notificationRoutes = new Hono<AppEnv>()
  .use("*", requireVerifiedUser)

  /**
   * Avisos do servidor (convites, aceite, marcos de meta) da pessoa, mais o
   * estado lido/dispensado dos avisos que o app calcula dos dados da conta.
   */
  .get("/", async (c) => {
    const { accountId } = parseWith(listQuery, c.req.query());
    const user = currentUser(c);
    const db = c.get("db");
    const items = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, user.id),
        isNull(notifications.dismissedAt),
        accountId ? or(eq(notifications.accountId, accountId), isNull(notifications.accountId)) : undefined,
      ))
      .orderBy(desc(notifications.createdAt)).limit(50);
    let receipts: { key: string; read: boolean; dismissed: boolean }[] = [];
    if (accountId) {
      const rows = await db.select().from(notificationReceipts)
        .where(and(eq(notificationReceipts.userId, user.id), eq(notificationReceipts.accountId, accountId)));
      receipts = rows.map((r) => ({ key: r.key, read: Boolean(r.readAt), dismissed: Boolean(r.dismissedAt) }));
    }
    return c.json({ notifications: items.map(toDto), receipts });
  })

  .post("/:id/read", async (c) => {
    const id = param(c, "id");
    const [row] = await c.get("db").update(notifications).set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, id), eq(notifications.userId, currentUser(c).id))).returning({ id: notifications.id });
    if (!row) throw notFound("Aviso");
    return c.body(null, 204);
  })

  .post("/read-all", async (c) => {
    await c.get("db").update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.userId, currentUser(c).id), isNull(notifications.readAt)));
    return c.body(null, 204);
  })

  .delete("/:id", async (c) => {
    const id = param(c, "id");
    const [row] = await c.get("db").update(notifications).set({ dismissedAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, currentUser(c).id))).returning({ id: notifications.id });
    if (!row) throw notFound("Aviso");
    return c.body(null, 204);
  })

  /** Marca um aviso calculado no app (chave "auto-...") como lido ou dispensado. */
  .put("/receipts", async (c) => {
    const body = await readJson(c, receiptSchema);
    const user = currentUser(c);
    const db = c.get("db");
    if (!(await loadAccess(db, body.accountId, user.id))) throw new ApiError("not_found", "Conta não encontrada.");
    const now = new Date();
    const values = {
      userId: user.id, accountId: body.accountId, key: body.key,
      readAt: body.read ? now : null, dismissedAt: body.dismissed ? now : null,
    };
    await db.insert(notificationReceipts).values(values).onConflictDoUpdate({
      target: [notificationReceipts.userId, notificationReceipts.accountId, notificationReceipts.key],
      set: {
        ...(body.read !== undefined ? { readAt: body.read ? now : null } : {}),
        ...(body.dismissed !== undefined ? { dismissedAt: body.dismissed ? now : null } : {}),
      },
    });
    return c.body(null, 204);
  });
