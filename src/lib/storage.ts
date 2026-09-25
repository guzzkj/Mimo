import type { Item, Tema } from "../types";
import { STORAGE_KEY, TEMA_KEY } from "./constants";
import { HOJE, dataSeed } from "./helpers";

// Exemplos da primeira visita. As datas são relativas ao mês atual: se fossem
// fixas, o painel abriria vazio assim que o mês virasse.
export const SEED: Item[] = [
  { id: 1, tipo: "entrada", descricao: "Salário", categoria: "Salário", valor: 3200, data: dataSeed(0, 5), status: "pago" },
  { id: 2, tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 950, data: dataSeed(0, 6), status: "pago", recorrente: true, grupo: 2 },
  { id: 3, tipo: "saida", descricao: "Mercado", categoria: "Mercado", valor: 380, data: dataSeed(0, 12), status: "pago", meio: "cartao" },
  { id: 4, tipo: "saida", descricao: "Streaming e música", categoria: "Assinaturas", valor: 55, data: dataSeed(0, 20), status: "pago", meio: "cartao", recorrente: true, grupo: 4 },
  { id: 14, tipo: "saida", descricao: "Conta de luz", categoria: "Moradia", valor: 140, data: dataSeed(0, HOJE.getDate() + 2), status: "pendente" },
  { id: 15, tipo: "saida", descricao: "Internet", categoria: "Moradia", valor: 100, data: dataSeed(0, 28), status: "pendente", recorrente: true, grupo: 15 },
  { id: 16, tipo: "saida", descricao: "Fone de ouvido", categoria: "Outros", valor: 90, data: dataSeed(0, 8), status: "pago", meio: "cartao", parcela: { n: 2, total: 5 }, grupo: 16 },
  { id: 5, tipo: "entrada", descricao: "Salário", categoria: "Salário", valor: 3200, data: dataSeed(1, 5), status: "pago" },
  { id: 6, tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 950, data: dataSeed(1, 6), status: "pago", recorrente: true, grupo: 2 },
  { id: 7, tipo: "saida", descricao: "Mercado", categoria: "Mercado", valor: 420, data: dataSeed(1, 14), status: "pago", meio: "cartao" },
  { id: 8, tipo: "saida", descricao: "Curso online", categoria: "Educação", valor: 120, data: dataSeed(1, 22), status: "pendente" },
  { id: 17, tipo: "saida", descricao: "Fone de ouvido", categoria: "Outros", valor: 90, data: dataSeed(1, 8), status: "pago", meio: "cartao", parcela: { n: 1, total: 5 }, grupo: 16 },
  { id: 9, tipo: "entrada", descricao: "Salário", categoria: "Salário", valor: 3200, data: dataSeed(2, 5), status: "pago" },
  { id: 10, tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 950, data: dataSeed(2, 6), status: "pago", recorrente: true, grupo: 2 },
  { id: 11, tipo: "saida", descricao: "Transporte", categoria: "Transporte", valor: 210, data: dataSeed(2, 11), status: "pago" },
  { id: 12, tipo: "entrada", descricao: "Freelance", categoria: "Freelance", valor: 600, data: dataSeed(3, 8), status: "pago" },
  { id: 13, tipo: "saida", descricao: "Cinema", categoria: "Lazer", valor: 90, data: dataSeed(3, 16), status: "pago", meio: "cartao" },
];

// Lê as movimentações salvas no navegador ou usa a lista de exemplo.
// `chave`/`seed` permitem que outra conta (Duo) use o mesmo motor com dados próprios.
export const carregarItens = (chave: string = STORAGE_KEY, seed: Item[] = SEED): Item[] => {
  try {
    const bruto = localStorage.getItem(chave);
    const salvos = bruto ? JSON.parse(bruto) : null;
    return Array.isArray(salvos) && salvos.length ? salvos : [...seed];
  } catch {
    return [...seed];
  }
};

// Grava as movimentações no navegador.
export const persistir = (itens: Item[], chave: string = STORAGE_KEY) => {
  try {
    localStorage.setItem(chave, JSON.stringify(itens));
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
