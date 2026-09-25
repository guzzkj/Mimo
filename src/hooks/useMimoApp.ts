import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { derivar, fazerFmt, limitesDeMes } from "../lib/derive";
import {
  dataAdiante, dataBr, dividirEmParcelas, formVazio, isoDeBr, MES_REF, moedaTexto, pad, parseNum,
} from "../lib/helpers";
import { carregarItens, persistir, salvarTema, temaSalvo } from "../lib/storage";
import { corDaCategoria, lerAjustes, useAjustes, type ContaAjustes } from "../lib/ajustes";
import { sincronizarAvisos } from "../lib/notificacoes";
import { exportarCsv as exportarCsvArquivo } from "../lib/csv";
import type { Autor, FormState, Item, StatusMovimentacao, Tema, TipoMovimentacao, View } from "../types";
import { useToasts } from "./useToasts";

interface State {
  view: View;
  itens: Item[];
  mesRef: string;
  pagina: number;
  query: string;
  tipoFiltro: "todos" | TipoMovimentacao;
  statusFiltro: "todos" | StatusMovimentacao;
  quemFiltro: "todos" | Autor;
  /** "" = todas as categorias. */
  categoriaFiltro: string;
  cartaoFiltro: boolean;
  drawer: boolean;
  drawerLeaving: boolean;
  privado: boolean;
  tema: Tema;
  flip: boolean;
  modal: boolean;
  editando: number | null;
  excluir: Item | null;
  erro: string;
  form: FormState;
}

// Conta que alimenta o motor: sem opções é o painel Solo (chave e seed padrão).
export interface OpcoesMimoApp {
  storageKey?: string;
  seed?: Item[];
  /** Conta Duo: cada movimentação tem autor; este é o padrão das novas. */
  autorPadrao?: Autor;
  /** De qual conta vêm limite, orçamentos e cartão (lib/ajustes). */
  conta?: ContaAjustes;
  /** Conta Duo: lançamentos privados desta pessoa aparecem sem detalhes e não se editam. */
  privadosDe?: Autor;
}

// Itens salvos antes de existir o campo `quem`: recupera o autor do exemplo
// (mesmo id e descrição) e, sem correspondência, trata como conta conjunta.
const comAutor = (itens: Item[], seed: Item[] = []): Item[] => itens.map((i) => (i.quem ? i : {
  ...i,
  quem: seed.find((x) => x.id === i.id && x.descricao === i.descricao)?.quem ?? "conjunta",
}));

// Conta Duo: nova saída começa compartilhada e dividida (dá para mudar no formulário).
const formNovo = (autorPadrao?: Autor): FormState => (autorPadrao ? { ...formVazio(), quem: autorPadrao, dividir: true } : formVazio());

const estadoInicial = (opcoes: OpcoesMimoApp): State => ({
  view: "geral",
  itens: opcoes.autorPadrao
    ? comAutor(carregarItens(opcoes.storageKey, opcoes.seed), opcoes.seed)
    : carregarItens(opcoes.storageKey, opcoes.seed),
  mesRef: MES_REF,
  pagina: 1,
  query: "",
  tipoFiltro: "todos",
  statusFiltro: "todos",
  quemFiltro: "todos",
  categoriaFiltro: "",
  cartaoFiltro: false,
  drawer: false,
  drawerLeaving: false,
  // Configurações > Aparência: "Abrir o app com valores ocultos"
  privado: lerAjustes(opcoes.conta ?? "solo").abrirOculto,
  tema: temaSalvo(),
  flip: false,
  modal: false,
  editando: null,
  excluir: null,
  erro: "",
  form: formNovo(opcoes.autorPadrao),
});

export function useMimoApp(opcoes: OpcoesMimoApp = {}) {
  const [state, setState] = useState<State>(() => estadoInicial(opcoes));
  const { storageKey, autorPadrao, privadosDe } = opcoes;
  const conta: ContaAjustes = opcoes.conta ?? "solo";
  const ajustes = useAjustes(conta);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Telas que seguem a conta ativa (Solo ou Duo) podem trocar de conta sem
  // desmontar: ao mudar a chave, recarrega as movimentações da outra conta.
  const opcoesRef = useRef(opcoes);
  const chaveCarregada = useRef(storageKey);
  useEffect(() => { opcoesRef.current = opcoes; });
  useEffect(() => {
    if (chaveCarregada.current === storageKey) return;
    chaveCarregada.current = storageKey;
    const o = opcoesRef.current;
    const carregados = carregarItens(o.storageKey, o.seed);
    setState((s) => ({
      ...s,
      itens: o.autorPadrao ? comAutor(carregados, o.seed) : carregados,
      pagina: 1,
      quemFiltro: "todos",
      categoriaFiltro: "",
      cartaoFiltro: false,
      modal: false,
      editando: null,
      excluir: null,
      form: formNovo(o.autorPadrao),
    }));
  }, [storageKey]);
  const { toasts, avisar } = useToasts();

  // Carinho no mascote: enquanto dura, a expressão do topo não muda sozinha.
  const [ronronando, setRonronando] = useState(false);
  const [coracoes, setCoracoes] = useState<{ id: number; left: number; width: number; delay: number; dx: number; giro: number }[]>([]);
  const proximoCoracaoId = useRef(1);
  const ultimaAcaoSalvar = useRef<"edicao" | "edicao-grupo" | "nova" | "recorrente" | number | null>(null);

  const patch = useCallback((p: Partial<State>) => setState((s) => ({ ...s, ...p })), []);
  const setForm = useCallback((p: Partial<FormState>) => setState((s) => ({ ...s, form: { ...s.form, ...p }, erro: "" })), []);
  const setFiltro = useCallback((p: Partial<State>) => setState((s) => ({ ...s, ...p, pagina: 1 })), []);

  const fmt = useMemo(() => fazerFmt(state.privado), [state.privado]);

  const derivado = useMemo(() => derivar({
    itens: state.itens,
    mesRef: state.mesRef,
    pagina: state.pagina,
    query: state.query,
    tipoFiltro: state.tipoFiltro,
    statusFiltro: state.statusFiltro,
    quemFiltro: state.quemFiltro,
    categoriaFiltro: state.categoriaFiltro || undefined,
    cartaoFiltro: state.cartaoFiltro,
    privadosDe,
    privado: state.privado,
    limite: ajustes.limite,
    orcamentos: ajustes.orcamentos,
    corDe: (c: string) => corDaCategoria(ajustes, c),
    venceFatura: ajustes.cartao.vence,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state.itens, state.mesRef, state.pagina, state.query, state.tipoFiltro, state.statusFiltro, state.quemFiltro, state.categoriaFiltro, state.cartaoFiltro, privadosDe, state.privado, state.tema, ajustes]);

  // Avisos do sino nascem dos próprios dados da conta (contas vencendo, limite,
  // orçamentos e fatura), sempre olhando o mês corrente.
  useEffect(() => {
    sincronizarAvisos(conta, state.itens, ajustes);
  }, [conta, state.itens, ajustes]);

  const limites = useMemo(() => limitesDeMes(state.itens), [state.itens]);

  // Lançamento privado do par: só quem lançou vê e mexe.
  const ehDoPar = useCallback((item: Item | undefined) => Boolean(item && privadosDe && item.privado && item.quem === privadosDe), [privadosDe]);

  const gravar = useCallback((itens: Item[]) => {
    persistir(itens, storageKey);
    setState((s) => ({ ...s, itens }));
  }, [storageKey]);

  // Navegação de view/mês -------------------------------------------------

  const irPara = useCallback((view: View) => patch({ view }), [patch]);

  const andarMes = useCallback((passo: number) => {
    setState((s) => {
      const [ano, mes] = s.mesRef.split("-").map(Number);
      const d = new Date(ano, mes - 1 + passo, 1);
      const alvo = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const { primeiro, ultimo } = limitesDeMes(s.itens);
      if (alvo < primeiro || alvo > ultimo) return s;
      return { ...s, mesRef: alvo };
    });
  }, []);

  const irParaHoje = useCallback(() => patch({ mesRef: MES_REF }), [patch]);

  // Abre a lista já filtrada por uma categoria (clique em Categorias).
  const verCategoria = useCallback((categoria: string) => {
    setState((s) => ({ ...s, view: "lista", categoriaFiltro: categoria, tipoFiltro: "todos", pagina: 1 }));
  }, []);

  // Modal de cadastro/edição -----------------------------------------------

  const abrirNova = useCallback(() => patch({ modal: true, editando: null, erro: "", form: formNovo(autorPadrao) }), [patch, autorPadrao]);

  const abrirEdicao = useCallback((id: number) => {
    const item = stateRef.current.itens.find((i) => i.id === id);
    if (!item) return;
    if (ehDoPar(item)) { avisar("Lançamento privado de Suelen: só ela vê os detalhes.", "#mimo-gato-curioso"); return; }
    setState((s) => ({
      ...s,
      modal: true,
      editando: id,
      erro: "",
      form: {
        ...item,
        valor: moedaTexto(item.valor),
        data: dataBr(item.data),
        parcelado: false,
        parcelas: "2",
        meio: item.meio ?? "conta",
        recorrente: Boolean(item.recorrente),
        privado: Boolean(item.privado),
        dividir: Boolean(item.dividir),
        aplicarProximas: false,
      },
    }));
  }, [ehDoPar, avisar]);

  const fecharModal = useCallback(() => patch({ modal: false, editando: null, erro: "" }), [patch]);

  const salvar = useCallback(() => {
    ultimaAcaoSalvar.current = null;
    setState((s) => {
      const { descricao, valor, data, tipo, categoria, status, parcelado, parcelas, recorrente } = s.form;
      const numero = parseNum(valor);

      if (!descricao.trim()) return { ...s, erro: "Informe uma descrição para a movimentação." };
      if (Number.isNaN(numero) || numero <= 0) return { ...s, erro: "Informe um valor maior que zero." };
      const dataIso = isoDeBr(data);
      if (!dataIso) return { ...s, erro: "Informe uma data válida, no formato dd/mm/aaaa." };
      if (s.form.quem === "conjunta" && s.form.privado) return { ...s, erro: "Lançamentos da conta conjunta são sempre compartilhados." };

      const meio = tipo === "saida" ? s.form.meio : "conta";
      // Conta Duo: privado e dividir só fazem sentido com autor; dividir, só em
      // saída compartilhada paga por um dos dois.
      const duo = s.form.quem
        ? {
          quem: s.form.quem,
          privado: s.form.quem !== "conjunta" && s.form.privado,
          dividir: tipo === "saida" && s.form.quem !== "conjunta" && !s.form.privado && s.form.dividir,
        }
        : {};
      const comum = { tipo, descricao: descricao.trim(), categoria, valor: numero, meio, ...duo };
      const registro = { ...comum, data: dataIso, status };
      const ultimoId = s.itens.reduce((max, i) => Math.max(max, i.id), 0);

      // Parcelar e repetir só fazem sentido ao criar; editando, mexe-se numa
      // ocorrência (ou nela e nas próximas do mesmo grupo).
      const quantas = !s.editando && parcelado ? Number(parcelas) : 1;
      const repete = !s.editando && !parcelado && recorrente;
      const grupo = quantas > 1 || repete ? ultimoId + 1 : undefined;

      // Conta recorrente: registra 12 meses; os futuros ficam pendentes e
      // aparecem como contas a vencer em cada mês.
      const novos: Item[] = repete
        ? Array.from({ length: 12 }, (_, i) => ({
          ...registro,
          id: ultimoId + 1 + i,
          data: dataAdiante(dataIso, i),
          status: i === 0 ? status : "pendente",
          recorrente: true,
          grupo,
        }))
        : dividirEmParcelas(numero, quantas).map((fatia, i) => ({
          ...registro,
          id: ultimoId + 1 + i,
          valor: fatia,
          data: dataAdiante(dataIso, i),
          // No cartão, cada parcela entra na fatura do mês dela.
          status: i === 0 || meio === "cartao" ? status : "pendente",
          ...(quantas > 1 ? { parcela: { n: i + 1, total: quantas }, grupo } : {}),
        }));

      const original = s.itens.find((i) => i.id === s.editando);
      const emGrupo = Boolean(s.editando && s.form.aplicarProximas && original?.grupo);
      // "Aplicar às próximas": mesma descrição, categoria, valor, meio e autor
      // nas ocorrências seguintes do grupo; data e status de cada uma ficam.
      const itens = s.editando
        ? s.itens.map((i) => {
          if (i.id === s.editando) return { ...i, ...registro };
          if (emGrupo && i.grupo === original!.grupo && i.data > original!.data) return { ...i, ...comum };
          return i;
        })
        : [...novos, ...s.itens];

      persistir(itens, storageKey);

      // Guardado num ref (e não chamado aqui dentro) porque a função passada
      // a setState pode rodar mais de uma vez em desenvolvimento (StrictMode);
      // o aviso deve disparar só uma vez, depois que o novo estado for aplicado.
      ultimaAcaoSalvar.current = s.editando ? (emGrupo ? "edicao-grupo" : "edicao") : repete ? "recorrente" : (quantas > 1 ? quantas : "nova");

      return { ...s, itens, modal: false, editando: null, erro: "" };
    });

    const acao = ultimaAcaoSalvar.current;
    if (acao === "edicao") avisar("Alterações salvas");
    else if (acao === "edicao-grupo") avisar("Alterações salvas nesta e nas próximas");
    else if (typeof acao === "number") avisar(`${acao} parcelas adicionadas`);
    else if (acao === "recorrente") avisar("Conta recorrente criada para os próximos 12 meses");
    else if (acao === "nova") avisar("Movimentação adicionada");
  }, [avisar, storageKey]);

  // Exclusão ----------------------------------------------------------------

  const pedirExclusao = useCallback((id: number) => {
    const item = stateRef.current.itens.find((i) => i.id === id);
    if (ehDoPar(item)) { avisar("Lançamento privado de Suelen: só ela pode excluir.", "#mimo-gato-curioso"); return; }
    setState((s) => ({ ...s, excluir: item || null }));
  }, [ehDoPar, avisar]);

  const cancelarExclusao = useCallback(() => patch({ excluir: null }), [patch]);

  const confirmarExclusao = useCallback(() => {
    const alvo = stateRef.current.excluir;
    if (!alvo) return;
    const antes = stateRef.current.itens;
    const itens = antes.filter((i) => i.id !== alvo.id);
    persistir(itens, storageKey);
    setState((s) => ({ ...s, itens, excluir: null }));
    // Desfazer devolve o item exatamente onde estava.
    avisar("Movimentação excluída", "#mimo-gato-preocupado", {
      label: "Desfazer",
      onClick: () => {
        const atual = stateRef.current.itens;
        if (atual.some((i) => i.id === alvo.id)) return;
        gravar([...atual, alvo]);
      },
    });
  }, [avisar, storageKey, gravar]);

  // Marca contas pendentes como pagas (painel lateral, sino e ação em lote).
  const marcarPagas = useCallback((ids: number[]) => {
    const alvo = new Set(ids);
    gravar(stateRef.current.itens.map((i) => (alvo.has(i.id) ? { ...i, status: "pago" as const } : i)));
  }, [gravar]);

  const marcarPaga = useCallback((id: number) => marcarPagas([id]), [marcarPagas]);

  // Painel lateral ------------------------------------------------------

  const alternarPainel = useCallback(() => {
    setState((s) => {
      if (!s.drawer) return { ...s, drawer: true };
      return { ...s, drawerLeaving: true };
    });
  }, []);

  useEffect(() => {
    if (!state.drawerLeaving) return;
    const id = setTimeout(() => {
      setState((s) => ({ ...s, drawer: false, drawerLeaving: false }));
    }, 330);
    return () => clearTimeout(id);
  }, [state.drawerLeaving]);

  // Tema --------------------------------------------------------------------

  const aplicarTemaNoDom = useCallback((tema: Tema) => {
    if (tema === "escuro") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    salvarTema(tema);
  }, []);

  const trocarTema = useCallback(() => {
    setState((s) => {
      const tema: Tema = s.tema === "escuro" ? "claro" : "escuro";
      aplicarTemaNoDom(tema);
      return { ...s, tema };
    });
  }, [aplicarTemaNoDom]);

  // Abre o tema novo a partir do botão, num círculo que cresce até cobrir a tela.
  const alternarTema = useCallback((botao: HTMLElement | null) => {
    const semAnimacao = !document.startViewTransition || !botao;
    if (semAnimacao) {
      trocarTema();
      return;
    }

    const area = botao.getBoundingClientRect();
    const x = area.left + area.width / 2;
    const y = area.top + area.height / 2;
    const raio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const raiz = document.documentElement;
    raiz.style.setProperty("--tema-x", `${x}px`);
    raiz.style.setProperty("--tema-y", `${y}px`);
    raiz.style.setProperty("--tema-r", `${Math.ceil(raio)}px`);

    document.startViewTransition!(trocarTema);
  }, [trocarTema]);

  // Modo privado, cartão, mascote -------------------------------------------

  const alternarPrivacidade = useCallback(() => patch({ privado: !state.privado }), [patch, state.privado]);
  const virarCartao = useCallback(() => patch({ flip: !state.flip }), [patch, state.flip]);

  const ronronar = useCallback(() => {
    if (ronronando) return;
    setRonronando(true);

    const novos = Array.from({ length: 5 }, (_, k) => ({
      id: proximoCoracaoId.current++,
      left: 58 + Math.random() * 116,
      width: 21 + Math.random() * 12,
      delay: k * 110,
      dx: Math.random() * 44 - 22,
      giro: Math.random() * 44 - 22,
    }));
    setCoracoes((atual) => [...atual, ...novos]);
    novos.forEach((c, k) => {
      setTimeout(() => setCoracoes((atual) => atual.filter((x) => x.id !== c.id)), 2700 + k * 110);
    });

    setTimeout(() => setRonronando(false), 1550);
  }, [ronronando]);

  // Paginação -----------------------------------------------------------

  const paginaAnterior = useCallback(() => patch({ pagina: Math.max(1, state.pagina - 1) }), [patch, state.pagina]);
  const paginaProxima = useCallback(() => patch({ pagina: state.pagina + 1 }), [patch, state.pagina]);

  // CSV -----------------------------------------------------------------

  const exportarCsv = useCallback(() => exportarCsvArquivo(state.itens), [state.itens]);

  // Atalhos de teclado: Esc fecha (confirmação -> modal -> painel), Enter salva.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        if (state.excluir) { cancelarExclusao(); return; }
        if (state.modal) { fecharModal(); return; }
        if (state.drawer) { alternarPainel(); return; }
      }
      if (evento.key === "Enter" && state.modal && !(evento.target instanceof HTMLButtonElement)) salvar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [state.excluir, state.modal, state.drawer, cancelarExclusao, fecharModal, alternarPainel, salvar]);

  return {
    state,
    derivado,
    limites,
    fmt,
    toasts,
    avisar,
    ronronando,
    coracoes,
    ajustes,
    actions: {
      irPara,
      andarMes,
      irParaHoje,
      verCategoria,
      abrirNova,
      abrirEdicao,
      fecharModal,
      salvar,
      setForm,
      setFiltro,
      pedirExclusao,
      cancelarExclusao,
      confirmarExclusao,
      alternarPainel,
      alternarTema,
      alternarPrivacidade,
      virarCartao,
      ronronar,
      paginaAnterior,
      paginaProxima,
      exportarCsv,
      marcarPaga,
      marcarPagas,
      setBusca: (query: string) => setFiltro({ query }),
    },
  };
}

export type MimoApp = ReturnType<typeof useMimoApp>;
