import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { accountMembers, accounts, transactions } from "../db/schema";
import { nextGroupId } from "./groups";

// Histórico do Solo de quem entrou numa Duo. A conta Solo fica guardada como
// estava (volta a valer se a Duo for desfeita); a pessoa pode trazer as
// movimentações para a Duo como lançamentos privados dela: o par vê só o
// valor nos totais, sem descrição nem categoria.

const CHUNK = 500;

export async function findOpenSoloAccount(db: Db, userId: string) {
  const [row] = await db.select({ id: accounts.id })
    .from(accountMembers)
    .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
    .where(and(eq(accountMembers.userId, userId), eq(accounts.kind, "solo"), isNull(accounts.closedAt)))
    .limit(1);
  return row?.id ?? null;
}

/** Ids do Solo que já têm cópia na Duo. */
async function alreadyImported(db: Db, duoId: string) {
  const rows = await db.select({ from: transactions.importedFrom }).from(transactions)
    .where(and(eq(transactions.accountId, duoId), isNotNull(transactions.importedFrom)));
  return new Set(rows.map((r) => r.from!));
}

export async function soloHistoryStatus(db: Db, soloId: string, duoId: string) {
  const [all, done] = await Promise.all([
    db.select({ id: transactions.id }).from(transactions).where(eq(transactions.accountId, soloId)),
    alreadyImported(db, duoId),
  ]);
  return { total: all.length, pending: all.filter((r) => !done.has(r.id)).length };
}

/** Copia para a Duo o que ainda não foi trazido. Devolve quantas entraram. */
export async function importSoloHistory(db: Db, userId: string, soloId: string, duoId: string) {
  return db.transaction(async (tx) => {
    const done = await alreadyImported(tx, duoId);
    const rows = (await tx.select().from(transactions).where(eq(transactions.accountId, soloId))
      .orderBy(asc(transactions.occurredOn), asc(transactions.id)))
      .filter((r) => !done.has(r.id));
    if (!rows.length) return 0;

    // parcelas e recorrências continuam ligadas entre si, num grupo novo
    const groups = new Map<number, number>();
    for (const r of rows) if (r.groupId != null && !groups.has(r.groupId)) groups.set(r.groupId, await nextGroupId(tx));

    const values = rows.map((r) => ({
      accountId: duoId, createdBy: userId, authorUserId: userId,
      type: r.type, description: r.description, category: r.category, amountCents: r.amountCents,
      occurredOn: r.occurredOn, status: r.status, method: r.method,
      groupId: r.groupId != null ? groups.get(r.groupId)! : null,
      installmentNumber: r.installmentNumber, installmentTotal: r.installmentTotal, recurring: r.recurring,
      isPrivate: true, split: false, importedFrom: r.id,
    }));
    let imported = 0;
    for (let i = 0; i < values.length; i += CHUNK) {
      // índice único (conta, importedFrom): dois cliques simultâneos não duplicam
      const saved = await tx.insert(transactions).values(values.slice(i, i + CHUNK)).onConflictDoNothing().returning({ id: transactions.id });
      imported += saved.length;
    }
    return imported;
  });
}
