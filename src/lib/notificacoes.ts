import { useSyncExternalStore } from "react";
import { brl } from "../components/mimo/estilos";
import type { Ajustes, ContaAjustes } from "./ajustes";
import { corDaCategoria } from "./ajustes";
import { derivar } from "./derive";
import { MESES_LONGOS } from "./constants";
import { MES_REF, dataBr } from "./helpers";
import type { Item } from "../types";

// Central de notificações compartilhada: o sino da Topbar existe em todas as
// telas logadas, então a lista (e o que já foi lido) vive fora dos componentes,
// uma por conta. Sem backend: fica só em memória durante a sessão.

export type ContaAtiva = ContaAjustes;
export type AcaoNotif = "pagar" | "gastos" | "meta" | "reenviar" | "aceitar" | "recusar";
export type TipoNotif = "conta" | "limite" | "meta" | "convite";

export interface Notif {
  id: string; tipo: TipoNotif; titulo: string; texto: string; quando: string; acoes: AcaoNotif[]; lido?: boolean;
  /** Movimentação ligada ao aviso (ex.: conta a pagar), para agir direto dele. */
  itemId?: number;
}

export const EMAIL_SUELEN = "suelen.costa@gmail.com";

// Avisos que não saem das movimentações: convite e metas. Contas, limite,
// orçamento e fatura são gerados dos dados (avisosDosDados).
export function notifsBase(duo: boolean, pend: boolean): Notif[] {
  const f = (v: number) => brl(v);
  const l: Notif[] = duo ? [
    { id: "n3", tipo: "meta", titulo: "Viagem ao Japão está fora do ritmo", texto: "No ritmo atual, vocês chegam 2 meses depois do prazo. Com " + f(2650) + " por mês, chegam a tempo.", quando: "há 3 dias", acoes: ["meta"] },
  ] : [
    { id: "n4", tipo: "convite", titulo: "Suelen convidou você para uma conta Duo", texto: "Vocês passam a dividir despesas e metas. O que você já registrou continua privado.", quando: "há 5 dias", acoes: ["aceitar", "recusar"] },
    { id: "n3", tipo: "meta", titulo: "Viagem ao Chile está fora do ritmo", texto: "No ritmo atual, você chega 3 meses depois do prazo. Com " + f(1100) + " por mês, chega a tempo.", quando: "há 3 dias", acoes: ["meta"] },
  ];
  if (duo && pend) l.unshift({ id: "n4", tipo: "convite", titulo: "Convite para Suelen aguardando", texto: "Enviado para " + EMAIL_SUELEN + ". Expira em 3 dias.", quando: "há 5 dias", acoes: ["reenviar"] });
  return [...l,
    { id: "n7", tipo: "meta", titulo: (duo ? "Montar a casa nova" : "Montar o apê") + " passou de 25%", texto: (duo ? "Vocês já guardaram " : "Você já guardou ") + f(11400) + ".", quando: "há 1 semana", acoes: [], lido: true }];
}

const estado: Record<ContaAtiva, Notif[] | null> = { solo: null, duo: null };
const ouvintes = new Set<() => void>();
const avisarTodos = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
};

const lista = (conta: ContaAtiva): Notif[] => {
  if (!estado[conta]) estado[conta] = notifsBase(conta === "duo", false);
  return estado[conta];
};

export const definirNotifs = (conta: ContaAtiva, nova: Notif[]) => { estado[conta] = nova; avisarTodos(); };
export const atualizarNotifs = (conta: ContaAtiva, f: (l: Notif[]) => Notif[]) => { estado[conta] = f(lista(conta)); avisarTodos(); };

export const useNotificacoes = (conta: ContaAtiva) => useSyncExternalStore(assinar, () => lista(conta), () => lista(conta));

/** Quantas notificações ainda não lidas a conta tem (contador do sino). */
export const useNaoLidas = (conta: ContaAtiva) => useNotificacoes(conta).filter((n) => !n.lido).length;

// ---- avisos gerados dos dados (Solo e Duo) --------------------------------------
// Contas vencendo ou atrasadas, limite do mês, orçamentos estourados e fatura do
// cartão saem das próprias movimentações e seguem as preferências salvas. O que
// a pessoa leu continua lido, e o que ela dispensou não volta.

const AUTO = "auto-";
const dispensados: Record<ContaAtiva, Set<string>> = { solo: new Set(), duo: new Set() };
const vistos: Record<ContaAtiva, Set<string>> = { solo: new Set(), duo: new Set() };
const ocultosPorPref: Record<ContaAtiva, Notif[]> = { solo: [], duo: [] };

const diasAte = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  const hoje = new Date();
  return Math.round((new Date(a, m - 1, d).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86400000);
};

const avisosDosDados = (conta: ContaAtiva, itens: Item[], a: Ajustes): Notif[] => {
  const d = derivar({
    itens, mesRef: MES_REF, pagina: 1, query: "", tipoFiltro: "todos", statusFiltro: "todos", privado: false,
    limite: a.limite, orcamentos: a.orcamentos, corDe: (c) => corDaCategoria(a, c), venceFatura: a.cartao.vence,
  });
  const duo = conta === "duo";
  const f = (v: number) => brl(v);
  const mesNome = MESES_LONGOS[Number(MES_REF.slice(5)) - 1].toLowerCase();
  const p = a.avisos;
  const l: Notif[] = [];

  if (p.conta) {
    d.pendentes
      .filter((c) => c.prazo && diasAte(c.data) <= p.contaDias)
      .forEach((c) => l.push({
        id: `${AUTO}conta-${c.id}`, tipo: "conta", itemId: c.id,
        titulo: `${c.descricao} ${c.prazo!.texto}`,
        texto: `${f(c.valor)} · ${c.categoria}${c.meio === "cartao" ? " · no cartão" : ""}${duo && c.quem === "conjunta" ? " · conta conjunta" : ""}.`,
        quando: dataBr(c.data).slice(0, 5), acoes: ["pagar"],
      }));
  }

  if (p.limite && d.limitePct >= (p.limiteQuando === "100" ? 100 : 80)) {
    const passou = d.limitePct >= 100;
    l.push({
      id: `${AUTO}limite-${MES_REF}-${passou ? 100 : 80}`, tipo: "limite",
      titulo: passou ? "Limite do mês estourado" : `${duo ? "Vocês já usaram" : "Você já usou"} ${d.limitePct}% do limite`,
      texto: `${duo ? "Vocês gastaram" : "Você gastou"} ${f(d.saidas)} de ${f(d.limite)} em ${mesNome}. Faltam ${d.diasDoMes - d.diaDeHoje} dias para o mês acabar.`,
      quando: "hoje", acoes: ["gastos"],
    });
  }

  if (p.limite) {
    d.estourados.forEach((c) => l.push({
      id: `${AUTO}orc-${MES_REF}-${c.nome}`, tipo: "limite",
      titulo: duo && c.nome === "Lazer" ? "Lazer do casal passou do limite" : `${c.nome} passou do orçamento`,
      texto: `${f(c.valor)} de ${f(c.orcamento)} planejados para ${mesNome}.`,
      quando: "hoje", acoes: ["gastos"],
    }));
  }

  if (p.conta && d.fatura > 0) {
    l.push({
      id: `${AUTO}fatura-${MES_REF}`, tipo: "conta",
      titulo: `Fatura de ${mesNome}: ${f(d.fatura)}`,
      texto: `${d.faturaItens.length} ${d.faturaItens.length === 1 ? "compra" : "compras"} no cartão. Vence em ${dataBr(d.faturaVence).slice(0, 5)}.`,
      quando: "hoje", acoes: [],
    });
  }
  return l;
};

export function sincronizarAvisos(conta: ContaAtiva, itens: Item[], a: Ajustes) {
  const atual = lista(conta);
  const lidos = new Set(atual.filter((n) => n.lido).map((n) => n.id));
  const gerados = avisosDosDados(conta, itens, a);
  // aviso automático que já apareceu e sumiu da lista foi dispensado pela pessoa
  const idsAtuais = new Set(atual.map((n) => n.id));
  gerados.forEach((n) => { if (vistos[conta].has(n.id) && !idsAtuais.has(n.id)) dispensados[conta].add(n.id); });
  gerados.forEach((n) => vistos[conta].add(n.id));
  const auto = gerados.filter((n) => !dispensados[conta].has(n.id)).map((n) => ({ ...n, lido: lidos.has(n.id) }));
  // mantém os avisos que não vêm dos dados (convite, metas), respeitando as preferências
  // (os de meta desligados ficam guardados e voltam se a preferência religar)
  const naoAuto = [...atual.filter((n) => !n.id.startsWith(AUTO)), ...ocultosPorPref[conta]];
  ocultosPorPref[conta] = naoAuto.filter((n) => n.tipo === "meta" && !a.avisos.meta);
  const fixos = naoAuto.filter((n) => n.tipo === "convite" || (n.tipo === "meta" && a.avisos.meta));
  estado[conta] = [...auto, ...fixos];
  avisarTodos();
}
