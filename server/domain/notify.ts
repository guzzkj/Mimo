import type { Db } from "../db/client";
import { notifications } from "../db/schema";

export interface NewNotification {
  userId: string;
  accountId?: string | null;
  kind: "invite" | "invite_accepted" | "invite_declined" | "goal" | "partner" | "bills";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Mesmo dedupeKey para o mesmo usuário = aviso não se repete. */
  dedupeKey?: string;
}

/** Cria avisos ignorando os já existentes (pela chave de deduplicação). Devolve os criados. */
export async function notify(db: Db, list: NewNotification[]) {
  if (!list.length) return [];
  return db.insert(notifications)
    .values(list.map((n) => ({ ...n, accountId: n.accountId ?? null, data: n.data ?? {}, dedupeKey: n.dedupeKey ?? null })))
    .onConflictDoNothing()
    .returning();
}
