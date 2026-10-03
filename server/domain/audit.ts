import type { Db } from "../db/client";
import { auditLog } from "../db/schema";

/** Ações registradas na trilha de auditoria (LGPD art. 37). */
export type AuditAction =
  | "signup"
  | "account_deleted"
  | "data_exported"
  | "password_changed"
  | "password_reset"
  | "consent_updated";

/**
 * Registra uma operação sensível sobre dados pessoais. Nunca lança: a auditoria
 * não pode derrubar a ação principal (best-effort). Aceita uma transação (tx).
 */
export async function recordAudit(
  db: Db,
  entry: { userId: string | null; action: AuditAction; metadata?: Record<string, unknown>; ip?: string | null },
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    });
  } catch (err) {
    console.error("[audit]", entry.action, err instanceof Error ? err.message : err);
  }
}
