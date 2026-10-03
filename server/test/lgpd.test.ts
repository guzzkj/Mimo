import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog, users } from "../db/schema";
import { setupApi } from "./harness";

let api: Awaited<ReturnType<typeof setupApi>>;
beforeAll(async () => { api = await setupApi(); });
afterAll(async () => { await api.close(); });

describe("LGPD", () => {
  test("signup requires accepting terms and records version + timestamp", async () => {
    const a = api.agent();
    const semAceite = await a.post("/auth/signup", { email: "sem-aceite@example.com", password: "senha-forte-1" });
    expect(semAceite.status).toBe(422);
    expect(semAceite.json.error.fields.acceptedTerms).toBeTruthy();

    const ok = await a.post("/auth/signup", { email: "aceite@example.com", password: "senha-forte-1", acceptedTerms: true });
    expect(ok.status).toBe(201);
    const [row] = await api.db.select().from(users).where(eq(users.email, "aceite@example.com")).limit(1);
    expect(row.termsAcceptedAt).toBeInstanceOf(Date);
    expect(row.termsVersion).toBeTruthy();
    expect(row.privacyAcceptedAt).toBeInstanceOf(Date);

    const audit = await api.db.select().from(auditLog).where(eq(auditLog.userId, row.id));
    expect(audit.some((e) => e.action === "signup")).toBe(true);
  });

  test("optional marketing consent is separate and defaults to false", async () => {
    const a = api.agent();
    await a.post("/auth/signup", { email: "consent@example.com", password: "senha-forte-1", acceptedTerms: true });
    const before = await a.get("/me/consents");
    expect(before.json.consents).toMatchObject({ marketing: false, analytics: false });

    const after = await a.put("/me/consents", { marketing: true, analytics: true });
    expect(after.json.consents).toMatchObject({ marketing: true, analytics: true });

    // revogação (art. 18, IX)
    const revoked = await a.put("/me/consents", { marketing: false });
    expect(revoked.json.consents).toMatchObject({ marketing: false, analytics: true });
  });

  test("data export returns the subject's personal data as JSON", async () => {
    const { agent, solo } = await api.signupVerified("export@example.com", { plan: "solo", name: "Expo" });
    await agent.post(`/accounts/${solo}/transactions`, {
      type: "expense", description: "Padaria", category: "Mercado", amountCents: 1200, occurredOn: "2026-09-10", status: "paid", method: "account",
    });
    const res = await agent.get("/me/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    expect(res.json.profile.email).toBe("export@example.com");
    expect(Array.isArray(res.json.transactions)).toBe(true);
    expect(res.json.transactions.some((t: { description: string }) => t.description === "Padaria")).toBe(true);
    expect(res.json.profile.passwordHash).toBeUndefined();
  });

  test("account deletion keeps an audit record (user_id set null)", async () => {
    const { agent, user } = await api.signupVerified("apagar@example.com", { plan: "solo" });
    const del = await agent.del("/me", { password: "senha-forte-1" });
    expect(del.status).toBe(204);
    const [gone] = await api.db.select().from(users).where(eq(users.id, user.id)).limit(1);
    expect(gone).toBeUndefined();
    const audit = await api.db.select().from(auditLog).where(eq(auditLog.action, "account_deleted"));
    expect(audit.length).toBeGreaterThan(0);
  });
});
