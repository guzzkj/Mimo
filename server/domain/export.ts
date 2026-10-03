import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  accountMembers, accounts, consents, goalContributions, investments,
  notifications, sessions, settlements, transactions, users,
} from "../db/schema";

/**
 * Portabilidade dos dados (LGPD art. 18, V e art. 19, II): devolve, em JSON, os
 * dados pessoais da pessoa — perfil, consentimentos, sessões (só metadados), e,
 * em cada conta de que participa, o que ela mesma registrou. Não inclui dados
 * privados do par numa conta Duo.
 */
export async function exportUserData(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const memberships = await db.select().from(accountMembers).where(eq(accountMembers.userId, userId));
  const accountIds = memberships.map((m) => m.accountId);

  const [myConsents, mySessions, accountRows, myTransactions, myContributions, myInvestments, myNotifications, mySettlements] =
    await Promise.all([
      db.select({ purpose: consents.purpose, granted: consents.granted, version: consents.version, updatedAt: consents.updatedAt })
        .from(consents).where(eq(consents.userId, userId)),
      db.select({ userAgent: sessions.userAgent, expiresAt: sessions.expiresAt, createdAt: sessions.createdAt })
        .from(sessions).where(eq(sessions.userId, userId)),
      accountIds.length ? db.select().from(accounts).where(inArray(accounts.id, accountIds)) : Promise.resolve([]),
      accountIds.length ? db.select().from(transactions).where(inArray(transactions.accountId, accountIds)).then((rows) => rows.filter((r) => r.authorUserId === userId || r.createdBy === userId)) : Promise.resolve([]),
      db.select().from(goalContributions).where(eq(goalContributions.userId, userId)),
      accountIds.length ? db.select().from(investments).where(inArray(investments.accountId, accountIds)).then((rows) => rows.filter((r) => r.ownerUserId === userId)) : Promise.resolve([]),
      db.select().from(notifications).where(eq(notifications.userId, userId)),
      accountIds.length ? db.select().from(settlements).where(inArray(settlements.accountId, accountIds)).then((rows) => rows.filter((r) => r.fromUserId === userId || r.toUserId === userId)) : Promise.resolve([]),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id, email: user.email, name: user.name, avatar: user.avatar,
      monthlyIncomeCents: user.monthlyIncomeCents, plan: user.plan,
      emailVerifiedAt: user.emailVerifiedAt, onboardedAt: user.onboardedAt,
      termsAcceptedAt: user.termsAcceptedAt, termsVersion: user.termsVersion,
      privacyAcceptedAt: user.privacyAcceptedAt, privacyVersion: user.privacyVersion,
      createdAt: user.createdAt,
    },
    consents: myConsents,
    sessions: mySessions,
    accounts: accountRows,
    transactions: myTransactions,
    goalContributions: myContributions,
    investments: myInvestments,
    settlements: mySettlements,
    notifications: myNotifications,
  };
}
