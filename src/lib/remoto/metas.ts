import { api } from "../api";
import { dataBr, MES_REF, pad } from "../helpers";
import { contaDoTipo, lerSessao, pessoasDaConta, type Sessao } from "../sessao";
import { paraCentavos, paraReais } from "./mapear";
import type { MetaApi } from "./tipos";

// Metas no backend. A tela de Metas guarda tudo em quatro listas (criadas,
// aportes, arquivadas, edições); aqui a lista vem da API e cada mudança nela
// vira chamada REST, em fila. A resposta do servidor (meta completa) substitui
// a versão local, inclusive trocando o id provisório ("n...") pelo definitivo.

export type Prio = "essencial" | "urgente" | "conforto";
export interface ItemMetaR { id: string; nome: string; p: Prio; v: number; art?: string }
export interface MetaR { id: string; nome: string; ic: string; alvo: number; g: number; s: number; prazo: number | null; ritmo: number; itens?: ItemMetaR[] }
export interface AporteR { d: string; quem: "gustavo" | "suelen"; v: number; nota: string; /** id no servidor */ id?: string }
export interface MetasSalvas { criadas: MetaR[]; aportes: Record<string, AporteR[]>; arquivadas: string[]; edicoes: Record<string, Partial<MetaR>> }

const PRIOS: Prio[] = ["essencial", "urgente", "conforto"];

/** "aaaa-mm" -> meses a partir do mês atual (mínimo 1). */
export const mesesAte = (prazo: string | null) => {
  if (!prazo) return null;
  const [y, mo] = prazo.split("-").map(Number);
  const [ya, ma] = MES_REF.split("-").map(Number);
  return y && mo ? Math.max(1, (y - ya) * 12 + (mo - ma)) : null;
};
/** meses a partir de agora -> "aaaa-mm". */
export const mesDaquiA = (meses: number | null) => {
  if (meses == null) return null;
  const [ya, ma] = MES_REF.split("-").map(Number);
  const d = new Date(ya, ma - 1 + meses, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const ritmoDe = (alvo: number, guardado: number, meses: number | null) => Math.max(300, Math.round((alvo - guardado) / (meses ?? 12)));

export interface Contexto { contaId: string; meId: string; parId: string | null }

export function contextoMetas(duo: boolean, sessao: Sessao = lerSessao()): Contexto | null {
  const conta = contaDoTipo(duo ? "duo" : "solo", sessao);
  if (!conta) return null;
  const { meId, parId } = pessoasDaConta(conta, sessao);
  return { contaId: conta.id, meId, parId };
}

/** Meta da API no formato da tela. g/s ficam zerados: tudo o que foi guardado vem dos aportes. */
export function metaDeApi(g: MetaApi): MetaR {
  const prazo = mesesAte(g.deadlineMonth);
  const alvo = paraReais(g.targetCents);
  return {
    id: g.id, nome: g.name, ic: g.icon, alvo, g: 0, s: 0, prazo, ritmo: ritmoDe(alvo, paraReais(g.savedCents), prazo),
    ...(g.items.length ? { itens: g.items.map((i) => ({ id: i.id, nome: i.name, v: paraReais(i.valueCents), p: PRIOS.includes(i.priority as Prio) ? (i.priority as Prio) : "essencial" })) } : {}),
  };
}

export function aportesDeApi(g: MetaApi, ctx: Contexto): AporteR[] {
  return g.contributions.map((c) => ({
    id: c.id, d: dataBr(c.contributedOn), quem: c.userId && c.userId !== ctx.meId ? "suelen" : "gustavo",
    v: paraReais(c.amountCents), nota: c.note ?? "",
  }));
}

export async function carregarMetas(ctx: Contexto): Promise<MetasSalvas> {
  const { goals } = await api.get<{ goals: MetaApi[] }>(`/accounts/${ctx.contaId}/goals`);
  const salvas: MetasSalvas = { criadas: [], aportes: {}, arquivadas: [], edicoes: {} };
  for (const g of goals) {
    salvas.criadas.push(metaDeApi(g));
    salvas.aportes[g.id] = aportesDeApi(g, ctx);
    if (g.archived) salvas.arquivadas.push(g.id);
  }
  return salvas;
}

/** Troca a versão local de uma meta (id provisório ou não) pela que o servidor devolveu. */
export function aplicarMetaDoServidor(st: MetasSalvas, idLocal: string, meta: MetaR, aportes: AporteR[], arquivada: boolean): MetasSalvas {
  // a meta pode já ter trocado de id (resposta anterior): procura pelos dois
  const mesma = (id: string) => id === idLocal || id === meta.id;
  const existe = st.criadas.some((m) => mesma(m.id));
  const { [idLocal]: _a, [meta.id]: _b, ...outrosAportes } = st.aportes;
  const { [idLocal]: _c, [meta.id]: _d, ...outrasEdicoes } = st.edicoes;
  void _a; void _b; void _c; void _d;
  const arq = st.arquivadas.filter((x) => x !== idLocal && x !== meta.id);
  return {
    criadas: existe ? st.criadas.map((m) => (mesma(m.id) ? meta : m)) : [...st.criadas, meta],
    aportes: { ...outrosAportes, [meta.id]: aportes },
    arquivadas: arquivada ? [...arq, meta.id] : arq,
    edicoes: outrasEdicoes,
  };
}

const efetiva = (st: MetasSalvas, id: string): MetaR | undefined => {
  const m = st.criadas.find((x) => x.id === id);
  return m ? { ...m, ...st.edicoes[id] } : undefined;
};

const isoDeBr = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
const itensApi = (itens: ItemMetaR[]) => itens.map((i) => ({ name: i.nome, valueCents: paraCentavos(i.v), priority: i.p ?? null }));

export function criarSincronizadorMetas(
  ctx: Contexto,
  aoAtualizar: (idLocal: string, meta: MetaApi) => void,
  aoFalhar: (e: unknown) => void,
) {
  const ids = new Map<string, string>();
  const id = (x: string) => ids.get(x) ?? x;
  const base = `/accounts/${ctx.contaId}/goals`;
  let fila: Promise<void> = Promise.resolve();
  let geracao = 0;

  async function enviar(antes: MetasSalvas, depois: MetasSalvas) {
    const antesIds = new Set(antes.criadas.map((m) => m.id));
    const depoisIds = new Set(depois.criadas.map((m) => m.id));

    for (const m of depois.criadas.filter((x) => !antesIds.has(x.id))) {
      const ef = efetiva(depois, m.id)!;
      const iniciais = [
        ...(ef.g > 0 ? [{ amountCents: paraCentavos(ef.g) }] : []),
        ...(ef.s > 0 && ctx.parId ? [{ userId: ctx.parId, amountCents: paraCentavos(ef.s) }] : []),
      ];
      const { goal } = await api.post<{ goal: MetaApi }>(base, {
        name: ef.nome, icon: ef.ic, deadlineMonth: mesDaquiA(ef.prazo),
        ...(ef.itens?.length ? { items: itensApi(ef.itens) } : { targetCents: paraCentavos(ef.alvo) }),
        ...(iniciais.length ? { initialContributions: iniciais } : {}),
      });
      ids.set(m.id, goal.id);
      aoAtualizar(m.id, goal);
    }

    for (const m of antes.criadas.filter((x) => !depoisIds.has(x.id))) {
      if (!id(m.id).startsWith("n")) await api.del(`${base}/${id(m.id)}`);
    }

    for (const m of depois.criadas.filter((x) => antesIds.has(x.id))) {
      const a = efetiva(antes, m.id)!;
      const d = efetiva(depois, m.id)!;
      const real = id(m.id);
      if (real.startsWith("n")) continue;
      let ultima: MetaApi | null = null;
      const patch: Record<string, unknown> = {};
      if (a.nome !== d.nome) patch.name = d.nome;
      if (a.ic !== d.ic) patch.icon = d.ic;
      if (a.prazo !== d.prazo) patch.deadlineMonth = mesDaquiA(d.prazo);
      if (!d.itens?.length && a.alvo !== d.alvo) patch.targetCents = paraCentavos(d.alvo);
      const arqAntes = antes.arquivadas.includes(m.id);
      const arqDepois = depois.arquivadas.includes(m.id);
      if (arqAntes !== arqDepois) patch.archived = arqDepois;
      if (Object.keys(patch).length) ultima = (await api.patch<{ goal: MetaApi }>(`${base}/${real}`, patch)).goal;
      if (d.itens?.length && JSON.stringify(itensApi(a.itens ?? [])) !== JSON.stringify(itensApi(d.itens))) {
        ultima = (await api.put<{ goal: MetaApi }>(`${base}/${real}/items`, { items: itensApi(d.itens) })).goal;
      }

      const antesAp = antes.aportes[m.id] ?? [];
      const depoisAp = depois.aportes[m.id] ?? [];
      const ficaram = new Set(depoisAp.map((x) => x.id).filter(Boolean));
      for (const ap of depoisAp.filter((x) => !x.id && !antesAp.includes(x))) {
        ultima = (await api.post<{ goal: MetaApi }>(`${base}/${real}/contributions`, {
          amountCents: paraCentavos(ap.v), contributedOn: isoDeBr(ap.d), note: ap.nota || null,
          ...(ap.quem === "suelen" && ctx.parId ? { userId: ctx.parId } : {}),
        })).goal;
      }
      for (const ap of antesAp.filter((x) => x.id && !ficaram.has(x.id))) {
        ultima = (await api.del<{ goal: MetaApi }>(`${base}/${real}/contributions/${ap.id}`)).goal;
      }
      if (ultima) aoAtualizar(m.id, ultima);
    }
  }

  return {
    enviar(antes: MetasSalvas, depois: MetasSalvas) {
      const minha = geracao;
      fila = fila
        .then(() => (minha === geracao ? enviar(antes, depois) : undefined))
        .catch((e) => { geracao++; aoFalhar(e); });
    },
  };
}
