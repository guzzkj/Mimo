import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailTokens, sessions, users } from "../db/schema";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Renova a sessão quando faltar menos que isto (sessão deslizante). */
const SESSION_RENEW_MS = 15 * 24 * 60 * 60 * 1000;

export const TOKEN_TTL_MS = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
} as const;
export type TokenPurpose = keyof typeof TOKEN_TTL_MS;

export type SessionUser = typeof users.$inferSelect;

export async function createSession(db: Db, userId: string, userAgent?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: await sha256Hex(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null });
  return { token, expiresAt };
}

/** Valida o token do cookie. Devolve o usuário e, se renovou, a nova expiração. */
export async function resolveSession(db: Db, token: string): Promise<{ user: SessionUser; sessionId: string; renewedUntil: Date | null } | null> {
  if (!token || token.length > 100) return null;
  const id = await sha256Hex(token);
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  let renewedUntil: Date | null = null;
  if (row.expiresAt.getTime() - Date.now() < SESSION_RENEW_MS) {
    renewedUntil = new Date(Date.now() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id));
  }
  return { user: row.user, sessionId: id, renewedUntil };
}

export async function deleteSession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteUserSessions(db: Db, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Cria um token de e-mail de uso único; invalida os anteriores do mesmo tipo. */
export async function issueEmailToken(db: Db, userId: string, purpose: TokenPurpose) {
  const token = randomToken();
  await db.update(emailTokens).set({ usedAt: new Date() })
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt)));
  await db.insert(emailTokens).values({
    userId, purpose, tokenHash: await sha256Hex(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  });
  return token;
}

/** Consome o token (uma vez só). Devolve o id do usuário, ou null se inválido/expirado/usado. */
export async function consumeEmailToken(db: Db, token: string, purpose: TokenPurpose): Promise<string | null> {
  if (!token || token.length > 100) return null;
  const [row] = await db.update(emailTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(emailTokens.tokenHash, await sha256Hex(token)),
      eq(emailTokens.purpose, purpose),
      isNull(emailTokens.usedAt),
      gt(emailTokens.expiresAt, new Date()),
    ))
    .returning({ userId: emailTokens.userId });
  return row?.userId ?? null;
}

/** Segundos até poder reenviar (cooldown entre e-mails do mesmo tipo). */
export async function emailCooldown(db: Db, userId: string, purpose: TokenPurpose, seconds: number): Promise<number> {
  const [last] = await db.select({ createdAt: emailTokens.createdAt }).from(emailTokens)
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose)))
    .orderBy(desc(emailTokens.createdAt)).limit(1);
  if (!last) return 0;
  const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
  return elapsed >= seconds ? 0 : Math.ceil(seconds - elapsed);
}
