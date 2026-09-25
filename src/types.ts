export type TipoMovimentacao = "entrada" | "saida";
export type StatusMovimentacao = "pago" | "pendente";
export type View = "geral" | "lista" | "categorias";
export type Tema = "claro" | "escuro";
/** Quem fez a movimentação (só existe na conta Duo). */
export type Autor = "gustavo" | "suelen" | "conjunta";
/** Como a saída foi paga: débito na conta ou no cartão de crédito (entra na fatura). */
export type Meio = "conta" | "cartao";

export interface Item {
  id: number;
  quem?: Autor;
  tipo: TipoMovimentacao;
  descricao: string;
  categoria: string;
  valor: number;
  /** ISO "YYYY-MM-DD" */
  data: string;
  status: StatusMovimentacao;
  meio?: Meio;
  /** Liga as parcelas de uma compra ou as repetições de uma conta recorrente. */
  grupo?: number;
  /** Parcela n de total (compra parcelada). */
  parcela?: { n: number; total: number };
  recorrente?: boolean;
  /** Conta Duo: só quem lançou vê os detalhes; para o par, entra só no total. */
  privado?: boolean;
  /** Conta Duo: despesa que entra na divisão do mês entre os dois. */
  dividir?: boolean;
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
  /** Vencimento relativo a hoje, para pendências ("vence em 3 dias", "atrasada"). */
  prazo: { texto: string; tom: "atrasada" | "hoje" | "breve" | "normal" } | null;
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
  meio: Meio;
  recorrente: boolean;
  quem?: Autor;
  privado: boolean;
  dividir: boolean;
  /** Editando uma parcela ou conta recorrente: aplica às próximas do grupo. */
  aplicarProximas: boolean;
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
  /** Orçamento mensal definido para a categoria (0 = sem orçamento). */
  orcamento: number;
  /** Gasto da categoria no mês anterior (comparativo). */
  anterior: number;
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
  /** Fatura do cartão no mês em foco: compras no crédito. */
  fatura: number;
  faturaItens: ItemDecorado[];
  faturaVence: string;
  /** Categorias com orçamento que já passaram do valor definido. */
  estourados: Categoria[];
  dias: Record<number, DiaResumo>;
  visiveis: ItemDecorado[];
  /** Entradas ainda não recebidas até o fim do mês. */
  aReceber: number;
  /** Saldo depois de pagar as contas em aberto e receber o que falta. */
  livre: number;
  /** Saldo dia a dia: realizado até hoje, previsto depois. */
  projecao: PontoSaldo[];
  /** Contas do mês por dia de vencimento (calendário). */
  vencimentos: Record<number, Vencimento[]>;
  /** Fatura do cartão do mês em foco e das 5 seguintes. */
  faturas: { chave: string; label: string; valor: number }[];
}

export interface PontoSaldo {
  dia: number;
  real: number | null;
  previsto: number | null;
}

export interface Vencimento {
  id: number;
  descricao: string;
  valor: number;
  estado: "pago" | "pendente" | "atrasado";
}
