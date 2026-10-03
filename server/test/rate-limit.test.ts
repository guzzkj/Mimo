import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { emailTokens, rateLimits } from "../db/schema";
import { DEFAULT_LIMITS, clientIp, consume, ipv6Prefix, pruneRateLimits } from "../rate-limit";
import { setupApi } from "./harness";

let api: Awaited<ReturnType<typeof setupApi>>;
beforeAll(async () => { api = await setupApi(); });
afterAll(async () => { await api.close(); });

const ip = (value: string | undefined) => clientIp({ req: { header: (n: string) => (n === "cf-connecting-ip" ? value : undefined) } });

describe("rate limit helpers", () => {
  test("client IP: IPv4 as is, IPv6 grouped by /64, fallback without header", () => {
    expect(ip("203.0.113.7")).toBe("203.0.113.7");
    expect(ip("2001:DB8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(ip("2001:db8:abcd:12::99")).toBe("2001:db8:abcd:12::/64");
    expect(ipv6Prefix("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ip("::ffff:198.51.100.4")).toBe("198.51.100.4");
    expect(ip(undefined)).toBe("unknown");
  });

  test("fixed window: blocks past the max, reopens after the window, prunes old rows", async () => {
    const limit = { max: 2, windowSeconds: 60 };
    expect((await consume(api.db, "t", "subject", limit)).allowed).toBe(true);
    expect((await consume(api.db, "t", "subject", limit)).allowed).toBe(true);
    const blocked = await consume(api.db, "t", "subject", limit);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
    // outro sujeito tem contador próprio
    expect((await consume(api.db, "t", "other", limit)).allowed).toBe(true);

    // janela vencida: recomeça do 1
    await api.db.update(rateLimits).set({ windowStart: sql`now() - interval '2 minutes'` }).where(sql`${rateLimits.key} like 't:%'`);
    expect((await consume(api.db, "t", "subject", limit)).allowed).toBe(true);

    await api.db.update(rateLimits).set({ windowStart: sql`now() - interval '2 days'` }).where(sql`${rateLimits.key} like 't:%'`);
    await pruneRateLimits(api.db);
    const [{ n }] = await api.db.select({ n: sql<number>`count(*)::int` }).from(rateLimits).where(sql`${rateLimits.key} like 't:%'`);
    expect(n).toBe(0);
  });

  test("the counter key never stores the raw subject (IP/e-mail)", async () => {
    await consume(api.db, "t2", "203.0.113.99", { max: 5, windowSeconds: 60 });
    const rows = await api.db.select().from(rateLimits).where(sql`${rateLimits.key} like 't2:%'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).not.toContain("203.0.113.99");
  });
});

describe("signup rate limit (F-02)", () => {
  test(`blocks the ${DEFAULT_LIMITS.signupPerIp.max + 1}th signup from the same IP with 429 + Retry-After`, async () => {
    const max = DEFAULT_LIMITS.signupPerIp.max;
    for (let i = 0; i < max; i++) {
      const res = await api.agent({ ip: "198.51.100.10" }).post("/auth/signup", { email: `bomb${i}@example.com`, password: "senha-forte-1" });
      expect(res.status).toBe(201);
    }
    const sentBefore = api.sent.length;
    const res = await api.agent({ ip: "198.51.100.10" }).post("/auth/signup", { email: "bomb-extra@example.com", password: "senha-forte-1" });
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe("too_many_requests");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(res.headers.get("retry-after"))).toBeLessThanOrEqual(DEFAULT_LIMITS.signupPerIp.windowSeconds);
    expect(api.sent.length).toBe(sentBefore); // nenhum e-mail saiu

    // outra rede segue livre
    expect((await api.agent({ ip: "198.51.100.11" }).post("/auth/signup", { email: "bomb-extra@example.com", password: "senha-forte-1" })).status).toBe(201);
  });

  test("duplicate-email attempts also count (enumeration is throttled too)", async () => {
    const a = () => api.agent({ ip: "198.51.100.20" });
    for (let i = 0; i < DEFAULT_LIMITS.signupPerIp.max; i++) {
      expect((await a().post("/auth/signup", { email: "bomb0@example.com", password: "senha-forte-1" })).status).toBe(409);
    }
    expect((await a().post("/auth/signup", { email: "bomb0@example.com", password: "senha-forte-1" })).status).toBe(429);
  });
});

describe("invite rate limit (F-02)", () => {
  test(`blocks the ${DEFAULT_LIMITS.invitePerAccount.max + 1}th invite send for the same Duo account, counting resends`, async () => {
    const owner = await api.signupVerified("inv-owner@example.com", { plan: "duo", name: "Dona" });
    const max = DEFAULT_LIMITS.invitePerAccount.max;
    for (let i = 0; i < max; i++) {
      const res = await owner.agent.post(`/accounts/${owner.duo}/invites`, { email: `victim${i}@example.com` });
      expect(res.status).toBe(201);
    }
    const sentBefore = api.sent.length;
    const res = await owner.agent.post(`/accounts/${owner.duo}/invites`, { email: "victim-extra@example.com" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(api.sent.length).toBe(sentBefore);

    // trocar de IP não ajuda: o limite também é por conta
    const other = await owner.agent.raw("POST", `/accounts/${owner.duo}/invites`, { email: "victim-extra@example.com" }, { "cf-connecting-ip": "192.0.2.200" });
    expect(other.status).toBe(429);
  });

  test("per-IP invite limit spans accounts", async () => {
    const limited = await setupApi({ limits: { invitePerIp: { max: 2, windowSeconds: 3600 } } });
    try {
      const a = await limited.signupVerified("ip-a@example.com", { plan: "duo" });
      const b = await limited.signupVerified("ip-b@example.com", { plan: "duo" });
      const shared = { "cf-connecting-ip": "192.0.2.50" };
      expect((await a.agent.raw("POST", `/accounts/${a.duo}/invites`, { email: "x1@example.com" }, shared)).status).toBe(201);
      expect((await b.agent.raw("POST", `/accounts/${b.duo}/invites`, { email: "x2@example.com" }, shared)).status).toBe(201);
      expect((await b.agent.raw("POST", `/accounts/${b.duo}/invites`, { email: "x3@example.com" }, shared)).status).toBe(429);
      // a mesma conta, de outra rede, ainda envia
      expect((await b.agent.post(`/accounts/${b.duo}/invites`, { email: "x3@example.com" })).status).toBe(201);
    } finally {
      await limited.close();
    }
  });
});

describe("password reset / verification resend limits (F-04)", () => {
  test(`forgot: ${DEFAULT_LIMITS.forgotPerIp.max + 1}th request from the same IP gets 429, for any e-mail`, async () => {
    const a = api.agent({ ip: "203.0.113.30" });
    for (let i = 0; i < DEFAULT_LIMITS.forgotPerIp.max; i++) {
      // mistura e-mails com e sem conta: o limite não revela cadastro
      expect((await a.post("/auth/password/forgot", { email: i % 2 ? "bomb0@example.com" : `ghost${i}@example.com` })).status).toBe(202);
    }
    const res = await a.post("/auth/password/forgot", { email: "ghost-extra@example.com" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(res.headers.get("retry-after"))).toBeLessThanOrEqual(DEFAULT_LIMITS.forgotPerIp.windowSeconds);
    expect((await api.agent({ ip: "203.0.113.31" }).post("/auth/password/forgot", { email: "ghost-extra@example.com" })).status).toBe(202);
  });

  test("forgot: per-address cap stays silent (202) and sends nothing", async () => {
    const limited = await setupApi({ limits: { forgotPerEmail: { max: 0, windowSeconds: 3600 } } });
    try {
      await limited.signupVerified("cap@example.com");
      const before = limited.sent.length;
      const res = await limited.agent().post("/auth/password/forgot", { email: "cap@example.com" });
      expect(res.status).toBe(202);
      expect(limited.sent.length).toBe(before);
    } finally {
      await limited.close();
    }
  });

  const ageVerifyTokens = () => api.db.update(emailTokens).set({ createdAt: sql`now() - interval '1 hour'` });

  test(`verify resend: ${DEFAULT_LIMITS.verifyResendPerUser.max + 1}th resend for the same person gets 429`, async () => {
    const a = api.agent();
    expect((await a.post("/auth/signup", { email: "resend-user@example.com", password: "senha-forte-1" })).status).toBe(201);
    for (let i = 0; i < DEFAULT_LIMITS.verifyResendPerUser.max; i++) {
      await ageVerifyTokens(); // pula o cooldown de 30s
      expect((await a.raw("POST", "/auth/verify-email/resend", {}, { "cf-connecting-ip": `203.0.113.${100 + i}` })).status).toBe(204);
    }
    await ageVerifyTokens();
    const res = await a.raw("POST", "/auth/verify-email/resend", {}, { "cf-connecting-ip": "203.0.113.120" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  test(`verify resend: ${DEFAULT_LIMITS.verifyResendPerIp.max + 1}th resend from the same IP gets 429 across people`, async () => {
    const agents = [];
    for (let i = 0; i <= DEFAULT_LIMITS.verifyResendPerIp.max; i++) {
      const a = api.agent();
      expect((await a.post("/auth/signup", { email: `resend-ip${i}@example.com`, password: "senha-forte-1" })).status).toBe(201);
      agents.push(a);
    }
    await ageVerifyTokens();
    const shared = { "cf-connecting-ip": "203.0.113.200" };
    for (const a of agents.slice(0, -1)) expect((await a.raw("POST", "/auth/verify-email/resend", {}, shared)).status).toBe(204);
    expect((await agents.at(-1)!.raw("POST", "/auth/verify-email/resend", {}, shared)).status).toBe(429);
  });
});
