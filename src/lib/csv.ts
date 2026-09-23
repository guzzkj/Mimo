import type { Item } from "../types";

// Ordena as movimentações da mais recente para a mais antiga (mesma regra de derive.ts).
const ordenar = (itens: Item[]) => [...itens].sort((a, b) => (
  a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id
));

// Gera um arquivo CSV com todas as movimentações e dispara o download.
export const exportarCsv = (itens: Item[]) => {
  const cabecalho = ["Data", "Tipo", "Descricao", "Categoria", "Status", "Valor"];

  const corpo = ordenar(itens)
    .map(({ data, tipo, descricao, categoria, status, valor }) => (
      [data, tipo, descricao, categoria, status, String(valor).replace(".", ",")]
    ));

  const csv = [cabecalho, ...corpo]
    .map((linha) => linha.map((celula) => `"${String(celula).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "mimo-movimentacoes.csv" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
