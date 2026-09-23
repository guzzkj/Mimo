export type TipoMovimentacao = "entrada" | "saida";
export type StatusMovimentacao = "pago" | "pendente";
export type View = "geral" | "lista" | "categorias";
export type Tema = "claro" | "escuro";

export interface Item {
  id: number;
  tipo: TipoMovimentacao;
  descricao: string;
  categoria: string;
  valor: number;
  /** ISO "YYYY-MM-DD" */
  data: string;
  status: StatusMovimentacao;
}

export interface ItemDecorado extends Item {
  sinal: "+" | "-";
  classeCor: "is-in-text" | "is-out-text";
  iconBg: string;
  valorFmt: string;
  valorSimples: string;
  dataLabel: string;
  statusLabel: "Pendente" | "Concluído";
  statusClasse: "is-pending" | "is-done";
}

export interface FormState {
  tipo: TipoMovimentacao;
  descricao: string;
  valor: string;
  /** dd/mm/aaaa */
  data: string;
  categoria: string;
  status: StatusMovimentacao;
  parcelado: boolean;
  parcelas: string;
}

export interface MesSerie {
  chave: string;
  label: string;
  entradas: number;
  saidas: number;
}

export interface Categoria {
  nome: string;
  valor: number;
  cor: string;
}

export interface RegraItem {
  nome: string;
  valor: number;
  cor: string;
}

export interface DiaResumo {
  entradas: number;
  saidas: number;
}

export interface Derivado {
  diasDoMes: number;
  diaDeHoje: number;
  diasCorridos: number;
  ehMesAtual: boolean;
  paginas: number;
  pagina: number;
  daPagina: ItemDecorado[];
  ordenados: Item[];
  mes: Item[];
  entradas: number;
  saidas: number;
  saldo: number;
  resultado: number;
  pendentes: ItemDecorado[];
  aPagar: number;
  variacao: number;
  serie: MesSerie[];
  categorias: Categoria[];
  totalCategorias: number;
  gastoMedio: number;
  maiorSaida: Item | undefined;
  regra: RegraItem[];
  baseRegra: number;
  limite: number;
  limitePct: number;
  dias: Record<number, DiaResumo>;
  visiveis: ItemDecorado[];
}
