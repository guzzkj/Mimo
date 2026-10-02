import { z } from "zod";
import type { goalContributions, goalItems, goals } from "../db/schema";
import { centsSchema, isoDateSchema, monthSchema, uuidSchema } from "../http";

export const MILESTONES = [25, 50, 75, 100] as const;

/** Marcos cruzados por um aporte (ex.: de 20% para 55% cruza 25 e 50). */
export function crossedMilestones(beforeCents: number, afterCents: number, targetCents: number): number[] {
  if (targetCents <= 0 || afterCents <= beforeCents) return [];
  return MILESTONES.filter((m) => beforeCents * 100 < m * targetCents && afterCents * 100 >= m * targetCents);
}

const goalItemSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome para o item.").max(80),
  valueCents: centsSchema,
  priority: z.string().trim().max(20).nullable().optional(),
});

const iconSchema = z.string().regex(/^[a-z]{2,20}$/, "Ícone inválido.");

export const goalCreateSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome para a meta.").max(80),
  icon: iconSchema.default("casa"),
  /** Obrigatório sem itens; com itens, o alvo é a soma deles. */
  targetCents: centsSchema.optional(),
  deadlineMonth: monthSchema.nullable().optional(),
  items: z.array(goalItemSchema).max(100).optional(),
  /** Quanto cada pessoa já tem guardado ao criar a meta. */
  initialContributions: z.array(z.object({ userId: uuidSchema.optional(), amountCents: centsSchema })).max(2).optional(),
}).refine((g) => (g.items?.length ?? 0) > 0 || g.targetCents !== undefined, { message: "Informe o valor da meta.", path: ["targetCents"] });

export const goalPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  icon: iconSchema.optional(),
  targetCents: centsSchema.optional(),
  deadlineMonth: monthSchema.nullable().optional(),
  archived: z.boolean().optional(),
}).strict();

export const goalItemsSchema = z.object({ items: z.array(goalItemSchema).min(1, "A meta precisa de pelo menos um item.").max(100) });

export const contributionSchema = z.object({
  amountCents: centsSchema,
  contributedOn: isoDateSchema,
  note: z.string().trim().max(120).nullable().optional(),
  /** Duo: quem está aportando (membro). Omitido = quem lança. */
  userId: uuidSchema.optional(),
});

export const sumCents = (list: { valueCents: number }[]) => list.reduce((t, i) => t + i.valueCents, 0);

/** "2027-03" -> "2027-03-01" (coluna date) e volta. */
export const monthToDate = (month: string | null | undefined) => (month ? `${month}-01` : null);
export const dateToMonth = (date: string | null) => (date ? date.slice(0, 7) : null);

export function toGoalDto(
  goal: typeof goals.$inferSelect,
  items: (typeof goalItems.$inferSelect)[],
  contributions: (typeof goalContributions.$inferSelect)[],
) {
  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    targetCents: goal.targetCents,
    deadlineMonth: dateToMonth(goal.deadlineMonth),
    archived: Boolean(goal.archivedAt),
    createdAt: goal.createdAt.toISOString(),
    savedCents: contributions.reduce((t, x) => t + x.amountCents, 0),
    items: items.sort((a, b) => a.position - b.position).map((i) => ({ id: i.id, name: i.name, valueCents: i.valueCents, priority: i.priority })),
    contributions: contributions
      .sort((a, b) => (a.contributedOn < b.contributedOn ? 1 : a.contributedOn > b.contributedOn ? -1 : b.createdAt.getTime() - a.createdAt.getTime()))
      .map((x) => ({ id: x.id, userId: x.userId, amountCents: x.amountCents, contributedOn: x.contributedOn, note: x.note })),
  };
}
export type GoalDto = ReturnType<typeof toGoalDto>;
