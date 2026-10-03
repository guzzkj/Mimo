import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AccountSettings, MemberPrefs } from "../domain/settings";

// Convenções:
// - dinheiro sempre em centavos (bigint), nunca float;
// - toda tabela com dado de usuário tem account_id ou user_id, e TODA query da
//   API filtra por eles depois de checar a participação (server/auth/access.ts);
// - datas de calendário em `date` (string "YYYY-MM-DD"), instantes em timestamptz.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const cents = (name: string) => bigint(name, { mode: "number" });

export const plan = pgEnum("plan", ["solo", "duo"]);
export const accountKind = pgEnum("account_kind", ["solo", "duo"]);
export const memberRole = pgEnum("member_role", ["owner", "partner"]);
export const tokenPurpose = pgEnum("token_purpose", ["verify_email", "reset_password"]);
export const transactionType = pgEnum("transaction_type", ["income", "expense"]);
export const transactionStatus = pgEnum("transaction_status", ["paid", "pending"]);
export const paymentMethod = pgEnum("payment_method", ["account", "card"]);
export const inviteStatus = pgEnum("invite_status", ["pending", "accepted", "declined", "revoked"]);
// Finalidades de consentimento opcional (LGPD art. 8º). As obrigatórias (termos e
// política de privacidade) ficam em colunas próprias de `users`.
export const consentPurpose = pgEnum("consent_purpose", ["marketing", "analytics"]);

// ---- identidade ----------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Sempre minúsculo e sem espaços (normalizado na aplicação). */
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  avatar: smallint("avatar").notNull().default(0),
  monthlyIncomeCents: cents("monthly_income_cents").notNull().default(0),
  /** Escolhido no onboarding; nulo até a pessoa escolher. */
  plan: plan("plan"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  // Base legal do cadastro (LGPD art. 7º, I/V): aceite dos Termos e da Política,
  // com a versão vigente no momento e o instante do aceite, para fins de prova.
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"),
  privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
  privacyVersion: text("privacy_version"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("users_email_key").on(t.email),
  check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
  check("users_income_non_negative", sql`${t.monthlyIncomeCents} >= 0`),
]);

/**
 * Consentimentos opcionais e sua última decisão (LGPD art. 8º e 18, IX). Uma
 * linha por (usuário, finalidade); guarda se está concedido, a versão do texto e
 * quando mudou. O histórico completo de concessão/revogação fica em `audit_log`.
 */
export const consents = pgTable("consents", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: consentPurpose("purpose").notNull(),
  granted: boolean("granted").notNull(),
  version: text("version"),
  updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.purpose] })]);

/**
 * Trilha de auditoria de operações sensíveis sobre dados pessoais (LGPD art. 37).
 * `userId` fica nulo se a pessoa for excluída, mas o registro da operação
 * permanece para prestação de contas (accountability).
 */
export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip"),
  createdAt: createdAt(),
}, (t) => [index("audit_log_user_idx").on(t.userId, t.createdAt)]);

/** Sessões opacas: o cookie leva o token; aqui fica só o SHA-256 dele. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/** Tokens de uso único enviados por e-mail (verificação e redefinição de senha). */
export const emailTokens = pgTable("email_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: tokenPurpose("purpose").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("email_tokens_hash_key").on(t.tokenHash),
  index("email_tokens_user_purpose_idx").on(t.userId, t.purpose, t.createdAt),
]);

/** Tentativas de login, para travar força bruta (por e-mail + IP, por IP e por e-mail). */
export const loginAttempts = pgTable("login_attempts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
  ip: text("ip"),
  success: boolean("success").notNull(),
  createdAt: createdAt(),
}, (t) => [
  index("login_attempts_email_idx").on(t.email, t.createdAt),
  index("login_attempts_ip_idx").on(t.ip, t.createdAt),
]);

/**
 * Contadores de rate limit em janela fixa (server/rate-limit.ts). Workers não
 * compartilham memória entre isolates, então o contador vive no Postgres.
 * `key` = "<bucket>:<sha256 do sujeito>" (IP, conta, e-mail...); limpo pelo job diário.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("rate_limits_window_idx").on(t.windowStart)]);

// ---- contas (Solo e Duo) --------------------------------------------------------

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: accountKind("kind").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  /** Limite, categorias próprias, orçamentos, cartão e lazer (zod em domain/settings.ts). */
  settings: jsonb("settings").$type<AccountSettings>().notNull().default({}),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  // no máximo uma conta Duo aberta por pessoa: barra a condição de corrida de
  // dois POST simultâneos em /me/onboarding ou /me/plan (que faziam "verifica
  // e cria" sem trava e abriam duas Duo). O desvínculo fecha (closed_at), então
  // criar outra depois continua valendo.
  uniqueIndex("accounts_one_open_duo_per_creator").on(t.createdBy).where(sql`${t.kind} = 'duo' and ${t.closedAt} is null`),
]);

export const accountMembers = pgTable("account_members", {
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull(),
  /** Preferências da pessoa nesta conta (avisos, abrir oculto). */
  prefs: jsonb("prefs").$type<MemberPrefs>().notNull().default({}),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.accountId, t.userId] }),
  index("account_members_user_idx").on(t.userId),
]);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  inviterId: uuid("inviter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  message: text("message"),
  tokenHash: text("token_hash").notNull(),
  status: inviteStatus("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("invites_token_key").on(t.tokenHash),
  // no máximo um convite pendente por conta Duo
  uniqueIndex("invites_one_pending_per_account").on(t.accountId).where(sql`${t.status} = 'pending'`),
  index("invites_email_idx").on(t.email),
]);

// ---- movimentações ---------------------------------------------------------------

/** Liga parcelas de uma compra ou repetições de uma conta recorrente. */
export const transactionGroupSeq = pgSequence("transaction_group_seq");

export const transactions = pgTable("transactions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  /** Quem fez a movimentação. Nulo = conta conjunta (só em contas Duo). */
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  type: transactionType("type").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  amountCents: cents("amount_cents").notNull(),
  occurredOn: date("occurred_on", { mode: "string" }).notNull(),
  status: transactionStatus("status").notNull().default("paid"),
  method: paymentMethod("method").notNull().default("account"),
  groupId: bigint("group_id", { mode: "number" }),
  installmentNumber: smallint("installment_number"),
  installmentTotal: smallint("installment_total"),
  recurring: boolean("recurring").notNull().default(false),
  /** Duo: só o autor vê os detalhes; para o par entra só no total. */
  isPrivate: boolean("is_private").notNull().default(false),
  /** Duo: despesa que entra na divisão do mês. */
  split: boolean("split").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("transactions_account_date_idx").on(t.accountId, t.occurredOn),
  index("transactions_account_group_idx").on(t.accountId, t.groupId),
  check("transactions_amount_positive", sql`${t.amountCents} > 0`),
  check("transactions_installment_pair", sql`(${t.installmentNumber} IS NULL) = (${t.installmentTotal} IS NULL)`),
  check("transactions_installment_range", sql`${t.installmentNumber} IS NULL OR (${t.installmentNumber} BETWEEN 1 AND ${t.installmentTotal})`),
  check("transactions_description_length", sql`char_length(${t.description}) BETWEEN 1 AND 120`),
]);

// ---- metas -----------------------------------------------------------------------

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("casa"),
  targetCents: cents("target_cents").notNull(),
  /** Primeiro dia do mês do prazo; nulo = sem prazo. */
  deadlineMonth: date("deadline_month", { mode: "string" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("goals_account_idx").on(t.accountId),
  check("goals_target_positive", sql`${t.targetCents} > 0`),
]);

/** Itens de uma meta de itens (ex.: montar a casa); o alvo é a soma deles. */
export const goalItems = pgTable("goal_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  valueCents: cents("value_cents").notNull(),
  /** Opcional: essencial / urgente / conforto (o protótipo ainda alterna entre ter e não ter). */
  priority: text("priority"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  index("goal_items_goal_idx").on(t.goalId),
  check("goal_items_value_positive", sql`${t.valueCents} > 0`),
]);

/** Aportes: quem guardou quanto, quando. */
export const goalContributions = pgTable("goal_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  amountCents: cents("amount_cents").notNull(),
  contributedOn: date("contributed_on", { mode: "string" }).notNull(),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  index("goal_contributions_goal_idx").on(t.goalId),
  check("goal_contributions_amount_positive", sql`${t.amountCents} > 0`),
]);

// ---- Duo: acertos da divisão ---------------------------------------------------

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  /** "YYYY-MM" do mês acertado. */
  month: text("month").notNull(),
  paidOn: date("paid_on", { mode: "string" }).notNull(),
  fromUserId: uuid("from_user_id").references(() => users.id, { onDelete: "set null" }),
  toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "set null" }),
  amountCents: cents("amount_cents").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  index("settlements_account_month_idx").on(t.accountId, t.month),
  check("settlements_amount_positive", sql`${t.amountCents} > 0`),
  check("settlements_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
]);

// ---- notificações -----------------------------------------------------------------

/** Avisos gerados pelo servidor (convite, aceite, marcos de meta). */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  /** Evita duplicar o mesmo aviso (ex.: "goal:<id>:50"). */
  dedupeKey: text("dedupe_key"),
  readAt: timestamp("read_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("notifications_user_idx").on(t.userId, t.createdAt),
  uniqueIndex("notifications_user_dedupe_key").on(t.userId, t.dedupeKey),
]);

/**
 * Lido/dispensado dos avisos que o app calcula dos dados (contas vencendo,
 * limite, orçamento, fatura). A chave é a mesma que o front usa ("auto-...").
 */
export const notificationReceipts = pgTable("notification_receipts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.accountId, t.key] })]);

// ---- investimentos (Fase 2 do roadmap: cadastro manual) --------------------------

export const investments = pgTable("investments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  ticker: text("ticker").notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
  averagePriceCents: cents("average_price_cents").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("investments_account_idx").on(t.accountId),
  check("investments_quantity_positive", sql`${t.quantity} > 0`),
  check("investments_price_non_negative", sql`${t.averagePriceCents} >= 0`),
]);
