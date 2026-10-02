import { createApp } from "../app";
import { createMemoryMailer } from "../email/mailer";
import type { Env } from "../env";
import { createTestDb } from "./db";

export const ORIGIN = "http://localhost:5173";

export async function setupApi() {
  const { db, close } = await createTestDb();
  const { mailer, sent } = createMemoryMailer();
  const app = createApp({ db: () => ({ db, close: async () => {} }), mailer: () => mailer });
  const env: Env = { DATABASE_URL: "", EMAIL_FROM: "Mimo <teste@mimo.test>", APP_URL: ORIGIN, APP_ENV: "development", CRON_SECRET: "segredo-de-teste" };

  /** Cliente com "pote de cookies" próprio, como um navegador. */
  const agent = () => {
    let cookie = "";
    const request = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
      const res = await app.request(`/api${path}`, {
        method,
        headers: {
          ...(method === "GET" ? {} : { origin: ORIGIN }),
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }, env);
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const [pair] = setCookie.split(";");
        cookie = pair.endsWith("=") ? "" : pair;
      }
      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = text ? JSON.parse(text) : null;
      return { status: res.status, json, headers: res.headers };
    };
    return {
      get: (path: string) => request("GET", path),
      post: (path: string, body?: unknown, headers?: Record<string, string>) => request("POST", path, body ?? {}, headers),
      patch: (path: string, body: unknown) => request("PATCH", path, body),
      put: (path: string, body: unknown) => request("PUT", path, body),
      del: (path: string, body?: unknown) => request("DELETE", path, body),
      raw: request,
      get cookie() { return cookie; },
    };
  };

  /** Último link enviado para o e-mail (token do link). */
  const lastToken = (to: string) => {
    const msg = [...sent].reverse().find((m) => m.to === to);
    const match = msg?.text.match(/token=([A-Za-z0-9_-]+)/);
    if (!match) throw new Error(`nenhum link enviado para ${to}`);
    return match[1];
  };

  /** Cadastra, confirma o e-mail e (opcional) faz o onboarding. */
  const signupVerified = async (email: string, opts: { name?: string; plan?: "solo" | "duo"; incomeCents?: number } = {}) => {
    const a = agent();
    const res = await a.post("/auth/signup", { email, password: "senha-forte-1", name: opts.name });
    if (res.status !== 201) throw new Error(`signup falhou: ${JSON.stringify(res.json)}`);
    await a.post("/auth/verify-email", { token: lastToken(email) });
    if (opts.plan) await a.post("/me/onboarding", { plan: opts.plan, name: opts.name ?? "Pessoa", monthlyIncomeCents: opts.incomeCents ?? 500000 });
    const me = await a.get("/me");
    const accountOf = (kind: "solo" | "duo") => me.json.accounts.find((x: { kind: string }) => x.kind === kind)?.id as string;
    return { agent: a, user: me.json.user, solo: accountOf("solo"), duo: accountOf("duo") };
  };

  return { app, env, db, sent, close, agent, lastToken, signupVerified };
}
