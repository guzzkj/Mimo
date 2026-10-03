import { and, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { defer, type AppEnv } from "../context";
import { loginAttempts, sessions, users } from "../db/schema";
import { ApiError, isUniqueViolation } from "../errors";
import { emailSchema, passwordSchema, readJson } from "../http";
import { currentUser, requireUser } from "../auth/access";
import { clearSessionCookie, writeSessionCookie } from "../auth/cookies";
import { getDummyHash, hashPassword, verifyPassword } from "../auth/crypto";
import {
  consumeEmailToken, createSession, deleteSession, deleteUserSessions, emailCooldown, issueEmailToken,
} from "../auth/tokens";
import { passwordChangedMessage, resetPasswordMessage, verifyEmailMessage } from "../email/templates";
import { createAccount, toUserDto } from "../domain/users";
import { clientIp, consume, enforce } from "../rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const VERIFY_RESEND_SECONDS = 30;
const RESET_RESEND_SECONDS = 42;

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(60).optional(),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Digite sua senha.").max(128) });
const tokenSchema = z.object({ token: z.string().min(10).max(100) });
const forgotSchema = z.object({ email: emailSchema });
const resetSchema = z.object({ token: z.string().min(10).max(100), password: passwordSchema });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

export const authRoutes = new Hono<AppEnv>()
  .post("/signup", async (c) => {
    const body = await readJson(c, signupSchema);
    // conta toda tentativa (inclusive e-mail repetido): freia spam de e-mails de confirmação
    await enforce(c, "signupPerIp", clientIp(c), "Muitos cadastros a partir desta rede. Tente de novo mais tarde.");
    const db = c.get("db");
    const duplicate = () => new ApiError("conflict", "Já existe uma conta com este e-mail. Tente entrar.", { fields: { email: "Já existe uma conta com este e-mail." } });
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists) throw duplicate();

    const passwordHash = await hashPassword(body.password);
    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ email: body.email, passwordHash, name: body.name ?? "" }).returning();
      // toda pessoa tem uma conta Solo; a Duo nasce no onboarding ou ao aceitar convite
      await createAccount(tx, "solo", created.id);
      return created;
    }).catch((err: unknown) => {
      // dois cadastros simultâneos com o mesmo e-mail: o segundo esbarra no índice único
      throw isUniqueViolation(err) ? duplicate() : err;
    });

    const session = await createSession(db, user.id, c.req.header("user-agent"));
    writeSessionCookie(c, session.token, session.expiresAt);

    const token = await issueEmailToken(db, user.id, "verify_email");
    const url = `${c.env.APP_URL}/acesso/verificar?token=${encodeURIComponent(token)}`;
    defer(c, c.get("mailer").send({ to: user.email, ...verifyEmailMessage(user.name, url) }));

    return c.json({ user: toUserDto(user) }, 201);
  })

  .post("/login", async (c) => {
    const body = await readJson(c, loginSchema);
    const db = c.get("db");
    const since = new Date(Date.now() - LOGIN_WINDOW_MS);
    const [{ failures }] = await db.select({ failures: sql<number>`count(*)::int` }).from(loginAttempts)
      .where(and(eq(loginAttempts.email, body.email), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
    if (failures >= LOGIN_MAX_FAILURES) {
      throw new ApiError("too_many_requests", "Muitas tentativas. Espere alguns minutos ou redefina a senha.", { retryAfter: LOGIN_WINDOW_MS / 1000 });
    }

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    // mesmo sem usuário, roda o PBKDF2: o tempo de resposta não revela quem tem conta
    const ok = await verifyPassword(body.password, user?.passwordHash ?? await getDummyHash());
    await db.insert(loginAttempts).values({ email: body.email, ip: clientIp(c), success: Boolean(user && ok) });
    if (!user || !ok) throw new ApiError("unauthenticated", "E-mail ou senha não conferem. Confira e tente de novo.");

    const session = await createSession(db, user.id, c.req.header("user-agent"));
    writeSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user: toUserDto(user) });
  })

  .post("/logout", async (c) => {
    const sessionId = c.get("sessionId");
    if (sessionId) await deleteSession(c.get("db"), sessionId);
    clearSessionCookie(c);
    return c.body(null, 204);
  })

  .post("/verify-email", async (c) => {
    const { token } = await readJson(c, tokenSchema);
    const db = c.get("db");
    const userId = await consumeEmailToken(db, token, "verify_email");
    if (!userId) throw new ApiError("gone", "Este link expirou ou já foi usado. Peça um novo e-mail de confirmação.");
    const [user] = await db.update(users).set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
      .where(eq(users.id, userId)).returning();
    return c.json({ user: toUserDto(user) });
  })

  .post("/verify-email/resend", requireUser, async (c) => {
    const user = currentUser(c);
    if (user.emailVerifiedAt) return c.body(null, 204);
    const db = c.get("db");
    const wait = await emailCooldown(db, user.id, "verify_email", VERIFY_RESEND_SECONDS);
    if (wait > 0) throw new ApiError("too_many_requests", `Espere ${wait}s para reenviar.`, { retryAfter: wait });
    await enforce(c, "verifyResendPerIp", clientIp(c));
    await enforce(c, "verifyResendPerUser", user.id, "Você já pediu vários e-mails de confirmação. Espere um pouco antes de pedir outro.");
    const token = await issueEmailToken(db, user.id, "verify_email");
    const url = `${c.env.APP_URL}/acesso/verificar?token=${encodeURIComponent(token)}`;
    defer(c, c.get("mailer").send({ to: user.email, ...verifyEmailMessage(user.name, url) }));
    return c.body(null, 204);
  })

  .post("/password/forgot", async (c) => {
    const { email } = await readJson(c, forgotSchema);
    // por IP responde 429 (vale igual para qualquer e-mail, não revela cadastro)
    await enforce(c, "forgotPerIp", clientIp(c));
    const db = c.get("db");
    // por endereço é silencioso: barra a inundação de uma caixa a partir de vários IPs
    const perEmail = await consume(db, "forgotPerEmail", email, c.get("limits").forgotPerEmail);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // resposta igual com ou sem conta: não revela quais e-mails estão cadastrados
    if (user && perEmail.allowed && (await emailCooldown(db, user.id, "reset_password", RESET_RESEND_SECONDS)) === 0) {
      const token = await issueEmailToken(db, user.id, "reset_password");
      const url = `${c.env.APP_URL}/acesso/redefinir?token=${encodeURIComponent(token)}`;
      defer(c, c.get("mailer").send({ to: user.email, ...resetPasswordMessage(url) }));
    }
    return c.body(null, 202);
  })

  .post("/password/reset", async (c) => {
    const body = await readJson(c, resetSchema);
    const db = c.get("db");
    const userId = await consumeEmailToken(db, body.token, "reset_password");
    if (!userId) throw new ApiError("gone", "Este link expirou ou já foi usado. Peça um novo.");
    const passwordHash = await hashPassword(body.password);
    // o link chegou na caixa de entrada: o e-mail também fica confirmado
    const [user] = await db.update(users)
      .set({ passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
      .where(eq(users.id, userId)).returning();
    await deleteUserSessions(db, userId);
    clearSessionCookie(c);
    defer(c, c.get("mailer").send({ to: user.email, ...passwordChangedMessage(c.env.APP_URL) }));
    return c.body(null, 204);
  })

  .post("/password/change", requireUser, async (c) => {
    const body = await readJson(c, changePasswordSchema);
    const user = currentUser(c);
    const db = c.get("db");
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new ApiError("validation_failed", "A senha atual não confere.", { fields: { currentPassword: "A senha atual não confere." } });
    }
    await db.update(users).set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() }).where(eq(users.id, user.id));
    // encerra as outras sessões; a atual continua
    const current = c.get("sessionId");
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), current ? sql`${sessions.id} <> ${current}` : sql`true`));
    defer(c, c.get("mailer").send({ to: user.email, ...passwordChangedMessage(c.env.APP_URL) }));
    return c.body(null, 204);
  });
