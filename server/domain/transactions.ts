import { z } from "zod";
import type { transactions } from "../db/schema";
import { ApiError } from "../errors";
import { centsSchema, isoDateSchema, uuidSchema } from "../http";

export type TransactionRow = typeof transactions.$inferSelect;

export const PRIVATE_DESCRIPTION = "Lançamento privado";
export const PRIVATE_CATEGORY = "Privado";

const installmentSchema = z.object({
  number: z.number().int().min(1),
  total: z.number().int().min(2).max(120),
}).refine((i) => i.number <= i.total, { message: "Parcela fora do total." });

/** Campos editáveis de uma movimentação (entrada da API). */
export const transactionInputSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().trim().min(1, "Informe uma descrição para a movimentação.").max(120),
  category: z.string().trim().min(1).max(40),
  amountCents: centsSchema,
  occurredOn: isoDateSchema,
  status: z.enum(["paid", "pending"]).default("paid"),
  method: z.enum(["account", "card"]).default("account"),
  installment: installmentSchema.nullable().optional(),
  recurring: z.boolean().default(false),
  /** Duo: autor (membro) ou null = conta conjunta. Omitido = quem está lançando. */
  authorUserId: uuidSchema.nullable().optional(),
  isPrivate: z.boolean().default(false),
  split: z.boolean().default(false),
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transactionPatchSchema = transactionInputSchema.partial().strict();
export type TransactionPatch = z.infer<typeof transactionPatchSchema>;

interface RuleContext {
  accountKind: "solo" | "duo";
  meId: string;
  isMember: (userId: string) => boolean;
}

/**
 * Regras de consistência (as mesmas do formulário do app), aplicadas no
 * servidor para nenhum cliente gravar combinação inválida:
 * - Solo: autor é sempre quem lança; sem privado e sem divisão.
 * - Duo: autor é membro ou a conta conjunta (null); conjunta nunca é privada;
 *   só o próprio autor marca um lançamento como privado; dividir só vale em
 *   saída compartilhada paga por um dos dois.
 * - Entrada nunca é no cartão.
 */
export function normalizeTransaction(input: TransactionInput, ctx: RuleContext) {
  let authorUserId: string | null = input.authorUserId === undefined ? ctx.meId : input.authorUserId;
  let isPrivate = input.isPrivate;
  let split = input.split;

  if (ctx.accountKind === "solo") {
    authorUserId = ctx.meId;
    isPrivate = false;
    split = false;
  } else {
    if (authorUserId !== null && !ctx.isMember(authorUserId)) {
      throw new ApiError("validation_failed", "Autor inválido para esta conta.", { fields: { authorUserId: "Escolha você, seu par ou a conta conjunta." } });
    }
    if (authorUserId === null && isPrivate) {
      throw new ApiError("validation_failed", "Lançamentos da conta conjunta são sempre compartilhados.", { fields: { isPrivate: "Lançamentos da conta conjunta são sempre compartilhados." } });
    }
    if (isPrivate && authorUserId !== ctx.meId) {
      throw new ApiError("forbidden", "Só quem fez o lançamento pode marcá-lo como privado.");
    }
    if (input.type !== "expense" || authorUserId === null || isPrivate) split = false;
  }

  return {
    type: input.type,
    description: input.description,
    category: input.category,
    amountCents: input.amountCents,
    occurredOn: input.occurredOn,
    status: input.status,
    method: input.type === "expense" ? input.method : ("account" as const),
    installmentNumber: input.installment?.number ?? null,
    installmentTotal: input.installment?.total ?? null,
    recurring: input.recurring,
    authorUserId,
    isPrivate,
    split,
  };
}
export type NormalizedTransaction = ReturnType<typeof normalizeTransaction>;

/** Lançamento privado do par: ninguém além do autor lê nem altera. */
export const isHiddenFrom = (row: Pick<TransactionRow, "isPrivate" | "authorUserId">, userId: string) =>
  row.isPrivate && row.authorUserId !== userId;

/** Saída da API. Lançamento privado do par sai sem descrição nem categoria (entra só no total). */
export function toTransactionDto(row: TransactionRow, viewerId: string) {
  const hidden = isHiddenFrom(row, viewerId);
  return {
    id: row.id,
    type: row.type,
    description: hidden ? PRIVATE_DESCRIPTION : row.description,
    category: hidden ? PRIVATE_CATEGORY : row.category,
    amountCents: row.amountCents,
    occurredOn: row.occurredOn,
    status: row.status,
    method: row.method,
    groupId: hidden ? null : row.groupId,
    installment: !hidden && row.installmentNumber && row.installmentTotal ? { number: row.installmentNumber, total: row.installmentTotal } : null,
    recurring: hidden ? false : row.recurring,
    authorUserId: row.authorUserId,
    isPrivate: row.isPrivate,
    split: row.split,
    redacted: hidden,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type TransactionDto = ReturnType<typeof toTransactionDto>;

/** Junta o registro atual com um patch parcial para revalidar a combinação inteira. */
export function mergePatch(row: TransactionRow, patch: TransactionPatch): TransactionInput {
  const installment = patch.installment !== undefined
    ? patch.installment
    : row.installmentNumber && row.installmentTotal ? { number: row.installmentNumber, total: row.installmentTotal } : null;
  return {
    type: patch.type ?? row.type,
    description: patch.description ?? row.description,
    category: patch.category ?? row.category,
    amountCents: patch.amountCents ?? row.amountCents,
    occurredOn: patch.occurredOn ?? row.occurredOn,
    status: patch.status ?? row.status,
    method: patch.method ?? row.method,
    installment,
    recurring: patch.recurring ?? row.recurring,
    authorUserId: patch.authorUserId !== undefined ? patch.authorUserId : row.authorUserId,
    isPrivate: patch.isPrivate ?? row.isPrivate,
    split: patch.split ?? row.split,
  };
}
