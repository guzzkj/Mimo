import type { Autor, Item } from "../../types";
import type { Ajustes } from "../ajustes";
import type { AjustesApi, MovimentacaoApi, MovimentacaoEntrada } from "./tipos";

// Conversões puras entre o formato da API (inglês, centavos, ids reais) e os
// tipos que as telas já usam (português, reais, Autor "gustavo/suelen/conjunta").
// No Duo, "gustavo" é sempre quem está logado e "suelen" é o par: as telas
// continuam iguais e o servidor guarda o id de verdade de cada pessoa.

export interface ContextoPessoas {
  duo: boolean;
  meId: string;
  parId: string | null;
}

export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const paraReais = (centavos: number) => centavos / 100;

export function autorDe(authorUserId: string | null, ctx: ContextoPessoas): Autor {
  if (authorUserId === null) return "conjunta";
  return authorUserId === ctx.meId ? "gustavo" : "suelen";
}

export function autorParaId(quem: Autor | undefined, ctx: ContextoPessoas): string | null {
  if (quem === "conjunta") return null;
  // sem par ainda, o lançamento fica com quem lançou
  if (quem === "suelen") return ctx.parId ?? ctx.meId;
  return ctx.meId;
}

export function paraItem(m: MovimentacaoApi, ctx: ContextoPessoas): Item {
  const item: Item = {
    id: m.id,
    tipo: m.type === "income" ? "entrada" : "saida",
    descricao: m.description,
    categoria: m.category,
    valor: paraReais(m.amountCents),
    data: m.occurredOn,
    status: m.status === "paid" ? "pago" : "pendente",
  };
  if (m.type === "expense") item.meio = m.method === "card" ? "cartao" : "conta";
  if (m.groupId != null) item.grupo = m.groupId;
  if (m.installment) item.parcela = { n: m.installment.number, total: m.installment.total };
  if (m.recurring) item.recorrente = true;
  if (ctx.duo) {
    item.quem = autorDe(m.authorUserId, ctx);
    if (m.isPrivate) item.privado = true;
    if (m.split) item.dividir = true;
  }
  return item;
}

/** Campos que o servidor guarda; dois itens com a mesma projeção não precisam de sincronia. */
export function paraEntrada(i: Item, ctx: ContextoPessoas): MovimentacaoEntrada {
  return {
    type: i.tipo === "entrada" ? "income" : "expense",
    description: i.descricao,
    category: i.categoria,
    amountCents: paraCentavos(i.valor),
    occurredOn: i.data,
    status: i.status === "pago" ? "paid" : "pending",
    method: i.tipo === "saida" && i.meio === "cartao" ? "card" : "account",
    installment: i.parcela ? { number: i.parcela.n, total: i.parcela.total } : null,
    recurring: Boolean(i.recorrente),
    authorUserId: ctx.duo ? autorParaId(i.quem, ctx) : ctx.meId,
    isPrivate: ctx.duo && Boolean(i.privado),
    split: ctx.duo && Boolean(i.dividir),
  };
}

export interface DiffItens {
  criar: Item[];
  atualizar: Item[];
  excluir: number[];
}

/**
 * O que mudou entre a última lista enviada e a atual. Item sem par na lista
 * anterior é criação (inclusive o "desfazer" de uma exclusão); lançamento
 * privado do par nunca é enviado (o servidor recusaria).
 */
export function diffItens(antes: Item[], depois: Item[], ctx: ContextoPessoas): DiffItens {
  const anterior = new Map(antes.map((i) => [i.id, i]));
  const atual = new Set(depois.map((i) => i.id));
  const doPar = (i: Item) => ctx.duo && Boolean(i.privado) && i.quem === "suelen";
  const igual = (a: Item, b: Item) => JSON.stringify(paraEntrada(a, ctx)) === JSON.stringify(paraEntrada(b, ctx));
  const criar: Item[] = [];
  const atualizar: Item[] = [];
  for (const i of depois) {
    const velho = anterior.get(i.id);
    if (!velho) criar.push(i);
    else if (!doPar(velho) && !igual(velho, i)) atualizar.push(i);
  }
  const excluir = antes.filter((i) => !atual.has(i.id) && !doPar(i)).map((i) => i.id);
  return { criar, atualizar, excluir };
}

export const diffVazio = (d: DiffItens) => !d.criar.length && !d.atualizar.length && !d.excluir.length;

// ---- ajustes -------------------------------------------------------------------------

export function paraAjustes(a: AjustesApi): Ajustes {
  return {
    nome: a.me.name,
    email: a.me.email,
    avatar: a.me.avatar,
    renda: paraReais(a.me.monthlyIncomeCents),
    limite: paraReais(a.spendingLimitCents),
    categorias: a.customCategories.map((c) => ({ nome: c.name, cor: c.color })),
    orcamentos: Object.fromEntries(Object.entries(a.budgetsCents).map(([k, v]) => [k, paraReais(v)])),
    cartao: { fecha: a.card.closingDay, vence: a.card.dueDay },
    avisos: {
      conta: a.alerts.bills,
      contaDias: a.alerts.billsDaysAhead,
      limite: a.alerts.limit,
      limiteQuando: a.alerts.limitThreshold,
      meta: a.alerts.goals,
      email: a.alerts.email,
      parceira: a.alerts.partner,
    },
    abrirOculto: a.startHidden,
    rendaParceira: a.partner ? paraReais(a.partner.monthlyIncomeCents) : 0,
    lazerModo: a.leisureMode === "half" ? "metade" : "juntos",
    lazerPendente: a.leisurePending,
  };
}

/** Separa um patch de Ajustes no que é do perfil (PATCH /me) e o que é da conta (PATCH settings). */
export function separarPatchAjustes(p: Partial<Ajustes>) {
  const perfil: { name?: string; avatar?: number; monthlyIncomeCents?: number } = {};
  if (p.nome !== undefined && p.nome.trim()) perfil.name = p.nome.trim();
  if (p.avatar !== undefined) perfil.avatar = p.avatar;
  if (p.renda !== undefined) perfil.monthlyIncomeCents = paraCentavos(p.renda);

  const conta: Record<string, unknown> = {};
  if (p.limite !== undefined) conta.spendingLimitCents = paraCentavos(p.limite);
  if (p.categorias !== undefined) conta.customCategories = p.categorias.map((c) => ({ name: c.nome, color: c.cor }));
  if (p.orcamentos !== undefined) {
    conta.budgetsCents = Object.fromEntries(Object.entries(p.orcamentos).filter(([, v]) => v > 0).map(([k, v]) => [k, paraCentavos(v)]));
  }
  if (p.cartao !== undefined) conta.card = { closingDay: p.cartao.fecha, dueDay: p.cartao.vence };
  if (p.lazerModo !== undefined) conta.leisureMode = p.lazerModo === "metade" ? "half" : "together";
  if (p.lazerPendente !== undefined) conta.leisurePending = p.lazerPendente;
  if (p.abrirOculto !== undefined) conta.startHidden = p.abrirOculto;
  if (p.avisos !== undefined) {
    conta.alerts = {
      bills: p.avisos.conta, billsDaysAhead: p.avisos.contaDias, limit: p.avisos.limite,
      limitThreshold: p.avisos.limiteQuando, goals: p.avisos.meta, email: p.avisos.email, partner: p.avisos.parceira,
    };
  }
  return { perfil, conta };
}
