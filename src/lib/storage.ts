import type { Item, Tema } from "../types";
import { STORAGE_KEY, TEMA_KEY } from "./constants";
import { dataSeed } from "./helpers";

// Exemplos da primeira visita. As datas são relativas ao mês atual: se fossem
// fixas, o painel abriria vazio assim que o mês virasse.
export const SEED: Item[] = [
  { id: 1, tipo: "entrada", descricao: "Salário", categoria: "Salário", valor: 3200, data: dataSeed(0, 5), status: "pago" },
  { id: 2, tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 950, data: dataSeed(0, 6), status: "pago" },
  { id: 3, tipo: "saida", descricao: "Mercado", categoria: "Mercado", valor: 380, data: dataSeed(0, 12), status: "pago" },
  { id: 4, tipo: "saida", descricao: "Assinaturas", categoria: "Assinaturas", valor: 55, data: dataSeed(0, 20), status: "pendente" },
  { id: 5, tipo: "entrada", descricao: "Salário", categoria: "Salário", valor: 3200, data: dataSeed(1, 5), status: "pago" },
  { id: 6, tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 950, data: dataSeed(1, 6), status: "pago" },
  { id: 7, tipo: "saida", descricao: "Mercado", categoria: "Mercado", valor: 420, data: dataSeed(1, 14), status: "pago" },
  { id: 8, tipo: "saida", descricao: "Curso online", categoria: "Educação", valor: 120, data: dataSeed(1, 22), status: "pendente" },
  { id: 9, tipo: "entrada", descricao: "Salário", categoria: "Salário", valor: 3200, data: dataSeed(2, 5), status: "pago" },
  { id: 10, tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 950, data: dataSeed(2, 6), status: "pago" },
  { id: 11, tipo: "saida", descricao: "Transporte", categoria: "Transporte", valor: 210, data: dataSeed(2, 11), status: "pago" },
  { id: 12, tipo: "entrada", descricao: "Freelance", categoria: "Freelance", valor: 600, data: dataSeed(3, 8), status: "pago" },
  { id: 13, tipo: "saida", descricao: "Cinema", categoria: "Lazer", valor: 90, data: dataSeed(3, 16), status: "pago" },
];

// Lê as movimentações salvas no navegador ou usa a lista de exemplo.
export const carregarItens = (): Item[] => {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    const salvos = bruto ? JSON.parse(bruto) : null;
    return Array.isArray(salvos) && salvos.length ? salvos : [...SEED];
  } catch {
    return [...SEED];
  }
};

// Grava as movimentações no navegador.
export const persistir = (itens: Item[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itens));
  } catch {
    // sem acesso ao armazenamento, a aplicação segue apenas em memória
  }
};

// Escolha salva; sem escolha, segue a preferência do sistema.
export const temaSalvo = (): Tema => {
  try {
    return (localStorage.getItem(TEMA_KEY) as Tema)
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");
  } catch {
    return "claro";
  }
};

export const salvarTema = (tema: Tema) => {
  try {
    localStorage.setItem(TEMA_KEY, tema);
  } catch {
    // sem armazenamento a escolha vale só nesta sessão
  }
};

// Lê um token de cor do CSS, para os gráficos acompanharem o tema.
export const token = (nome: string) => getComputedStyle(document.documentElement)
  .getPropertyValue(nome)
  .trim();
