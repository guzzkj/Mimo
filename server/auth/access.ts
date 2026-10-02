import { asc, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { AppEnv, Ctx } from "../context";
import type { Db } from "../db/client";
import { accountMembers, accounts, users } from "../db/schema";
import { ApiError } from "../errors";
import { param } from "../http";
import { resolveMemberPrefs, type ResolvedMemberPrefs } from "../domain/settings";

// Isolamento por usuário (o equivalente às policies de RLS): toda rota sob
// /accounts/:accountId passa por aqui. Quem não é membro recebe 404 (não
// revela que a conta existe), e cada query seguinte filtra por account_id.

export interface AccountMember {
  userId: string;
  role: "owner" | "partner";
  name: string;
  email: string;
  avatar: number;
  monthlyIncomeCents: number;
  prefs: ResolvedMemberPrefs;
}

export interface AccountAccess {
  account: typeof accounts.$inferSelect;
  me: AccountMember;
  members: AccountMember[];
  /** O par (Duo), se já entrou. */
  partner: AccountMember | null;
  isMember: (userId: string) => boolean;
}

export async function loadAccess(db: Db, accountId: string, userId: string): Promise<AccountAccess | null> {
  const rows = await db
    .select({
      account: accounts,
      userId: accountMembers.userId,
      role: accountMembers.role,
      prefs: accountMembers.prefs,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      monthlyIncomeCents: users.monthlyIncomeCents,
    })
    .from(accountMembers)
    .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
    .innerJoin(users, eq(users.id, accountMembers.userId))
    .where(eq(accountMembers.accountId, accountId))
    .orderBy(asc(accountMembers.joinedAt));
  const members: AccountMember[] = rows.map((r) => ({
    userId: r.userId, role: r.role, name: r.name, email: r.email, avatar: r.avatar,
    monthlyIncomeCents: r.monthlyIncomeCents, prefs: resolveMemberPrefs(r.prefs),
  }));
  const me = members.find((m) => m.userId === userId);
  if (!me || !rows[0]) return null;
  const ids = new Set(members.map((m) => m.userId));
  return {
    account: rows[0].account,
    me,
    members,
    partner: members.find((m) => m.userId !== userId) ?? null,
    isMember: (id) => ids.has(id),
  };
}

/** Exige sessão + e-mail verificado + participação na conta do parâmetro :accountId. */
export const requireAccountAccess = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new ApiError("unauthenticated", "Entre na sua conta para continuar.");
  if (!user.emailVerifiedAt) throw new ApiError("email_not_verified", "Confirme seu e-mail para continuar.");
  const accountId = param(c, "accountId");
  const access = await loadAccess(c.get("db"), accountId, user.id);
  if (!access) throw new ApiError("not_found", "Conta não encontrada.");
  // conta Duo desfeita: o histórico continua legível, mas nada muda mais
  if (access.account.closedAt && !["GET", "HEAD"].includes(c.req.method)) {
    throw new ApiError("conflict", "Esta conta Duo foi encerrada. O histórico fica só para consulta.");
  }
  c.set("access", access);
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) throw new ApiError("unauthenticated", "Entre na sua conta para continuar.");
  await next();
});

export const requireVerifiedUser = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new ApiError("unauthenticated", "Entre na sua conta para continuar.");
  if (!user.emailVerifiedAt) throw new ApiError("email_not_verified", "Confirme seu e-mail para continuar.");
  await next();
});

/** Usuário da sessão (só chamar depois de requireUser/requireAccountAccess). */
export function currentUser(c: Ctx) {
  const user = c.get("user");
  if (!user) throw new ApiError("unauthenticated", "Entre na sua conta para continuar.");
  return user;
}
