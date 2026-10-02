import { Hono } from "hono";
import type { AppEnv } from "./context";
import { createNeonDb, type DbHandle } from "./db/client";
import { createResendMailer, type Mailer } from "./email/mailer";
import type { Env } from "./env";
import { ApiError } from "./errors";
import { requireAccountAccess } from "./auth/access";
import { readSessionCookie, writeSessionCookie } from "./auth/cookies";
import { resolveSession } from "./auth/tokens";
import { accountListRoutes, accountRoutes } from "./routes/accounts";
import { authRoutes } from "./routes/auth";
import { goalRoutes } from "./routes/goals";
import { internalRoutes } from "./routes/internal";
import { investmentRoutes } from "./routes/investments";
import { accountInviteRoutes, inviteRoutes } from "./routes/invites";
import { meRoutes } from "./routes/me";
import { notificationRoutes } from "./routes/notifications";
import { settlementRoutes } from "./routes/settlements";
import { transactionRoutes } from "./routes/transactions";

export interface AppOptions {
  /** Fábrica do banco por requisição (testes injetam PGlite). */
  db?: (env: Env) => DbHandle;
  mailer?: (env: Env) => Mailer;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createApp(options: AppOptions = {}) {
  const makeDb = options.db ?? ((env: Env) => {
    if (!env.DATABASE_URL) throw new ApiError("internal", "DATABASE_URL não configurada.");
    return createNeonDb(env.DATABASE_URL);
  });
  const makeMailer = options.mailer ?? ((env: Env) => createResendMailer(env));

  const app = new Hono<AppEnv>().basePath("/api");

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      if (err.retryAfter) c.header("Retry-After", String(err.retryAfter));
      return c.json({ error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }, err.status as 400);
    }
    console.error("[api] erro inesperado", err);
    return c.json({ error: { code: "internal", message: "Algo deu errado do nosso lado. Tente de novo em instantes." } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: "not_found", message: "Rota não encontrada." } }, 404));

  // Cabeçalhos de segurança e sem cache (dados pessoais nunca vão para caches compartilhados).
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Frame-Options", "DENY");
  });

  // CSRF: além do SameSite=Lax, toda escrita precisa vir da origem do app.
  app.use("*", async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method) && !c.req.path.startsWith("/api/internal/")) {
      const origin = c.req.header("origin");
      const allowed = new Set([new URL(c.env.APP_URL).origin, new URL(c.req.url).origin]);
      if (!origin || !allowed.has(origin)) throw new ApiError("forbidden", "Origem da requisição não permitida.");
    }
    await next();
  });

  // Antes do banco: responde mesmo sem DATABASE_URL (checagem de deploy).
  app.get("/health", (c) => c.json({ ok: true }));

  // Uma conexão por requisição, fechada depois da resposta.
  app.use("*", async (c, next) => {
    const handle = makeDb(c.env);
    c.set("db", handle.db);
    c.set("mailer", makeMailer(c.env));
    try {
      await next();
    } finally {
      const closing = handle.close().catch(() => undefined);
      try { c.executionCtx.waitUntil(closing); } catch { await closing; }
    }
  });

  // Sessão (opcional): rotas que exigem login usam requireUser/requireAccountAccess.
  app.use("*", async (c, next) => {
    c.set("user", null);
    c.set("sessionId", null);
    const token = readSessionCookie(c);
    if (token) {
      const session = await resolveSession(c.get("db"), token);
      if (session) {
        c.set("user", session.user);
        c.set("sessionId", session.sessionId);
        if (session.renewedUntil) writeSessionCookie(c, token, session.renewedUntil);
      }
    }
    await next();
  });

  app.route("/auth", authRoutes);
  app.route("/me", meRoutes);
  app.route("/invites", inviteRoutes);
  app.route("/notifications", notificationRoutes);
  app.route("/internal", internalRoutes);
  app.route("/accounts", accountListRoutes);

  const scoped = new Hono<AppEnv>();
  scoped.use("*", requireAccountAccess);
  scoped.route("/", accountRoutes);
  scoped.route("/transactions", transactionRoutes);
  scoped.route("/goals", goalRoutes);
  scoped.route("/settlements", settlementRoutes);
  scoped.route("/invites", accountInviteRoutes);
  scoped.route("/investments", investmentRoutes);
  app.route("/accounts/:accountId", scoped);

  return app;
}
