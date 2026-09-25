import type { Autor, Categoria, Derivado, DiaResumo, Item, ItemDecorado, MesSerie, PontoSaldo, RegraItem, Vencimento } from "../types";
import { CORES, DESEJOS, ESSENCIAIS, LIMITE_MENSAL, MESES, POR_PAGINA } from "./constants";
import { DIA_HOJE, HOJE_ISO, MES_REF, dataFmt, mesAnterior, pad, pct, prazoDe } from "./helpers";
import { token } from "./storage";

export interface DerivarState {
  itens: Item[];
  mesRef: string;
  pagina: number;
  query: string;
  tipoFiltro: "todos" | "entrada" | "saida";
  statusFiltro: "todos" | "pago" | "pendente";
  /** Filtro por autor (conta Duo); ausente no Solo. */
  quemFiltro?: "todos" | Autor;
  privado: boolean;
  /** Limite mensal da conta (Configurações > Finanças). */
  limite?: number;
  /** Orçamento por categoria e cor fixa de cada uma (lib/ajustes). */
  orcamentos?: Record<string, number>;
  corDe?: (categoria: string) => string;
  /** Dia de vencimento da fatura do cartão. */
  venceFatura?: number;
  /** Filtros extras da lista: uma categoria e só compras no cartão. */
  categoriaFiltro?: string;
  cartaoFiltro?: boolean;
  /** Conta Duo: lançamentos privados desta pessoa aparecem sem detalhes. */
  privadosDe?: Autor;
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

const liquido = (itens: Item[]) => somaTipo(itens, "entrada") - somaTipo(itens, "saida");

const saidasPorCategoria = (itens: Item[]) => itens
  .filter((i) => i.tipo === "saida")
  .reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.categoria]: (acc[i.categoria] || 0) + i.valor }), {});

// Cada categoria mantém a mesma cor em qualquer mês; sem mapa de cores, cai na
// paleta por posição (comportamento antigo).
const porCategoria = (itensMes: Item[], anterior: Record<string, number>, orcamentos: Record<string, number>, corDe?: (c: string) => string): Categoria[] => Object.entries(
  saidasPorCategoria(itensMes),
)
  .map(([nome, valor]) => ({ nome, valor }))
  .sort((a, b) => b.valor - a.valor)
  .map((cat, indice) => ({ ...cat, cor: corDe ? corDe(cat.nome) : CORES[indice % CORES.length], orcamento: orcamentos[cat.nome] || 0, anterior: anterior[cat.nome] || 0 }));

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

/** Os `n` meses que terminam em `mesRef`, com entradas e saídas de cada um. */
export const mesesAte = (itens: Item[], mesRef: string, n: number): MesSerie[] => {
  const [a, m] = mesRef.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(a, m - 1 - (n - 1 - i), 1);
    const chave = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const doMes = itens.filter((it) => it.data.slice(0, 7) === chave);
    return { chave, label: MESES[d.getMonth()], entradas: somaTipo(doMes, "entrada"), saidas: somaTipo(doMes, "saida") };
  });
};

// Começa no primeiro mês com lançamentos (no mínimo 6, no máximo 12 meses),
// para o gráfico não abrir com meses vazios à esquerda.
const serieMeses = (itens: Item[], mesRef: string): MesSerie[] => {
  const primeiro = itens.reduce((min, i) => (i.data.slice(0, 7) < min ? i.data.slice(0, 7) : min), mesRef);
  const [a, m] = mesRef.split("-").map(Number);
  const [pa, pm] = primeiro.split("-").map(Number);
  const comDados = (a - pa) * 12 + (m - pm) + 1;
  return mesesAte(itens, mesRef, Math.min(12, Math.max(6, comDados)));
};

const filtrarVisiveis = (itens: Item[], s: DerivarState) => {
  const busca = s.query.trim().toLowerCase();
  return itens
    .filter((i) => s.tipoFiltro === "todos" || i.tipo === s.tipoFiltro)
    .filter((i) => s.statusFiltro === "todos" || i.status === s.statusFiltro)
    .filter((i) => !s.quemFiltro || s.quemFiltro === "todos" || i.quem === s.quemFiltro)
    .filter((i) => !s.categoriaFiltro || i.categoria === s.categoriaFiltro)
    .filter((i) => !s.cartaoFiltro || i.meio === "cartao")
    .filter((i) => !busca
      || i.descricao.toLowerCase().includes(busca)
      || i.categoria.toLowerCase().includes(busca));
};

/** A movimentação em edição tem próximas ocorrências (parcelas ou meses de uma recorrente)? */
export const grupoDe = (itens: Item[], id: number | null): "parcela" | "recorrente" | null => {
  const item = id ? itens.find((i) => i.id === id) : undefined;
  if (!item?.grupo || !itens.some((i) => i.grupo === item.grupo && i.data > item.data)) return null;
  return item.parcela ? "parcela" : "recorrente";
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
  prazo: item.status === "pendente" && item.tipo === "saida" ? prazoDe(item.data) : null,
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

  // O saldo, não. Ele é acumulado: soma o que já foi pago ou recebido até o
  // fim do mês em foco. Contas em aberto ficam de fora (entram em "A pagar").
  // Datas ISO comparam como texto, e nenhum dia passa de 31.
  const ateAqui = ordenados.filter((i) => i.data <= `${s.mesRef}-31`);
  const saldo = liquido(ateAqui.filter((i) => i.status === "pago"));

  // Conta em aberto também não deixa de existir quando o mês vira.
  const pendentesBrutos = ateAqui
    .filter((i) => i.tipo === "saida" && i.status === "pendente")
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const aPagar = somaValores(pendentesBrutos);
  const aReceber = somaValores(ateAqui.filter((i) => i.tipo === "entrada" && i.status === "pendente"));
  const livre = saldo - aPagar + aReceber;

  const saldoAnt = liquido(ordenados.filter((i) => i.data <= `${mesAnterior(s.mesRef)}-31` && i.status === "pago"));
  const variacao = saldoAnt ? Math.round(((saldo - saldoAnt) / Math.abs(saldoAnt)) * 100) : 0;

  const serie = serieMeses(ordenados, s.mesRef);

  const orcamentos = s.orcamentos ?? {};
  const anterior = saidasPorCategoria(ordenados.filter((i) => i.data.slice(0, 7) === mesAnterior(s.mesRef)));
  const categorias = porCategoria(mes, anterior, orcamentos, s.corDe);
  // Categorias com orçamento que ainda não tiveram gasto também aparecem (valor zero).
  Object.entries(orcamentos)
    .filter(([nome, v]) => v > 0 && !categorias.some((c) => c.nome === nome))
    .forEach(([nome, orcamento]) => categorias.push({ nome, valor: 0, orcamento, anterior: anterior[nome] || 0, cor: s.corDe ? s.corDe(nome) : CORES[categorias.length % CORES.length] }));
  const estourados = categorias.filter((c) => c.orcamento > 0 && c.valor > c.orcamento);
  const totalCategorias = categorias.reduce((total, c) => total + c.valor, 0) || 1;

  const saidasMes = mes.filter((i) => i.tipo === "saida");

  // Fatura do cartão: compras no crédito do mês em foco, pagas no mês seguinte.
  const noCartao = saidasMes.filter((i) => i.meio === "cartao");
  const fatura = somaValores(noCartao);
  const [anoF, mesF] = s.mesRef.split("-").map(Number);
  const venc = new Date(anoF, mesF, Math.min(s.venceFatura ?? 10, 28));
  const faturaVence = `${venc.getFullYear()}-${pad(venc.getMonth() + 1)}-${pad(venc.getDate())}`;
  const gastoMedio = saidasMes.length ? somaValores(saidasMes) / saidasMes.length : 0;
  const maiorSaida = [...saidasMes].sort((a, b) => b.valor - a.valor)[0];

  // Próximas faturas: parcelas e recorrências no cartão já lançadas.
  const faturas = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(anoF, mesF - 1 + k, 1);
    const chave = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    return {
      chave,
      label: MESES[d.getMonth()],
      valor: somaValores(ordenados.filter((i) => i.tipo === "saida" && i.meio === "cartao" && i.data.slice(0, 7) === chave)),
    };
  });

  const somaDeCategorias = (lista: string[]) => saidasMes
    .filter((i) => lista.includes(i.categoria))
    .reduce((total, i) => total + i.valor, 0);

  const essenciais = somaDeCategorias(ESSENCIAIS);
  const desejos = somaDeCategorias(DESEJOS);
  const futuro = Math.max(0, saidas - essenciais - desejos) + Math.max(0, resultado);

  // O calendário do mês em foco, que nem sempre é o mês do relógio.
  const diasDoMes = new Date(anoF, mesF, 0).getDate();
  const ehMesAtual = s.mesRef === MES_REF;
  const diaDeHoje = ehMesAtual ? DIA_HOJE : 0;
  const diasCorridos = ehMesAtual ? DIA_HOJE : diasDoMes;

  // Conta Duo: o que o par marcou como privado aparece só como valor.
  const semDetalhe = (i: Item): Item => (s.privadosDe && i.privado && i.quem === s.privadosDe
    ? { ...i, descricao: "Lançamento privado", categoria: "Privado" }
    : i);
  const visiveis = filtrarVisiveis(ordenados, s).map((i) => decorar(semDetalhe(i), fmt));

  // Os totais continuam somando a lista filtrada inteira, não só a página.
  const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const pagina = Math.min(s.pagina, paginas);
  const daPagina = visiveis.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Saldo dia a dia. Realizado: só o que foi pago até o dia. Previsto (de hoje
  // em diante, ou o mês todo se ele ainda vai chegar): tudo, inclusive as
  // contas em aberto; termina exatamente no "livre após contas".
  const antesDoMes = ordenados.filter((i) => i.data < `${s.mesRef}-01`);
  const baseReal = liquido(antesDoMes.filter((i) => i.status === "pago"));
  const baseTudo = liquido(antesDoMes);
  const ehFuturo = s.mesRef > MES_REF;
  const projecao: PontoSaldo[] = Array.from({ length: diasDoMes }, (_, k) => {
    const dia = k + 1;
    const ate = `${s.mesRef}-${pad(dia)}`;
    const noMes = mes.filter((i) => i.data <= ate);
    const real = baseReal + liquido(noMes.filter((i) => i.status === "pago"));
    const previsto = baseTudo + liquido(noMes);
    if (ehFuturo) return { dia, real: null, previsto };
    if (!ehMesAtual || dia < DIA_HOJE) return { dia, real, previsto: null };
    if (dia === DIA_HOJE) return { dia, real, previsto: real };
    return { dia, real: null, previsto };
  });

  // Calendário: contas do mês em aberto ou recorrentes, com o estado de cada uma.
  const vencimentos = saidasMes
    .filter((i) => i.status === "pendente" || i.recorrente)
    .reduce<Record<number, Vencimento[]>>((acc, i) => {
      const dia = Number(i.data.slice(8));
      const estado: Vencimento["estado"] = i.status === "pago" ? "pago" : i.data < HOJE_ISO ? "atrasado" : "pendente";
      return { ...acc, [dia]: [...(acc[dia] || []), { id: i.id, descricao: i.descricao, valor: i.valor, estado }] };
    }, {});

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
    limite: s.limite ?? LIMITE_MENSAL,
    limitePct: pct(saidas, s.limite ?? LIMITE_MENSAL),
    fatura,
    faturaItens: noCartao.map((i) => decorar(i, fmt)),
    faturaVence,
    estourados,
    dias: porDia(mes),
    visiveis,
    aReceber,
    livre,
    projecao,
    vencimentos,
    faturas,
  };
};
