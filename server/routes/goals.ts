import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { defer, type AppEnv, type Ctx } from "../context";
import type { Db } from "../db/client";
import { goalContributions, goalItems, goals } from "../db/schema";
import { ApiError, notFound } from "../errors";
import { param, readJson, todayIso } from "../http";
import {
  contributionSchema, crossedMilestones, goalCreateSchema, goalItemsSchema, goalPatchSchema, monthToDate, sumCents, toGoalDto,
} from "../domain/goals";
import { notify } from "../domain/notify";
import { goalMilestoneMessage } from "../email/templates";

async function loadGoals(db: Db, accountId: string, ids?: string[]) {
  const rows = await db.select().from(goals)
    .where(and(eq(goals.accountId, accountId), ids ? inArray(goals.id, ids) : undefined))
    .orderBy(asc(goals.createdAt));
  if (!rows.length) return [];
  const goalIds = rows.map((g) => g.id);
  const [items, contributions] = await Promise.all([
    db.select().from(goalItems).where(inArray(goalItems.goalId, goalIds)),
    db.select().from(goalContributions).where(inArray(goalContributions.goalId, goalIds)),
  ]);
  return rows.map((g) => toGoalDto(g, items.filter((i) => i.goalId === g.id), contributions.filter((x) => x.goalId === g.id)));
}

async function loadGoal(db: Db, accountId: string, goalId: string) {
  const [goal] = await loadGoals(db, accountId, [goalId]);
  if (!goal) throw notFound("Meta");
  return goal;
}

/** Quem aporta precisa ser membro da conta; sem informar, é quem está lançando. */
function contributorId(c: Ctx, userId: string | undefined) {
  const access = c.get("access");
  const id = userId ?? access.me.userId;
  if (!access.isMember(id)) throw new ApiError("validation_failed", "Quem aporta precisa participar da conta.", { fields: { userId: "Escolha você ou seu par." } });
  return id;
}

export const goalRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { account } = c.get("access");
    return c.json({ goals: await loadGoals(c.get("db"), account.id) });
  })

  .post("/", async (c) => {
    const body = await readJson(c, goalCreateSchema);
    const { account, me } = c.get("access");
    const db = c.get("db");
    const initial = (body.initialContributions ?? []).map((x) => ({ ...x, userId: contributorId(c, x.userId) }));
    const id = await db.transaction(async (tx) => {
      const target = body.items?.length ? sumCents(body.items) : body.targetCents!;
      const [goal] = await tx.insert(goals).values({
        accountId: account.id, createdBy: me.userId, name: body.name, icon: body.icon, targetCents: target,
        deadlineMonth: monthToDate(body.deadlineMonth),
      }).returning();
      if (body.items?.length) {
        await tx.insert(goalItems).values(body.items.map((it, position) => ({ goalId: goal.id, name: it.name, valueCents: it.valueCents, priority: it.priority ?? null, position })));
      }
      if (initial.length) {
        await tx.insert(goalContributions).values(initial.map((x) => ({
          goalId: goal.id, userId: x.userId, amountCents: x.amountCents, contributedOn: todayIso(), note: "Saldo inicial", createdBy: me.userId,
        })));
      }
      return goal.id;
    });
    return c.json({ goal: await loadGoal(db, account.id, id) }, 201);
  })

  .patch("/:goalId", async (c) => {
    const goalId = param(c, "goalId");
    const patch = await readJson(c, goalPatchSchema);
    const { account } = c.get("access");
    const db = c.get("db");
    const { archived, deadlineMonth, ...rest } = patch;
    const [row] = await db.update(goals).set({
      ...rest,
      ...(deadlineMonth !== undefined ? { deadlineMonth: monthToDate(deadlineMonth) } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      updatedAt: new Date(),
    }).where(and(eq(goals.id, goalId), eq(goals.accountId, account.id))).returning({ id: goals.id });
    if (!row) throw notFound("Meta");
    return c.json({ goal: await loadGoal(db, account.id, goalId) });
  })

  .delete("/:goalId", async (c) => {
    const goalId = param(c, "goalId");
    const { account } = c.get("access");
    const [row] = await c.get("db").delete(goals).where(and(eq(goals.id, goalId), eq(goals.accountId, account.id))).returning({ id: goals.id });
    if (!row) throw notFound("Meta");
    return c.body(null, 204);
  })

  /** Substitui a lista de itens; o alvo passa a ser a soma deles. */
  .put("/:goalId/items", async (c) => {
    const goalId = param(c, "goalId");
    const { items } = await readJson(c, goalItemsSchema);
    const { account } = c.get("access");
    const db = c.get("db");
    await db.transaction(async (tx) => {
      const [row] = await tx.update(goals).set({ targetCents: sumCents(items), updatedAt: new Date() })
        .where(and(eq(goals.id, goalId), eq(goals.accountId, account.id))).returning({ id: goals.id });
      if (!row) throw notFound("Meta");
      await tx.delete(goalItems).where(eq(goalItems.goalId, goalId));
      await tx.insert(goalItems).values(items.map((it, position) => ({ goalId, name: it.name, valueCents: it.valueCents, priority: it.priority ?? null, position })));
    });
    return c.json({ goal: await loadGoal(db, account.id, goalId) });
  })

  .post("/:goalId/contributions", async (c) => {
    const goalId = param(c, "goalId");
    const body = await readJson(c, contributionSchema);
    const access = c.get("access");
    const db = c.get("db");
    const before = await loadGoal(db, access.account.id, goalId);
    if (before.archived) throw new ApiError("conflict", "Esta meta está arquivada.");
    await db.insert(goalContributions).values({
      goalId, userId: contributorId(c, body.userId), amountCents: body.amountCents, contributedOn: body.contributedOn,
      note: body.note || null, createdBy: access.me.userId,
    });
    const goal = await loadGoal(db, access.account.id, goalId);

    // marcos 25/50/75/100%: aviso no sino de cada membro (uma vez só) e e-mail para quem pediu
    const crossed = crossedMilestones(before.savedCents, goal.savedCents, goal.targetCents);
    if (crossed.length) {
      const top = crossed[crossed.length - 1];
      const duo = access.account.kind === "duo";
      const created = await notify(db, access.members.filter((m) => m.prefs.alerts.goals).map((m) => ({
        userId: m.userId, accountId: access.account.id, kind: "goal" as const,
        title: top >= 100 ? `Meta concluída: ${goal.name}` : `${goal.name} passou de ${top}%`,
        body: `${duo ? "Vocês já guardaram" : "Você já guardou"} ${(goal.savedCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        data: { goalId, milestone: top },
        dedupeKey: `goal:${goalId}:${top}`,
      })));
      const url = `${c.env.APP_URL}/metas/${goalId}`;
      for (const m of access.members) {
        if (m.prefs.alerts.goals && m.prefs.alerts.email && created.some((n) => n.userId === m.userId)) {
          defer(c, c.get("mailer").send({ to: m.email, ...goalMilestoneMessage(goal.name, top, goal.savedCents, url, duo), idempotencyKey: `goal-${goalId}-${top}-${m.userId}` }));
        }
      }
    }
    return c.json({ goal, milestones: crossed }, 201);
  })

  .delete("/:goalId/contributions/:contributionId", async (c) => {
    const goalId = param(c, "goalId");
    const contributionId = param(c, "contributionId");
    const { account } = c.get("access");
    const db = c.get("db");
    // garante que a meta é desta conta antes de apagar o aporte
    const [owned] = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, goalId), eq(goals.accountId, account.id), isNull(goals.archivedAt)));
    if (!owned) throw notFound("Meta");
    const [row] = await db.delete(goalContributions)
      .where(and(eq(goalContributions.id, contributionId), eq(goalContributions.goalId, goalId))).returning({ id: goalContributions.id });
    if (!row) throw notFound("Aporte");
    return c.json({ goal: await loadGoal(db, account.id, goalId) });
  });
