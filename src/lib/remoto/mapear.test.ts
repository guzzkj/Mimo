import { describe, expect, test } from "vitest";
import type { Item } from "../../types";
import { diffItens, paraAjustes, paraEntrada, paraItem, separarPatchAjustes, type ContextoPessoas } from "./mapear";
import type { AjustesApi, MovimentacaoApi } from "./tipos";

const ME = "me-id";
const PAR = "par-id";
const duo: ContextoPessoas = { duo: true, meId: ME, parId: PAR };
const solo: ContextoPessoas = { duo: false, meId: ME, parId: null };

const api = (over: Partial<MovimentacaoApi> = {}): MovimentacaoApi => ({
  id: 10, type: "expense", description: "Mercado", category: "Mercado", amountCents: 41280, occurredOn: "2026-09-23",
  status: "paid", method: "card", groupId: null, installment: null, recurring: false, authorUserId: ME, isPrivate: false,
  split: true, redacted: false, ...over,
});

describe("paraItem / paraEntrada", () => {
  test("maps cents, enums and the duo author slots", () => {
    expect(paraItem(api(), duo)).toEqual({
      id: 10, tipo: "saida", descricao: "Mercado", categoria: "Mercado", valor: 412.8, data: "2026-09-23", status: "pago",
      meio: "cartao", quem: "gustavo", dividir: true,
    });
    expect(paraItem(api({ authorUserId: PAR }), duo).quem).toBe("suelen");
    expect(paraItem(api({ authorUserId: null }), duo).quem).toBe("conjunta");
    expect(paraItem(api(), solo).quem).toBeUndefined();
  });

  test("round-trips back to the API shape", () => {
    const item = paraItem(api({ installment: { number: 2, total: 5 }, groupId: 4 }), duo);
    expect(paraEntrada(item, duo)).toMatchObject({ amountCents: 41280, method: "card", installment: { number: 2, total: 5 }, authorUserId: ME, split: true });
    expect(paraEntrada({ ...item, quem: "suelen" }, duo).authorUserId).toBe(PAR);
    expect(paraEntrada({ ...item, quem: "conjunta" }, duo).authorUserId).toBeNull();
    // sem par, lançamento "da parceira" fica com quem lançou
    expect(paraEntrada({ ...item, quem: "suelen" }, { ...duo, parId: null }).authorUserId).toBe(ME);
  });

  test("avoids float drift when converting to cents", () => {
    expect(paraEntrada({ ...paraItem(api(), solo), valor: 0.1 + 0.2 }, solo).amountCents).toBe(30);
  });
});

const item = (id: number, over: Partial<Item> = {}): Item => ({
  id, tipo: "saida", descricao: "x", categoria: "Outros", valor: 10, data: "2026-09-01", status: "pago", ...over,
});

describe("diffItens", () => {
  test("detects creates, updates and deletes", () => {
    const antes = [item(1), item(2), item(3)];
    const depois = [item(1), item(2, { valor: 20 }), item(-1)];
    const d = diffItens(antes, depois, solo);
    expect(d.criar.map((i) => i.id)).toEqual([-1]);
    expect(d.atualizar.map((i) => i.id)).toEqual([2]);
    expect(d.excluir).toEqual([3]);
  });

  test("ignores changes the server would not store", () => {
    // meio "conta" explícito ou ausente é a mesma coisa para o servidor
    expect(diffItens([item(1)], [item(1, { meio: "conta" })], solo).atualizar).toHaveLength(0);
  });

  test("never sends the partner's private entries", () => {
    const privado = item(5, { quem: "suelen", privado: true });
    const d = diffItens([privado], [{ ...privado, status: "pendente" }], duo);
    expect(d.atualizar).toHaveLength(0);
    expect(diffItens([privado], [], duo).excluir).toHaveLength(0);
  });
});

describe("ajustes", () => {
  const a: AjustesApi = {
    accountId: "acc", kind: "duo", closed: false, spendingLimitCents: 600000, customCategories: [{ name: "Pets", color: "#d98a5f" }],
    budgetsCents: { Lazer: 80000 }, card: { closingDay: 3, dueDay: 10 }, leisureMode: "half", leisurePending: true,
    alerts: { bills: true, billsDaysAhead: 3, limit: true, limitThreshold: "80", goals: true, email: false, partner: true },
    startHidden: false, me: { userId: ME, name: "Gu", email: "g@x.com", avatar: 2, monthlyIncomeCents: 620000 },
    partner: { userId: PAR, name: "Su", avatar: 1, monthlyIncomeCents: 540000 },
  };

  test("maps the API settings into the app's Ajustes", () => {
    expect(paraAjustes(a)).toMatchObject({
      nome: "Gu", renda: 6200, limite: 6000, rendaParceira: 5400, orcamentos: { Lazer: 800 },
      categorias: [{ nome: "Pets", cor: "#d98a5f" }], cartao: { fecha: 3, vence: 10 }, lazerModo: "metade",
      avisos: { conta: true, contaDias: 3, limiteQuando: "80" },
    });
  });

  test("splits a patch into profile and account parts", () => {
    const { perfil, conta } = separarPatchAjustes({ nome: " Ana ", renda: 3200.5, limite: 2000, orcamentos: { Lazer: 150, Mercado: 0 }, rendaParceira: 9 });
    expect(perfil).toEqual({ name: "Ana", monthlyIncomeCents: 320050 });
    expect(conta).toEqual({ spendingLimitCents: 200000, budgetsCents: { Lazer: 15000 } });
  });
});
