import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { accountMembers, accounts, invites, users } from "../db/schema";
import { defaultAccountSettings } from "./settings";

type UserRow = typeof users.$inferSelect;

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    monthlyIncomeCents: u.monthlyIncomeCents,
    plan: u.plan,
    emailVerified: Boolean(u.emailVerifiedAt),
    onboarded: Boolean(u.onboardedAt),
    createdAt: u.createdAt.toISOString(),
  };
}
export type UserDto = ReturnType<typeof toUserDto>;

/** Contas de que a pessoa participa, com os membros de cada uma. */
export async function listAccountsFor(db: Db, userId: string) {
  const mine = await db.select({ accountId: accountMembers.accountId, role: accountMembers.role })
    .from(accountMembers).where(eq(accountMembers.userId, userId));
  if (!mine.length) return [];
  const ids = mine.map((m) => m.accountId);
  const rows = await db
    .select({ account: accounts, userId: accountMembers.userId, role: accountMembers.role, name: users.name, avatar: users.avatar })
    .from(accountMembers)
    .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
    .innerJoin(users, eq(users.id, accountMembers.userId))
    .where(inArray(accountMembers.accountId, ids))
    .orderBy(asc(accounts.createdAt), asc(accountMembers.joinedAt));
  const byId = new Map<string, { id: string; kind: "solo" | "duo"; role: "owner" | "partner"; closed: boolean; createdAt: string; members: { userId: string; name: string; avatar: number; role: "owner" | "partner"; isMe: boolean }[] }>();
  for (const r of rows) {
    let entry = byId.get(r.account.id);
    if (!entry) {
      entry = {
        id: r.account.id, kind: r.account.kind, role: mine.find((m) => m.accountId === r.account.id)!.role,
        closed: Boolean(r.account.closedAt), createdAt: r.account.createdAt.toISOString(), members: [],
      };
      byId.set(r.account.id, entry);
    }
    entry.members.push({ userId: r.userId, name: r.name, avatar: r.avatar, role: r.role, isMe: r.userId === userId });
  }
  return [...byId.values()];
}
export type AccountSummary = Awaited<ReturnType<typeof listAccountsFor>>[number];

/** Conta Duo aberta em que a pessoa está (no máximo uma). */
export async function findOpenDuoAccount(db: Db, userId: string) {
  const [row] = await db.select({ id: accounts.id })
    .from(accountMembers)
    .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
    .where(and(eq(accountMembers.userId, userId), eq(accounts.kind, "duo"), isNull(accounts.closedAt)))
    .limit(1);
  return row?.id ?? null;
}

/** Cancela o convite pendente de uma conta (no máximo um, pelo índice parcial). */
export async function revokePendingInvites(db: Db, accountId: string) {
  await db.update(invites).set({ status: "revoked", respondedAt: new Date() })
    .where(and(eq(invites.accountId, accountId), eq(invites.status, "pending")));
}

/** Cria uma conta e coloca a pessoa como dona. */
export async function createAccount(db: Db, kind: "solo" | "duo", ownerId: string) {
  const [account] = await db.insert(accounts).values({ kind, createdBy: ownerId, settings: defaultAccountSettings(kind) }).returning();
  await db.insert(accountMembers).values({ accountId: account.id, userId: ownerId, role: "owner" });
  return account;
}
