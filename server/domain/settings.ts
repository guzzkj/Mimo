import { z } from "zod";

// Ajustes guardados em jsonb. Validados aqui na escrita e normalizados na
// leitura (defaults preenchem o que faltar), para o jsonb nunca virar lixo.

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.");
const categoryName = z.string().trim().min(1).max(40);
const money = z.number().int().min(0).max(100_000_000_00);

export const customCategorySchema = z.object({ name: categoryName, color: hexColor });

export const accountSettingsSchema = z.object({
  /** Limite mensal de gastos, em centavos. */
  spendingLimitCents: money,
  customCategories: z.array(customCategorySchema).max(50),
  /** Orçamento mensal por categoria de saída, em centavos. */
  budgetsCents: z.record(categoryName, money),
  card: z.object({
    closingDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
  }),
  /** Duo: como o limite de lazer é controlado e se o par ainda precisa confirmar. */
  leisureMode: z.enum(["together", "half"]),
  leisurePending: z.boolean(),
});
export type AccountSettings = Partial<z.infer<typeof accountSettingsSchema>>;
export type ResolvedAccountSettings = z.infer<typeof accountSettingsSchema>;

export const alertPrefsSchema = z.object({
  bills: z.boolean(),
  billsDaysAhead: z.number().int().min(0).max(30),
  limit: z.boolean(),
  limitThreshold: z.enum(["80", "100"]),
  goals: z.boolean(),
  email: z.boolean(),
  partner: z.boolean(),
});

export const memberPrefsSchema = z.object({
  alerts: alertPrefsSchema,
  startHidden: z.boolean(),
});
export type MemberPrefs = Partial<{ alerts: Partial<z.infer<typeof alertPrefsSchema>>; startHidden: boolean }>;
export type ResolvedMemberPrefs = z.infer<typeof memberPrefsSchema>;

export const DEFAULT_ALERTS: ResolvedMemberPrefs["alerts"] = {
  bills: true, billsDaysAhead: 3, limit: true, limitThreshold: "80", goals: true, email: false, partner: true,
};

export const defaultAccountSettings = (kind: "solo" | "duo"): ResolvedAccountSettings => ({
  spendingLimitCents: kind === "duo" ? 6000_00 : 2000_00,
  customCategories: [],
  budgetsCents: {},
  card: { closingDay: 3, dueDay: 10 },
  leisureMode: "together",
  leisurePending: false,
});

export function resolveAccountSettings(kind: "solo" | "duo", stored: AccountSettings | null | undefined): ResolvedAccountSettings {
  const base = defaultAccountSettings(kind);
  const merged = { ...base, ...(stored ?? {}), card: { ...base.card, ...(stored?.card ?? {}) } };
  const parsed = accountSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

export function resolveMemberPrefs(stored: MemberPrefs | null | undefined): ResolvedMemberPrefs {
  const merged = { alerts: { ...DEFAULT_ALERTS, ...(stored?.alerts ?? {}) }, startHidden: stored?.startHidden ?? false };
  const parsed = memberPrefsSchema.safeParse(merged);
  return parsed.success ? parsed.data : { alerts: DEFAULT_ALERTS, startHidden: false };
}

/** Patch aceito em PATCH /accounts/:id/settings (tudo opcional). */
export const settingsPatchSchema = z.object({
  spendingLimitCents: money.optional(),
  customCategories: z.array(customCategorySchema).max(50).optional(),
  budgetsCents: z.record(categoryName, money).optional(),
  card: z.object({ closingDay: z.number().int().min(1).max(31), dueDay: z.number().int().min(1).max(31) }).partial().optional(),
  leisureMode: z.enum(["together", "half"]).optional(),
  leisurePending: z.boolean().optional(),
  alerts: alertPrefsSchema.partial().optional(),
  startHidden: z.boolean().optional(),
}).strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
