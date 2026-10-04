import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { accounts, transactions } from "../db/schema";
import { isUniqueViolation } from "../errors";
import { setupApi } from "./harness";

let api: Awaited<ReturnType<typeof setupApi>>;
beforeAll(async () => { api = await setupApi(); });
afterAll(async () => { await api.close(); });

const tx = (over: Record<string, unknown> = {}) => ({
  type: "expense", description: "Mercado", category: "Mercado", amountCents: 38000, occurredOn: "2026-09-12", status: "paid", method: "account", ...over,
});

describe("auth", () => {
  test("signup creates a session, a solo account and sends the verification email", async () => {
    const a = api.agent();
    const res = await a.post("/auth/signup", { email: "Ana@Example.com ", password: "mimo2026casa", name: "Ana", acceptedTerms: true });
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({ email: "ana@example.com", emailVerified: false, onboarded: false });
    expect(a.cookie).toMatch(/^mimo_session=/);
    expect(res.json.user.passwordHash).toBeUndefined();
    expect(api.sent.at(-1)).toMatchObject({ to: "ana@example.com", subject: "Confirme seu e-mail no Mimo" });

    const me = await a.get("/me");
    expect(me.json.accounts).toHaveLength(1);
    expect(me.json.accounts[0]).toMatchObject({ kind: "solo", role: "owner" });

    // dados ficam bloqueados até confirmar o e-mail
    const blocked = await a.get(`/accounts/${me.json.accounts[0].id}/transactions`);
    expect(blocked.status).toBe(403);
    expect(blocked.json.error.code).toBe("email_not_verified");

    const verified = await a.post("/auth/verify-email", { token: api.lastToken("ana@example.com") });
    expect(verified.json.user.emailVerified).toBe(true);
    expect((await a.get(`/accounts/${me.json.accounts[0].id}/transactions`)).status).toBe(200);

    // o mesmo link não vale duas vezes
    expect((await a.post("/auth/verify-email", { token: api.lastToken("ana@example.com") })).status).toBe(410);
  });

  test("rejects duplicate emails and weak passwords", async () => {
    const a = api.agent();
    expect((await a.post("/auth/signup", { email: "ana@example.com", password: "mimo2026casa", acceptedTerms: true })).status).toBe(409);
    const weak = await a.post("/auth/signup", { email: "fraca@example.com", password: "semnumero", acceptedTerms: true });
    expect(weak.status).toBe(422);
    expect(weak.json.error.fields.password).toMatch(/8 caracteres/);
  });

  test("login, logout and generic error on bad credentials", async () => {
    const a = api.agent();
    expect((await a.post("/auth/login", { email: "ana@example.com", password: "errada123" })).status).toBe(401);
    expect((await a.post("/auth/login", { email: "ninguem@example.com", password: "errada123" })).json.error.message)
      .toBe("E-mail ou senha não conferem. Confira e tente de novo.");
    expect((await a.post("/auth/login", { email: "ana@example.com", password: "mimo2026casa" })).status).toBe(200);
    expect((await a.get("/me")).status).toBe(200);
    expect((await a.post("/auth/logout")).status).toBe(204);
    expect((await a.get("/me")).status).toBe(401);
  });

  test("locks login after repeated failures", async () => {
    await api.signupVerified("lock@example.com");
    const a = api.agent();
    for (let i = 0; i < 8; i++) await a.post("/auth/login", { email: "lock@example.com", password: "errada123" });
    const res = await a.post("/auth/login", { email: "lock@example.com", password: "senha-forte-1" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
  });

  test("password reset revokes old sessions", async () => {
    const { agent: old } = await api.signupVerified("reset@example.com");
    const a = api.agent();
    expect((await a.post("/auth/password/forgot", { email: "reset@example.com" })).status).toBe(202);
    // e-mail inexistente responde igual
    expect((await a.post("/auth/password/forgot", { email: "nao-existe@example.com" })).status).toBe(202);
    const token = api.lastToken("reset@example.com");
    expect((await a.post("/auth/password/reset", { token, password: "novasenha9" })).status).toBe(204);
    expect((await old.get("/me")).status).toBe(401);
    expect((await a.post("/auth/login", { email: "reset@example.com", password: "novasenha9" })).status).toBe(200);
    expect(api.sent.at(-1)?.subject).toBe("Sua senha do Mimo foi alterada");
  });

  test("CSRF: writes without the app origin are refused", async () => {
    const a = api.agent();
    const res = await a.raw("POST", "/auth/login", { email: "ana@example.com", password: "mimo2026casa" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    const form = await api.app.request("/api/auth/login", { method: "POST", headers: { origin: "http://localhost:5173", "content-type": "text/plain" }, body: "{}" }, api.env);
    expect(form.status).toBe(415);
  });
});

describe("solo transactions and isolation", () => {
  test("batch create groups installments, updates, deletes and marks paid", async () => {
    const { agent: a, solo } = await api.signupVerified("solo@example.com", { plan: "solo" });
    const base = `/accounts/${solo}/transactions`;
    const created = await a.post(`${base}/batch`, {
      create: [
        { ref: "t1", groupRef: "g", ...tx({ description: "Fone", method: "card", amountCents: 9000, installment: { number: 1, total: 2 } }) },
        { ref: "t2", groupRef: "g", ...tx({ description: "Fone", method: "card", amountCents: 9000, occurredOn: "2026-10-12", installment: { number: 2, total: 2 } }) },
        { ref: "t3", ...tx({ description: "Luz", status: "pending" }) },
      ],
    });
    expect(created.status).toBe(200);
    const [t1, t2, t3] = created.json.created.map((x: { transaction: unknown }) => x.transaction);
    expect(t1.groupId).toBeTruthy();
    expect(t2.groupId).toBe(t1.groupId);
    expect(t3.groupId).toBeNull();

    const upd = await a.post(`${base}/batch`, { update: [{ id: t3.id, amountCents: 14000 }], delete: [t2.id] });
    expect(upd.json.updated[0].amountCents).toBe(14000);
    expect((await a.post(`${base}/mark-paid`, { ids: [t3.id] })).json.transactions[0].status).toBe("paid");

    const list = await a.get(`${base}?from=2026-09-01&to=2026-12-31`);
    expect(list.json.transactions.map((t: { id: number }) => t.id)).toEqual([t1.id, t3.id]);

    // desfazer a exclusão da parcela mantém o grupo; grupo desconhecido vira um novo
    const redo = await a.post(`${base}/batch`, {
      create: [
        { ref: "back", groupId: t1.groupId, ...tx({ description: "Fone", method: "card", amountCents: 9000, occurredOn: "2026-10-12", installment: { number: 2, total: 2 } }) },
        { ref: "alien", groupId: 987654, ...tx() },
      ],
    });
    expect(redo.json.created[0].transaction.groupId).toBe(t1.groupId);
    expect(redo.json.created[1].transaction.groupId).not.toBe(987654);
  });

  test("invalid batches roll back entirely", async () => {
    const { agent: a, solo } = await api.signupVerified("rollback@example.com");
    const base = `/accounts/${solo}/transactions`;
    const bad = await a.post(`${base}/batch`, { create: [{ ref: "ok", ...tx() }], delete: [999999] });
    expect(bad.status).toBe(404);
    expect((await a.get(base)).json.transactions).toHaveLength(0);
  });

  test("another user cannot see or touch the account", async () => {
    const owner = await api.signupVerified("dono@example.com");
    const intruder = await api.signupVerified("intruso@example.com");
    const created = await owner.agent.post(`/accounts/${owner.solo}/transactions`, tx());
    expect(created.status).toBe(201);
    const id = created.json.transaction.id;
    expect((await intruder.agent.get(`/accounts/${owner.solo}/transactions`)).status).toBe(404);
    expect((await intruder.agent.patch(`/accounts/${owner.solo}/transactions/${id}`, { amountCents: 1 })).status).toBe(404);
    // id de outra conta pela conta do próprio intruso também não funciona
    expect((await intruder.agent.patch(`/accounts/${intruder.solo}/transactions/${id}`, { amountCents: 1 })).status).toBe(404);
    expect((await intruder.agent.get(`/accounts/${owner.solo}/settings`)).status).toBe(404);
  });

  test("settings: account values and personal prefs", async () => {
    const { agent: a, solo } = await api.signupVerified("ajustes@example.com");
    const res = await a.patch(`/accounts/${solo}/settings`, {
      spendingLimitCents: 250000, budgetsCents: { Mercado: 40000 }, card: { dueDay: 15 }, alerts: { email: true }, startHidden: true,
    });
    expect(res.json).toMatchObject({ spendingLimitCents: 250000, budgetsCents: { Mercado: 40000 }, card: { closingDay: 3, dueDay: 15 }, startHidden: true });
    expect(res.json.alerts).toMatchObject({ email: true, bills: true });
    expect((await a.patch(`/accounts/${solo}/settings`, { unknownField: 1 })).status).toBe(422);
  });
});

describe("duo", () => {
  test("invite, accept, privacy, split settlement and goals", async () => {
    const gus = await api.signupVerified("gustavo@example.com", { name: "Gustavo", plan: "duo", incomeCents: 620000 });
    expect(gus.duo).toBeTruthy();
    const duoBase = `/accounts/${gus.duo}`;

    // não convida a si mesmo
    expect((await gus.agent.post(`${duoBase}/invites`, { email: "gustavo@example.com" })).status).toBe(422);
    const inv = await gus.agent.post(`${duoBase}/invites`, { email: "suelen@example.com", message: "Bora?" });
    expect(inv.status).toBe(201);
    const inviteToken = api.lastToken("suelen@example.com");
    expect(api.sent.at(-1)?.subject).toBe("Gustavo convidou você para o Mimo Duo");

    // prévia pública não expõe o e-mail inteiro
    const preview = await api.agent().get(`/invites/preview?token=${inviteToken}`);
    expect(preview.json).toMatchObject({ inviterName: "Gustavo", status: "pending", expired: false });
    expect(preview.json.emailMasked).not.toContain("suelen@");

    // outra pessoa com o link não entra
    const other = await api.signupVerified("outra@example.com");
    expect((await other.agent.post("/invites/accept", { token: inviteToken })).status).toBe(403);

    const su = await api.signupVerified("suelen@example.com", { name: "Suelen" });
    const accepted = await su.agent.post("/invites/accept", { token: inviteToken });
    expect(accepted.status).toBe(200);
    expect(accepted.json.accountId).toBe(gus.duo);
    expect(api.sent.at(-1)?.subject).toBe("Suelen aceitou o convite do Mimo Duo");
    expect((await su.agent.post("/invites/accept", { token: inviteToken })).status).toBe(409);

    const settings = await gus.agent.get(`${duoBase}/settings`);
    expect(settings.json.partner).toMatchObject({ name: "Suelen" });

    // privado da Suelen: Gustavo vê só o valor e não consegue mexer
    const priv = await su.agent.post(`${duoBase}/transactions`, tx({ description: "Livro", category: "Educação", amountCents: 7400, isPrivate: true }));
    expect(priv.status).toBe(201);
    const list = await gus.agent.get(`${duoBase}/transactions`);
    const seen = list.json.transactions.find((t: { id: number }) => t.id === priv.json.transaction.id);
    expect(seen).toMatchObject({ description: "Lançamento privado", category: "Privado", amountCents: 7400, redacted: true });
    expect((await gus.agent.patch(`${duoBase}/transactions/${seen.id}`, { amountCents: 1 })).status).toBe(403);
    expect((await gus.agent.del(`${duoBase}/transactions/${seen.id}`)).status).toBe(403);
    expect((await gus.agent.post(`${duoBase}/transactions/mark-paid`, { ids: [seen.id] })).status).toBe(403);

    // conta conjunta nunca é privada; Gustavo não marca lançamento da Suelen como privado
    expect((await gus.agent.post(`${duoBase}/transactions`, tx({ authorUserId: null, isPrivate: true }))).status).toBe(422);
    const shared = await su.agent.post(`${duoBase}/transactions`, tx({ split: true }));
    expect(shared.json.transaction).toMatchObject({ split: true, authorUserId: su.user.id });
    expect((await gus.agent.patch(`${duoBase}/transactions/${shared.json.transaction.id}`, { isPrivate: true })).status).toBe(403);

    // acerto
    const st = await gus.agent.post(`${duoBase}/settlements`, { month: "2026-09", paidOn: "2026-09-30", fromUserId: gus.user.id, toUserId: su.user.id, amountCents: 19000 });
    expect(st.status).toBe(201);
    expect((await su.agent.get(`${duoBase}/settlements?month=2026-09`)).json.settlements).toHaveLength(1);
    expect((await gus.agent.post(`${duoBase}/settlements`, { month: "2026-09", paidOn: "2026-09-30", fromUserId: gus.user.id, toUserId: other.user.id, amountCents: 1 })).status).toBe(422);
    expect((await gus.agent.get(`/accounts/${gus.solo}/settlements`)).status).toBe(409);

    // meta com itens + aporte que cruza marcos avisa os dois
    const goal = await gus.agent.post(`${duoBase}/goals`, {
      name: "Montar a casa", icon: "casa", deadlineMonth: "2027-06",
      items: [{ name: "Geladeira", valueCents: 489900 }, { name: "Fogão", valueCents: 169900 }],
      initialContributions: [{ amountCents: 100000 }, { userId: su.user.id, amountCents: 50000 }],
    });
    expect(goal.status).toBe(201);
    expect(goal.json.goal).toMatchObject({ targetCents: 659800, savedCents: 150000, deadlineMonth: "2027-06" });
    const contrib = await su.agent.post(`${duoBase}/goals/${goal.json.goal.id}/contributions`, { amountCents: 200000, contributedOn: "2026-09-30", note: "Freela" });
    expect(contrib.json.milestones).toEqual([25, 50]);
    const bell = await gus.agent.get(`/notifications?accountId=${gus.duo}`);
    expect(bell.json.notifications.some((n: { title: string }) => n.title === "Montar a casa passou de 50%")).toBe(true);
    // outro membro não aporta em nome de estranho
    expect((await su.agent.post(`${duoBase}/goals/${goal.json.goal.id}/contributions`, { amountCents: 1, contributedOn: "2026-09-30", userId: other.user.id })).status).toBe(422);

    // itens substituídos recalculam o alvo
    const items = await gus.agent.put(`${duoBase}/goals/${goal.json.goal.id}/items`, { items: [{ name: "Geladeira", valueCents: 400000 }] });
    expect(items.json.goal.targetCents).toBe(400000);

    // recibos de avisos calculados no app
    expect((await gus.agent.put("/notifications/receipts", { accountId: gus.duo, key: "auto-conta-1", dismissed: true })).status).toBe(204);
    expect((await gus.agent.get(`/notifications?accountId=${gus.duo}`)).json.receipts).toEqual([{ key: "auto-conta-1", read: false, dismissed: true }]);
    expect((await other.agent.put("/notifications/receipts", { accountId: gus.duo, key: "x", read: true })).status).toBe(404);

    // desvincular: conta fica só leitura
    expect((await su.agent.post(`${duoBase}/unlink`)).status).toBe(200);
    expect((await gus.agent.get(`${duoBase}/transactions`)).status).toBe(200);
    expect((await gus.agent.post(`${duoBase}/transactions`, tx())).status).toBe(409);
    expect((await gus.agent.get("/me")).json.user.plan).toBe("solo");
  });

  test("accepting an invite closes the invitee's own Duo that has no partner yet", async () => {
    const inviter = await api.signupVerified("conv-a@example.com", { name: "A", plan: "duo" });
    await inviter.agent.post(`/accounts/${inviter.duo}/invites`, { email: "conv-b@example.com" });
    const token = api.lastToken("conv-b@example.com");
    // B escolheu Duo no onboarding (conta Duo vazia) e só depois foi aceitar
    const b = await api.signupVerified("conv-b@example.com", { name: "B", plan: "duo" });
    expect(b.duo).toBeTruthy();
    expect(b.duo).not.toBe(inviter.duo);
    const res = await b.agent.post("/invites/accept", { token });
    expect(res.status).toBe(200);
    const accounts = res.json.accounts as { id: string; kind: string; closed: boolean }[];
    expect(accounts.find((a) => a.id === b.duo)?.closed).toBe(true);
    expect(accounts.find((a) => a.id === inviter.duo)?.closed).toBe(false);
  });

  test("unlinking a Duo revokes its pending invite", async () => {
    const owner = await api.signupVerified("unl-a@example.com", { name: "A", plan: "duo" });
    await owner.agent.post(`/accounts/${owner.duo}/invites`, { email: "unl-b@example.com" });
    const token = api.lastToken("unl-b@example.com");
    expect((await owner.agent.post(`/accounts/${owner.duo}/unlink`)).status).toBe(200);
    expect((await api.agent().get(`/invites/preview?token=${token}`)).json.status).toBe("revoked");
    const b = await api.signupVerified("unl-b@example.com", { name: "B" });
    expect((await b.agent.get("/me")).json.pendingInvites).toEqual([]);
    expect((await b.agent.post("/invites/accept", { token })).status).toBe(410);
  });

  test("deleting an account removes private entries from the shared account", async () => {
    const a = await api.signupVerified("del-a@example.com", { name: "A", plan: "duo" });
    await a.agent.post(`/accounts/${a.duo}/invites`, { email: "del-b@example.com" });
    const token = api.lastToken("del-b@example.com");
    const b = await api.signupVerified("del-b@example.com", { name: "B" });
    await b.agent.post("/invites/accept", { token });
    await b.agent.post(`/accounts/${a.duo}/transactions`, tx({ isPrivate: true }));
    await b.agent.post(`/accounts/${a.duo}/transactions`, tx({ description: "Compartilhada" }));
    expect((await b.agent.del("/me", { password: "errada" })).status).toBe(422);
    expect((await b.agent.del("/me", { password: "senha-forte-1" })).status).toBe(204);
    const left = (await a.agent.get(`/accounts/${a.duo}/transactions`)).json.transactions;
    expect(left.map((t: { description: string }) => t.description)).toEqual(["Compartilhada"]);
  });

  test("plan follows the Duo link: Solo while the invite is pending, Duo for both once accepted", async () => {
    const a = await api.signupVerified("plano-a@example.com", { name: "A", plan: "duo" });
    // escolheu Duo no onboarding: a conta do casal existe, mas segue no Solo até o par aceitar
    expect(a.duo).toBeTruthy();
    expect(a.user.plan).toBe("solo");
    const asked = await a.agent.post("/me/plan", { plan: "duo" });
    expect(asked.status).toBe(200);
    expect(asked.json.user.plan).toBe("solo");

    await a.agent.post(`/accounts/${a.duo}/invites`, { email: "plano-b@example.com" });
    const inviteToken = api.lastToken("plano-b@example.com");
    const b = await api.signupVerified("plano-b@example.com", { name: "B" });
    expect((await b.agent.post("/invites/accept", { token: inviteToken })).status).toBe(200);
    expect((await a.agent.get("/me")).json.user.plan).toBe("duo");
    expect((await b.agent.get("/me")).json.user.plan).toBe("duo");

    // com par vinculado não dá para "fugir" para o Solo: só desvinculando
    const escape = await a.agent.post("/me/plan", { plan: "solo" });
    expect(escape.status).toBe(409);
    expect((await a.agent.get("/me")).json.user.plan).toBe("duo");
    expect((await a.agent.post(`/accounts/${a.duo}/unlink`)).status).toBe(200);
    expect((await b.agent.get("/me")).json.user.plan).toBe("solo");
  });

  test("deleting an account unlinks the Duo and sends the partner back to Solo", async () => {
    const a = await api.signupVerified("exc-a@example.com", { name: "A", plan: "duo" });
    await a.agent.post(`/accounts/${a.duo}/invites`, { email: "exc-b@example.com" });
    const inviteToken = api.lastToken("exc-b@example.com");
    const b = await api.signupVerified("exc-b@example.com", { name: "B" });
    await b.agent.post("/invites/accept", { token: inviteToken });
    expect((await b.agent.del("/me", { password: "senha-forte-1" })).status).toBe(204);
    const me = (await a.agent.get("/me")).json;
    expect(me.user.plan).toBe("solo");
    expect(me.accounts.find((x: { id: string }) => x.id === a.duo)?.closed).toBe(true);
    const bell = await a.agent.get(`/notifications?accountId=${a.duo}`);
    expect(bell.json.notifications.some((n: { title: string }) => n.title === "B excluiu a conta no Mimo")).toBe(true);
  });

  test("brings the Solo history into the Duo as private entries, only once", async () => {
    const a = await api.signupVerified("hist-a@example.com", { name: "A", plan: "duo" });
    // antes do par aceitar não há o que trazer
    expect((await a.agent.get("/me/solo-history")).status).toBe(409);
    await a.agent.post(`/accounts/${a.solo}/transactions`, tx({ description: "Academia", category: "Saúde" }));
    await a.agent.post(`/accounts/${a.solo}/transactions/batch`, { create: [
      { ...tx({ description: "TV 1/2", amountCents: 50000, installment: { number: 1, total: 2 } }), ref: "p1", groupRef: "g" },
      { ...tx({ description: "TV 2/2", amountCents: 50000, occurredOn: "2026-10-12", installment: { number: 2, total: 2 } }), ref: "p2", groupRef: "g" },
    ] });
    await a.agent.post(`/accounts/${a.duo}/invites`, { email: "hist-b@example.com" });
    const inviteToken = api.lastToken("hist-b@example.com");
    const b = await api.signupVerified("hist-b@example.com", { name: "B" });
    await b.agent.post("/invites/accept", { token: inviteToken });

    expect((await a.agent.get("/me/solo-history")).json).toMatchObject({ soloAccountId: a.solo, total: 3, pending: 3 });
    const first = await a.agent.post("/me/solo-history/import");
    expect(first.json).toMatchObject({ imported: 3, total: 3, pending: 0 });
    expect((await a.agent.post("/me/solo-history/import")).json.imported).toBe(0);

    const mine = (await a.agent.get(`/accounts/${a.duo}/transactions`)).json.transactions as { description: string; isPrivate: boolean; split: boolean; authorUserId: string; groupId: number | null }[];
    expect(mine).toHaveLength(3);
    expect(mine.every((t) => t.isPrivate && !t.split && t.authorUserId === a.user.id)).toBe(true);
    const tv = mine.filter((t) => t.description.startsWith("TV"));
    expect(tv[0].groupId).toBeTruthy();
    expect(tv[0].groupId).toBe(tv[1].groupId);
    // o par vê só valores, sem detalhes
    const seen = (await b.agent.get(`/accounts/${a.duo}/transactions`)).json.transactions as { description: string; redacted: boolean }[];
    expect(seen.every((t) => t.redacted && t.description === "Lançamento privado")).toBe(true);
    // a conta Solo continua como estava
    expect((await a.agent.get(`/accounts/${a.solo}/transactions`)).json.transactions).toHaveLength(3);
  });

  test("never opens a second Duo for the same person, even on racing requests", async () => {
    const a = await api.signupVerified("dup-a@example.com", { name: "A" });

    // dez POST /me/plan=duo concorrentes: sem a trava, o "verifica e cria"
    // abria várias contas Duo; agora o índice parcial garante uma só.
    const racers = await Promise.all(Array.from({ length: 10 }, () => a.agent.post("/me/plan", { plan: "duo" })));
    for (const r of racers) expect(r.status).toBe(200);

    const openDuos = (r: { json: { accounts: { kind: string; closed: boolean }[] } }) =>
      r.json.accounts.filter((x) => x.kind === "duo" && !x.closed);
    expect(openDuos(await a.agent.get("/me") as never)).toHaveLength(1);

    // desvincular e voltar para Duo reaproveita/abre uma única conta aberta
    const duo = (await a.agent.get("/me")).json.accounts.find((x: { kind: string; closed: boolean }) => x.kind === "duo" && !x.closed).id;
    expect((await a.agent.post(`/accounts/${duo}/unlink`)).status).toBe(200);
    await a.agent.post("/me/plan", { plan: "duo" });
    expect(openDuos(await a.agent.get("/me") as never)).toHaveLength(1);
  });

  test("the partial unique index blocks a second open Duo for the same creator at the DB level", async () => {
    const a = await api.signupVerified("idx-a@example.com", { name: "A", plan: "duo" });
    const ownerId = a.user.id as string;

    // inserir uma segunda Duo aberta para o mesmo criador deve bater no índice
    let violated = false;
    try {
      await api.db.insert(accounts).values({ kind: "duo", createdBy: ownerId });
    } catch (err) {
      violated = isUniqueViolation(err);
    }
    expect(violated).toBe(true);

    // ...mas fechar a primeira libera abrir outra
    await api.db.update(accounts).set({ closedAt: new Date() }).where(eq(accounts.id, a.duo));
    await expect(api.db.insert(accounts).values({ kind: "duo", createdBy: ownerId })).resolves.toBeDefined();
  });
});

describe("internal reminders", () => {
  test("requires the cron secret and emails each opted-in member once per day", async () => {
    const r = await api.signupVerified("lembrete@example.com");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    await r.agent.post(`/accounts/${r.solo}/transactions`, tx({ description: "Conta de luz", status: "pending", occurredOn: today }));
    await r.agent.patch(`/accounts/${r.solo}/settings`, { alerts: { email: true } });

    const call = (secret?: string) => api.app.request("/api/internal/reminders", { method: "POST", headers: secret ? { authorization: `Bearer ${secret}` } : {} }, api.env);
    expect((await call()).status).toBe(404);
    expect((await call("errado")).status).toBe(404);
    const first = await (await call("segredo-de-teste")).json() as { sent: number };
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(api.sent.some((m) => m.to === "lembrete@example.com" && m.subject.includes("Conta de luz"))).toBe(true);
    const again = await (await call("segredo-de-teste")).json() as { sent: number };
    expect(again.sent).toBe(0);
  });

  test("skips the parked Solo account of someone in a linked Duo", async () => {
    const a = await api.signupVerified("lemb-duo-a@example.com", { name: "A", plan: "duo" });
    await a.agent.post(`/accounts/${a.duo}/invites`, { email: "lemb-duo-b@example.com" });
    const inviteToken = api.lastToken("lemb-duo-b@example.com");
    const b = await api.signupVerified("lemb-duo-b@example.com", { name: "B" });
    await b.agent.post("/invites/accept", { token: inviteToken });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    // conta no Solo lançada antes, e outra na Duo
    await api.db.insert(transactions).values({ accountId: a.solo, type: "expense", description: "Conta Solo parada", category: "Casa", amountCents: 100, occurredOn: today, status: "pending", method: "account", authorUserId: a.user.id });
    await a.agent.post(`/accounts/${a.duo}/transactions`, tx({ description: "Aluguel do casal", status: "pending", occurredOn: today }));
    await a.agent.patch(`/accounts/${a.solo}/settings`, { alerts: { email: true } });
    await a.agent.patch(`/accounts/${a.duo}/settings`, { alerts: { email: true } });

    await api.app.request("/api/internal/reminders", { method: "POST", headers: { authorization: "Bearer segredo-de-teste" } }, api.env);
    const mine = api.sent.filter((m) => m.to === "lemb-duo-a@example.com");
    expect(mine.some((m) => m.subject.includes("Aluguel do casal"))).toBe(true);
    expect(mine.some((m) => m.subject.includes("Conta Solo parada"))).toBe(false);
  });
});
