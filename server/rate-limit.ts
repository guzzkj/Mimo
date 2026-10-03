import { lt, sql } from "drizzle-orm";
import type { Ctx } from "./context";
import type { Db } from "./db/client";
import { rateLimits } from "./db/schema";
import { ApiError } from "./errors";
import { sha256Hex } from "./auth/crypto";

// Rate limit da aplicação, guardado no Postgres: isolates do Workers não
// compartilham memória, então um Map em memória não seguraria nada.
// Janela fixa por chave: o primeiro hit abre a janela; ao vencer, recomeça.
// Complementa (não substitui) as regras de rate limiting do WAF da Cloudflare.

export interface Limit {
  max: number;
  windowSeconds: number;
}

export const DEFAULT_LIMITS = {
  /** Cadastros por IP. */
  signupPerIp: { max: 5, windowSeconds: 60 * 60 },
  /** Convites criados/reenviados por conta Duo. */
  invitePerAccount: { max: 10, windowSeconds: 60 * 60 },
  /** Convites criados/reenviados por IP (todas as contas). */
  invitePerIp: { max: 20, windowSeconds: 60 * 60 },
  /** Pedidos de redefinição de senha por IP (429). */
  forgotPerIp: { max: 5, windowSeconds: 15 * 60 },
  /** E-mails de redefinição por endereço (silencioso: resposta continua 202). */
  forgotPerEmail: { max: 5, windowSeconds: 60 * 60 },
  /** Reenvios do e-mail de confirmação por IP. */
  verifyResendPerIp: { max: 5, windowSeconds: 15 * 60 },
  /** Reenvios do e-mail de confirmação por pessoa (o endereço pode ser de terceiros). */
  verifyResendPerUser: { max: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, Limit>;

export type RateLimits = { [K in keyof typeof DEFAULT_LIMITS]: Limit };

/** Remove janelas vencidas há mais de um dia (a maior janela é de 1h). */
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * IP do cliente. Na Cloudflare, `cf-connecting-ip` é definido pela borda.
 * IPv6 vira o prefixo /64 (uma conexão doméstica costuma ter um /64 inteiro).
 * Sem o cabeçalho (dev local), tudo cai em "unknown".
 */
export function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const raw = c.req.header("cf-connecting-ip")?.trim().toLowerCase();
  if (!raw) return "unknown";
  return raw.includes(":") ? ipv6Prefix(raw) : raw;
}

export function ipv6Prefix(ip: string): string {
  const addr = ip.split("%")[0];
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  let parts: string[];
  if (addr.includes("::")) {
    const [head, tail] = addr.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    parts = [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  } else {
    parts = addr.split(":");
  }
  const groups = parts.slice(0, 4).map((p) => parseInt(p || "0", 16));
  if (groups.length < 4 || groups.some((g) => Number.isNaN(g) || g > 0xffff)) return addr;
  return `${groups.map((g) => g.toString(16)).join(":")}::/64`;
}

/**
 * Conta um hit na chave e diz se ainda está dentro do limite. Atômico:
 * um único INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
 */
export async function consume(db: Db, bucket: string, subject: string, limit: Limit): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `${bucket}:${(await sha256Hex(subject)).slice(0, 40)}`;
  const window = sql`(${limit.windowSeconds}::int * interval '1 second')`;
  const expired = sql`${rateLimits.windowStart} <= now() - ${window}`;
  const [row] = await db.insert(rateLimits).values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfter: sql<number>`greatest(1, ceil(extract(epoch from (${rateLimits.windowStart} + ${window} - now()))))::int`,
    });
  return { allowed: row.count <= limit.max, retryAfter: Number(row.retryAfter) };
}

export const TOO_MANY = "Muitas tentativas. Espere alguns minutos e tente de novo.";

/** Consome e responde 429 (com Retry-After) se passou do limite. */
export async function enforce(c: Ctx, bucket: keyof RateLimits, subject: string, message = TOO_MANY): Promise<void> {
  const { allowed, retryAfter } = await consume(c.get("db"), bucket, subject, c.get("limits")[bucket]);
  if (!allowed) throw new ApiError("too_many_requests", message, { retryAfter });
}

/** Apaga contadores antigos (chamado pelo job diário em /internal/reminders). */
export async function pruneRateLimits(db: Db, now = new Date()): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - RATE_LIMIT_RETENTION_MS)));
}
