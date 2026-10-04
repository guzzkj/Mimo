import type { Context } from "hono";
import type { Db } from "./db/client";
import type { Mailer } from "./email/mailer";
import type { Env } from "./env";
import type { SessionUser } from "./auth/tokens";
import type { AccountAccess } from "./auth/access";
import type { RateLimits } from "./rate-limit";
import type { Fetcher } from "./market/types";

export interface AppEnv {
  Bindings: Env;
  Variables: {
    db: Db;
    mailer: Mailer;
    user: SessionUser | null;
    sessionId: string | null;
    access: AccountAccess;
    limits: RateLimits;
    fetch: Fetcher;
  };
}

export type Ctx = Context<AppEnv>;

/**
 * Roda uma tarefa depois da resposta (ex.: enviar e-mail) sem travar a
 * requisição. Erros vão para o log; nunca para o usuário.
 * Importante: a tarefa não pode usar o banco (a conexão fecha com a resposta).
 */
export function defer(c: Ctx, task: Promise<unknown>) {
  const safe = task.catch((err) => console.error("[defer]", err instanceof Error ? err.message : err));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    // sem ExecutionContext (testes): a promise segue sozinha
  }
}
