import type { Categoria, Derivado, DiaResumo, Item, ItemDecorado, MesSerie, RegraItem } from "../types";
import { CORES, DESEJOS, ESSENCIAIS, LIMITE_MENSAL, MESES, POR_PAGINA } from "./constants";
import { DIA_HOJE, MES_REF, dataFmt, mesAnterior, pad, pct } from "./helpers";
import { token } from "./storage";

export interface DerivarState {
  itens: Item[];
  mesRef: string;
  pagina: number;
  query: string;
  tipoFiltro: "todos" | "entrada" | "saida";
  statusFiltro: "todos" | "pago" | "pendente";
  privado: boolean;
}

// Formata um valor em reais ou oculta quando o modo privado está ligado.
export const fazerFmt = (privado: boolean) => (valor: number) => (
  privado ? "••••••" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(valor || 0)
);

// Ordena as movimentações da mais recente para a mais antiga.
const ordenar = (itens: Item[]) => [...itens].sort((a, b) => (
  a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id
));

// Meses que fazem sentido visitar: dos lançamentos até o mês corrente.
export const limitesDeMes = (itens: Item[]) => {
  const chaves = itens.map((i) => i.data.slice(0, 7)).concat(MES_REF);
  return { primeiro: chaves.reduce((a, b) => (a < b ? a : b)), ultimo: chaves.reduce((a, b) => (a > b ? a : b)) };
};

const somaTipo = (itens: Item[], tipo: "entrada" | "saida") => itens
  .filter((i) => i.tipo === tipo)
  .reduce((total, i) => total + i.valor, 0);

const somaValores = (itens: Item[]) => itens.reduce((total, i) => total + i.valor, 0);

const porCategoria = (itensMes: Item[]): Categoria[] => Object.entries(
  itensMes
    .filter((i) => i.tipo === "saida")
    .reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.categoria]: (acc[i.categoria] || 0) + i.valor }), {}),
)
  .map(([nome, valor]) => ({ nome, valor }))
  .sort((a, b) => b.valor - a.valor)
  .map((cat, indice) => ({ ...cat, cor: CORES[indice % CORES.length] }));

const porDia = (itensMes: Item[]): Record<number, DiaResumo> => itensMes.reduce<Record<number, DiaResumo>>((acc, i) => {
  const dia = Number(i.data.slice(8));
  const atual = acc[dia] || { entradas: 0, saidas: 0 };
  return {
    ...acc,
    [dia]: i.tipo === "entrada"
      ? { ...atual, entradas: atual.entradas + i.valor }
      : { ...atual, saidas: atual.saidas + i.valor },
  };
}, {});

const serieMeses = (itens: Item[], mesRef: string): MesSerie[] => Array.from({ length: 12 }, (_, i) => {
  const [a, m] = mesRef.split("-").map(Number);
  const d = new Date(a, m - 1 - (11 - i), 1);
  return { chave: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MESES[d.getMonth()] };
}).map(({ chave, label }) => {
  const doMes = itens.filter((i) => i.data.slice(0, 7) === chave);
  return { chave, label, entradas: somaTipo(doMes, "entrada"), saidas: somaTipo(doMes, "saida") };
});

const filtrarVisiveis = (itens: Item[], s: DerivarState) => {
  const busca = s.query.trim().toLowerCase();
  return itens
    .filter((i) => s.tipoFiltro === "todos" || i.tipo === s.tipoFiltro)
    .filter((i) => s.statusFiltro === "todos" || i.status === s.statusFiltro)
    .filter((i) => !busca
      || i.descricao.toLowerCase().includes(busca)
      || i.categoria.toLowerCase().includes(busca));
};

// Devolve uma cópia da movimentação com os campos prontos para exibição.
export const decorar = (item: Item, fmt: (v: number) => string): ItemDecorado => ({
  ...item,
  sinal: item.tipo === "entrada" ? "+" : "-",
  classeCor: item.tipo === "entrada" ? "is-in-text" : "is-out-text",
  iconBg: item.tipo === "entrada" ? `rgba(${token("--in-rgb")}, 0.16)` : `rgba(${token("--out-rgb")}, 0.16)`,
  valorFmt: `${item.tipo === "entrada" ? "+ " : "- "}${fmt(item.valor)}`,
  valorSimples: fmt(item.valor),
  dataLabel: dataFmt(item.data),
  statusLabel: item.status === "pendente" ? "Pendente" : "Concluído",
  statusClasse: item.status === "pendente" ? "is-pending" : "is-done",
});

// Calcula tudo o que a tela precisa a partir do estado atual.
// Equivale a derivar() no app.js original, incluindo a leitura de tokens de
// cor do CSS (que acompanham o tema) através de decorar().
export const derivar = (s: DerivarState): Derivado => {
  const fmt = fazerFmt(s.privado);
  const ordenados = ordenar(s.itens);
  const mes = ordenados.filter((i) => i.data.slice(0, 7) === s.mesRef);

  const entradas = somaTipo(mes, "entrada");
  const saidas = somaTipo(mes, "saida");

  // Quanto o mês rendeu por si só: é isto que zera quando o mês vira.
  const resultado = entradas - saidas;

  // O saldo, não. Ele é acumulado: soma tudo que já aconteceu até o fim do
  // mês em foco. Datas ISO comparam como texto, e nenhum dia passa de 31.
  const ateAqui = ordenados.filter((i) => i.data <= `${s.mesRef}-31`);
  const saldo = somaTipo(ateAqui, "entrada") - somaTipo(ateAqui, "saida");

  // Conta em aberto também não deixa de existir quando o mês vira.
  const pendentesBrutos = ateAqui
    .filter((i) => i.tipo === "saida" && i.status === "pendente")
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const aPagar = somaValores(pendentesBrutos);

  const ateMesAnterior = ordenados.filter((i) => i.data <= `${mesAnterior(s.mesRef)}-31`);
  const saldoAnt = somaTipo(ateMesAnterior, "entrada") - somaTipo(ateMesAnterior, "saida");
  const variacao = saldoAnt ? Math.round(((saldo - saldoAnt) / Math.abs(saldoAnt)) * 100) : 0;

  const serie = serieMeses(ordenados, s.mesRef);

  const categorias = porCategoria(mes);
  const totalCategorias = categorias.reduce((total, c) => total + c.valor, 0) || 1;

  const saidasMes = mes.filter((i) => i.tipo === "saida");
  const gastoMedio = saidasMes.length ? somaValores(saidasMes) / saidasMes.length : 0;
  const maiorSaida = [...saidasMes].sort((a, b) => b.valor - a.valor)[0];

  const somaDeCategorias = (lista: string[]) => saidasMes
    .filter((i) => lista.includes(i.categoria))
    .reduce((total, i) => total + i.valor, 0);

  const essenciais = somaDeCategorias(ESSENCIAIS);
  const desejos = somaDeCategorias(DESEJOS);
  const futuro = Math.max(0, saidas - essenciais - desejos) + Math.max(0, resultado);

  // O calendário do mês em foco, que nem sempre é o mês do relógio.
  const [anoRef, numeroMes] = s.mesRef.split("-").map(Number);
  const diasDoMes = new Date(anoRef, numeroMes, 0).getDate();
  const ehMesAtual = s.mesRef === MES_REF;
  const diaDeHoje = ehMesAtual ? DIA_HOJE : 0;
  const diasCorridos = ehMesAtual ? DIA_HOJE : diasDoMes;

  const visiveis = filtrarVisiveis(ordenados, s).map((i) => decorar(i, fmt));

  // Os totais continuam somando a lista filtrada inteira, não só a página.
  const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const pagina = Math.min(s.pagina, paginas);
  const daPagina = visiveis.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const regra: RegraItem[] = [
    { nome: "Essenciais", valor: essenciais, cor: "#6f5cf0" },
    { nome: "Desejos", valor: desejos, cor: "#d94f6e" },
    { nome: "Futuro", valor: futuro, cor: "#10a88f" },
  ];

  return {
    diasDoMes,
    diaDeHoje,
    diasCorridos,
    ehMesAtual,
    paginas,
    pagina,
    daPagina,
    ordenados,
    mes,
    entradas,
    saidas,
    saldo,
    resultado,
    pendentes: pendentesBrutos.map((i) => decorar(i, fmt)),
    aPagar,
    variacao,
    serie,
    categorias,
    totalCategorias,
    gastoMedio,
    maiorSaida,
    regra,
    baseRegra: essenciais + desejos + futuro || 1,
    limite: LIMITE_MENSAL,
    limitePct: pct(saidas, LIMITE_MENSAL),
    dias: porDia(mes),
    visiveis,
  };
};
