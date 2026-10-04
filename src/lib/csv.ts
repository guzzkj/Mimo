import type { Item } from "../types";

// Ordena as movimentações da mais recente para a mais antiga (mesma regra de derive.ts).
const ordenar = (itens: Item[]) => [...itens].sort((a, b) => (
  a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id
));

/**
 * Neutraliza injeção de fórmula (CSV/formula injection): planilhas tratam
 * células que começam com = + - @ (ou TAB/CR) como fórmula. Prefixamos um
 * apóstrofo para o texto digitado pelo usuário entrar sempre como texto puro.
 */
const neutralizarFormula = (texto: string) =>
  /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;

const celula = (valor: string) => `"${valor.replace(/"/g, '""')}"`;

// Monta o conteúdo CSV (função pura, testável sem DOM).
export const buildCsv = (itens: Item[]): string => {
  const cabecalho = ["Data", "Tipo", "Descricao", "Categoria", "Status", "Pago com", "Parcela", "Valor"];

  const corpo = ordenar(itens)
    .map(({ data, tipo, descricao, categoria, status, meio, parcela, recorrente, valor }) => (
      // Só descrição e categoria são texto livre do usuário; o resto é gerado/enum.
      [data, tipo, neutralizarFormula(descricao), neutralizarFormula(categoria), status,
        meio === "cartao" ? "cartao" : "conta",
        parcela ? `${parcela.n}/${parcela.total}` : recorrente ? "recorrente" : "", valor.toFixed(2).replace(".", ",")]
    ));

  return [cabecalho, ...corpo]
    .map((linha) => linha.map((c) => celula(String(c))).join(";"))
    .join("\n");
};

// Gera um arquivo CSV com todas as movimentações e dispara o download.
export const exportarCsv = (itens: Item[], arquivo = "mimo-movimentacoes.csv") => {
  const csv = buildCsv(itens);
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: arquivo });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
