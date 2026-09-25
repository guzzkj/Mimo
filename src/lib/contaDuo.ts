import { useSyncExternalStore } from "react";
import type { OpcoesMimoApp } from "../hooks/useMimoApp";
import type { Autor, Item } from "../types";
import { MESES, MESES_LONGOS } from "./constants";
import { DIA_HOJE, MES_REF, dataSeed, pad } from "./helpers";

// Dados de exemplo da conta Duo e os cálculos da Visão do casal, compartilhados
// entre as telas (Duo e Metas, Configurações) e a moldura comum (topo, painel
// lateral e dock). Tudo sai das movimentações do motor Duo (useMimoApp).

type Semente = [mesesAtras: number, dia: number, descricao: string, categoria: string, quem: Autor, valor: number, extra?: Partial<Item>];

// valor > 0 é entrada; < 0, saída.
const SEMENTES: Semente[] = [
  // mês atual
  [0, 23, "Mercado Pão de Açúcar", "Mercado", "gustavo", -412.8, { dividir: true, meio: "cartao" }],
  [0, 22, "Salário", "Salário", "gustavo", 6200],
  [0, 21, "Jantar no Nino Cucina", "Lazer", "suelen", -186, { dividir: true }],
  [0, 20, "Presente para minha mãe", "Presentes", "gustavo", -240, { privado: true }],
  [0, 19, "Conta de luz Enel", "Moradia", "conjunta", -238.45],
  [0, 18, "Cinema e pipoca", "Lazer", "gustavo", -94],
  [0, 17, "Presente de casamento Ana e Léo", "Presentes", "suelen", -350, { dividir: true }],
  [0, 16, "Cortina da sala", "Moradia", "suelen", -289.9, { dividir: true }],
  [0, 15, "Salário", "Salário", "suelen", 5400],
  [0, 14, "Feira de domingo", "Mercado", "gustavo", -144.9, { dividir: true }],
  [0, 13, "Uber para o aeroporto", "Transporte", "gustavo", -64.3, { dividir: true }],
  [0, 12, "Aluguel", "Moradia", "conjunta", -2100, { recorrente: true, grupo: 9001 }],
  [0, 11, "Mercado Assaí", "Mercado", "suelen", -495.2, { dividir: true }],
  [0, 10, "Farmácia", "Saúde", "suelen", -78.9, { dividir: true }],
  [0, 9, "Livro de ilustração", "Educação", "suelen", -74, { privado: true }],
  [0, 8, "Internet Vivo Fibra", "Moradia", "conjunta", -129.9, { recorrente: true, grupo: 9002 }],
  [0, 7, "Manicure", "Outros", "suelen", -58.6, { privado: true }],
  [0, 5, "Depósito de Gustavo", "Outros", "conjunta", 2600],
  [0, 5, "Depósito de Suelen", "Outros", "conjunta", 2600],
  [0, 4, "Gás de cozinha", "Moradia", "gustavo", -118, { dividir: true }],
  [0, DIA_HOJE + 2, "Condomínio", "Moradia", "conjunta", -680, { status: "pendente" }],
  // mês passado
  [1, 5, "Depósito de Gustavo", "Outros", "conjunta", 1115],
  [1, 5, "Depósito de Suelen", "Outros", "conjunta", 1115],
  [1, 22, "Salário", "Salário", "gustavo", 6200],
  [1, 15, "Salário", "Salário", "suelen", 5400],
  [1, 12, "Aluguel", "Moradia", "conjunta", -2100, { recorrente: true, grupo: 9001 }],
  [1, 8, "Internet Vivo Fibra", "Moradia", "conjunta", -129.9, { recorrente: true, grupo: 9002 }],
  [1, 14, "Mercado Assaí", "Mercado", "suelen", -532.4, { dividir: true }],
  [1, 20, "Mercado Pão de Açúcar", "Mercado", "gustavo", -380.1, { dividir: true }],
  [1, 16, "Show no Allianz", "Lazer", "gustavo", -320, { dividir: true }],
  [1, 24, "Restaurante japonês", "Lazer", "suelen", -210],
  [1, 18, "Consulta no dentista", "Saúde", "gustavo", -250],
  [1, 9, "Roupas", "Outros", "suelen", -299.9],
  // dois meses atrás
  [2, 1, "Saldo anterior da conjunta", "Outros", "conjunta", 2088.35],
  [2, 5, "Depósito de Gustavo", "Outros", "conjunta", 1115],
  [2, 5, "Depósito de Suelen", "Outros", "conjunta", 1115],
  [2, 22, "Salário", "Salário", "gustavo", 6200],
  [2, 15, "Salário", "Salário", "suelen", 5400],
  [2, 12, "Aluguel", "Moradia", "conjunta", -2100, { recorrente: true, grupo: 9001 }],
  [2, 8, "Internet Vivo Fibra", "Moradia", "conjunta", -129.9, { recorrente: true, grupo: 9002 }],
  [2, 13, "Mercado Assaí", "Mercado", "gustavo", -610.3, { dividir: true }],
  [2, 21, "Mercado do bairro", "Mercado", "suelen", -284.5, { dividir: true }],
  [2, 19, "Passeio em Campos do Jordão", "Lazer", "suelen", -540, { dividir: true }],
  [2, 6, "Gasolina", "Transporte", "gustavo", -230],
];

export const DUO_SEED: Item[] = SEMENTES.map(([atras, dia, descricao, categoria, quem, v, extra], i) => ({
  id: i + 1,
  tipo: v > 0 ? "entrada" : "saida",
  descricao,
  categoria,
  valor: Math.abs(v),
  data: dataSeed(atras, dia),
  status: "pago",
  quem,
  ...extra,
}));

// v2: o exemplo ganhou privados, despesas divididas e meses anteriores.
export const MOTOR_DUO: OpcoesMimoApp = { storageKey: "mimo.duo.itens.v2", seed: DUO_SEED, autorPadrao: "gustavo", conta: "duo", privadosDe: "suelen" };
export const AUTORES: { valor: Autor; label: string }[] = [{ valor: "gustavo", label: "Gustavo" }, { valor: "suelen", label: "Suelen" }, { valor: "conjunta", label: "Conta conjunta" }];

// ---- acertos da divisão (Pix entre os dois) ---------------------------------------

/** valor > 0: Gustavo pagou Suelen; < 0: Suelen pagou Gustavo. */
export interface Acerto { id: number; mes: string; data: string; valor: number }

const CHAVE_ACERTOS = "mimo.duo.acertos.v1";
const ouvintes = new Set<() => void>();
let acertos: Acerto[] | null = null;

export const lerAcertos = (): Acerto[] => {
  if (acertos) return acertos;
  let lido: Acerto[] = [];
  try {
    const bruto = localStorage.getItem(CHAVE_ACERTOS);
    const json = bruto ? JSON.parse(bruto) : null;
    if (Array.isArray(json)) lido = json;
  } catch {
    // sem armazenamento, começa vazio
  }
  acertos = lido;
  return lido;
};

export function salvarAcertos(lista: Acerto[]) {
  acertos = lista;
  try {
    localStorage.setItem(CHAVE_ACERTOS, JSON.stringify(lista));
  } catch {
    // segue só em memória
  }
  ouvintes.forEach((f) => f());
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
};

export const useAcertos = () => useSyncExternalStore(assinar, lerAcertos, lerAcertos);

// ---- resumo do casal -----------------------------------------------------------------

export type Regra = "meio" | "prop";

const soma = (l: Item[]) => l.reduce((t, i) => t + i.valor, 0);
const saidas = (l: Item[]) => l.filter((i) => i.tipo === "saida");
const entradas = (l: Item[]) => l.filter((i) => i.tipo === "entrada");

/** "setembro" */
export const nomeMes = (chave: string) => MESES_LONGOS[Number(chave.slice(5, 7)) - 1].toLowerCase();
/** "setembro de 2026" */
export const rotuloMes = (chave: string) => `${nomeMes(chave)} de ${chave.slice(0, 4)}`;

/**
 * Tudo o que a Visão do casal, a Divisão e o Lazer mostram, calculado das
 * movimentações da conta Duo no mês em foco.
 */
export function resumoDuo(itens: Item[], mesRef: string, o: { regra: Regra; renda: number; rendaParceira: number; acertos: Acerto[]; limiteLazer: number }) {
  const doMes = itens.filter((i) => i.data.slice(0, 7) === mesRef);
  const pagosAteFim = itens.filter((i) => i.data <= `${mesRef}-31` && i.status === "pago" && i.quem === "conjunta");

  // conta conjunta
  const conj = doMes.filter((i) => i.quem === "conjunta" && i.status === "pago");
  const cIn = soma(entradas(conj));
  const cOut = soma(saidas(conj));
  const saldoConjunta = soma(entradas(pagosAteFim)) - soma(saidas(pagosAteFim));
  const pagasPelaConjunta = saidas(conj).map((i) => i.descricao);

  // por pessoa (os privados entram no total, sem detalhe)
  const pessoa = (k: "gustavo" | "suelen") => {
    const meus = doMes.filter((i) => i.quem === k);
    return {
      entrou: soma(entradas(meus)),
      gastou: soma(saidas(meus)),
      privados: meus.filter((i) => i.privado).length,
    };
  };

  // divisão: despesas marcadas "dividir" pagas por um dos dois
  const lista = saidas(doMes).filter((i) => i.dividir && i.quem !== "conjunta");
  const pG = soma(lista.filter((i) => i.quem !== "suelen"));
  const pS = soma(lista.filter((i) => i.quem === "suelen"));
  const tot = pG + pS;
  const rendaTotal = o.renda + o.rendaParceira;
  const pctG = o.regra === "meio" || !rendaTotal ? 0.5 : o.renda / rendaTotal;
  const justoG = tot * pctG;
  const acertosMes = o.acertos.filter((a) => a.mes === mesRef);
  const acertado = acertosMes.reduce((t, a) => t + a.valor, 0);
  const dev = Math.round((justoG - pG - acertado) * 100) / 100;

  // lazer: o que sai da conjunta conta metade para cada um
  const lazer = saidas(doMes).filter((i) => i.categoria === "Lazer");
  const lazerConj = soma(lazer.filter((i) => i.quem === "conjunta")) / 2;
  const lazerG = soma(lazer.filter((i) => i.quem === "gustavo")) + lazerConj;
  const lazerS = soma(lazer.filter((i) => i.quem === "suelen")) + lazerConj;

  // quem gastou o quê nos últimos 6 meses
  const [a, m] = mesRef.split("-").map(Number);
  const porMes = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(a, m - 6 + k, 1);
    const chave = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const s = saidas(itens.filter((i) => i.data.slice(0, 7) === chave));
    return {
      chave,
      label: MESES[d.getMonth()],
      gustavo: soma(s.filter((i) => i.quem === "gustavo")),
      suelen: soma(s.filter((i) => i.quem === "suelen")),
      conjunta: soma(s.filter((i) => i.quem === "conjunta")),
    };
  });

  const diasNoMes = new Date(a, m, 0).getDate();
  const diasRestantes = mesRef === MES_REF ? diasNoMes - DIA_HOJE : mesRef > MES_REF ? diasNoMes : 0;

  return {
    doMes, cIn, cOut, saldoConjunta, pagasPelaConjunta,
    gustavo: pessoa("gustavo"), suelen: pessoa("suelen"),
    divisao: { lista, pG, pS, tot, pctG, justoG, justoS: tot - justoG, acertosMes, acertado, dev, vazio: tot === 0 },
    lazer: { g: lazerG, s: lazerS, total: lazerG + lazerS, limite: o.limiteLazer, diasRestantes },
    porMes,
  };
}

export type ResumoDuo = ReturnType<typeof resumoDuo>;
