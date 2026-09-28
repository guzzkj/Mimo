// Filtros da tela de movimentações: tipos das props e utilitários usados
// pela barra/folha de filtros (FiltrosMovimentacoes) e pelo estado vazio da lista.
import type { ReactNode } from "react";
import type { StatusMovimentacao, TipoMovimentacao } from "../types";

/** Filtro por quem lançou (conta Duo): opções com avatar e contagem. */
export interface FiltroAutor {
  valor: string;
  opcoes: { valor: string; label: string; contagem: number; icone?: ReactNode }[];
  onChange: (valor: string) => void;
}

export interface FiltrosProps {
  query: string;
  tipoFiltro: "todos" | TipoMovimentacao;
  statusFiltro: "todos" | StatusMovimentacao;
  categoriaFiltro: string;
  cartaoFiltro: boolean;
  categorias?: string[];
  autor?: FiltroAutor;
  /** Quantas movimentações passam pelos filtros atuais (todas as páginas). */
  resultados: number;
  /** Pendências visíveis que podem ser pagas em lote (só aparece com 2+). */
  pendentes: number[];
  onQuery: (q: string) => void;
  onFiltroTipo: (v: "todos" | TipoMovimentacao) => void;
  onFiltroStatus: (v: "todos" | StatusMovimentacao) => void;
  onFiltroCategoria?: (categoria: string) => void;
  onFiltroCartao?: (cartao: boolean) => void;
  onMarcarPagas?: (ids: number[]) => void;
}

type Limpaveis = Pick<FiltrosProps, "onFiltroTipo" | "onFiltroStatus" | "onFiltroCategoria" | "onFiltroCartao" | "autor">;

/** Volta todos os filtros ao padrão (a busca fica como está). */
export function limparFiltros(p: Limpaveis) {
  p.onFiltroTipo("todos");
  p.onFiltroStatus("todos");
  p.autor?.onChange("todos");
  p.onFiltroCategoria?.("");
  p.onFiltroCartao?.(false);
}

/** Há algum filtro fora do padrão? */
export const temFiltroAtivo = (p: Pick<FiltrosProps, "tipoFiltro" | "statusFiltro" | "categoriaFiltro" | "cartaoFiltro" | "autor">) =>
  p.tipoFiltro !== "todos" || p.statusFiltro !== "todos" || Boolean(p.categoriaFiltro) || p.cartaoFiltro || (p.autor ? p.autor.valor !== "todos" : false);
