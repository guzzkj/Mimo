import { lt, or, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailTokens, loginAttempts, sessions } from "../db/schema";

// Minimização e retenção (LGPD art. 15/16): dado pessoal não fica além do
// necessário. Executado pela faxina diária (/internal/reminders).

/** Tentativas de login (e-mail + IP) são mantidas por este prazo. */
export const LOGIN_ATTEMPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Remove sessões já expiradas. */
export async function pruneExpiredSessions(db: Db, now = new Date()): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}

/** Remove tokens de e-mail já usados ou expirados. */
export async function pruneEmailTokens(db: Db, now = new Date()): Promise<void> {
  await db.delete(emailTokens).where(or(lt(emailTokens.expiresAt, now), sql`${emailTokens.usedAt} is not null`));
}

/** Remove tentativas de login antigas (dado pessoal: e-mail + IP). */
export async function pruneLoginAttempts(db: Db, now = new Date()): Promise<void> {
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_MS)));
}

/** Roda todas as faxinas de retenção. */
export async function pruneExpiredData(db: Db, now = new Date()): Promise<void> {
  await pruneExpiredSessions(db, now);
  await pruneEmailTokens(db, now);
  await pruneLoginAttempts(db, now);
}
