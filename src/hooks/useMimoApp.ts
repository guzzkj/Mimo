import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { derivar, fazerFmt, limitesDeMes } from "../lib/derive";
import {
  dataAdiante, dataBr, dividirEmParcelas, formVazio, isoDeBr, MES_REF, pad, parseNum,
} from "../lib/helpers";
import { carregarItens, persistir, salvarTema, temaSalvo } from "../lib/storage";
import { exportarCsv as exportarCsvArquivo } from "../lib/csv";
import type { FormState, Item, StatusMovimentacao, Tema, TipoMovimentacao, View } from "../types";
import { useToasts } from "./useToasts";

interface State {
  view: View;
  itens: Item[];
  mesRef: string;
  pagina: number;
  query: string;
  tipoFiltro: "todos" | TipoMovimentacao;
  statusFiltro: "todos" | StatusMovimentacao;
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

const estadoInicial = (): State => ({
  view: "geral",
  itens: carregarItens(),
  mesRef: MES_REF,
  pagina: 1,
  query: "",
  tipoFiltro: "todos",
  statusFiltro: "todos",
  drawer: false,
  drawerLeaving: false,
  privado: false,
  tema: temaSalvo(),
  flip: false,
  modal: false,
  editando: null,
  excluir: null,
  erro: "",
  form: formVazio(),
});

export function useMimoApp() {
  const [state, setState] = useState<State>(estadoInicial);
  const { toasts, avisar } = useToasts();

  // Carinho no mascote: enquanto dura, a expressão do topo não muda sozinha.
  const [ronronando, setRonronando] = useState(false);
  const [coracoes, setCoracoes] = useState<{ id: number; left: number; width: number; delay: number; dx: number; giro: number }[]>([]);
  const proximoCoracaoId = useRef(1);
  const ultimaAcaoSalvar = useRef<"edicao" | "nova" | number | null>(null);

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
    privado: state.privado,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state.itens, state.mesRef, state.pagina, state.query, state.tipoFiltro, state.statusFiltro, state.privado, state.tema]);

  const limites = useMemo(() => limitesDeMes(state.itens), [state.itens]);

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

  // Modal de cadastro/edição -----------------------------------------------

  const abrirNova = useCallback(() => patch({ modal: true, editando: null, erro: "", form: formVazio() }), [patch]);

  const abrirEdicao = useCallback((id: number) => {
    setState((s) => {
      const item = s.itens.find((i) => i.id === id);
      if (!item) return s;
      return {
        ...s,
        modal: true,
        editando: id,
        erro: "",
        form: {
          ...item,
          valor: String(item.valor).replace(".", ","),
          data: dataBr(item.data),
          parcelado: false,
          parcelas: "2",
        },
      };
    });
  }, []);

  const fecharModal = useCallback(() => patch({ modal: false, editando: null, erro: "" }), [patch]);

  const salvar = useCallback(() => {
    ultimaAcaoSalvar.current = null;
    setState((s) => {
      const { descricao, valor, data, tipo, categoria, status, parcelado, parcelas } = s.form;
      const numero = parseNum(valor);

      if (!descricao.trim()) return { ...s, erro: "Informe uma descrição para a movimentação." };
      if (Number.isNaN(numero) || numero <= 0) return { ...s, erro: "Informe um valor maior que zero." };
      const dataIso = isoDeBr(data);
      if (!dataIso) return { ...s, erro: "Informe uma data válida, no formato dd/mm/aaaa." };

      const registro = { tipo, descricao: descricao.trim(), categoria, valor: numero, data: dataIso, status };
      const ultimoId = s.itens.reduce((max, i) => Math.max(max, i.id), 0);

      // Parcelar só faz sentido ao criar; editando, mexe-se numa parcela só.
      const quantas = !s.editando && parcelado ? Number(parcelas) : 1;

      const novos: Item[] = dividirEmParcelas(numero, quantas).map((fatia, i) => ({
        ...registro,
        id: ultimoId + 1 + i,
        descricao: quantas > 1 ? `${registro.descricao} (${i + 1}/${quantas})` : registro.descricao,
        valor: fatia,
        data: dataAdiante(dataIso, i),
        status: i === 0 ? status : "pendente",
      }));

      const itens = s.editando
        ? s.itens.map((i) => (i.id === s.editando ? { ...i, ...registro } : i))
        : [...novos, ...s.itens];

      persistir(itens);

      // Guardado num ref (e não chamado aqui dentro) porque a função passada
      // a setState pode rodar mais de uma vez em desenvolvimento (StrictMode);
      // o aviso deve disparar só uma vez, depois que o novo estado for aplicado.
      ultimaAcaoSalvar.current = s.editando ? "edicao" : (quantas > 1 ? quantas : "nova");

      return { ...s, itens, modal: false, editando: null, erro: "" };
    });

    const acao = ultimaAcaoSalvar.current;
    if (acao === "edicao") avisar("Alterações salvas");
    else if (typeof acao === "number") avisar(`${acao} parcelas adicionadas`);
    else if (acao === "nova") avisar("Movimentação adicionada");
  }, [avisar]);

  // Exclusão ----------------------------------------------------------------

  const pedirExclusao = useCallback((id: number) => {
    setState((s) => ({ ...s, excluir: s.itens.find((i) => i.id === id) || null }));
  }, []);

  const cancelarExclusao = useCallback(() => patch({ excluir: null }), [patch]);

  const confirmarExclusao = useCallback(() => {
    setState((s) => {
      if (!s.excluir) return s;
      const itens = s.itens.filter((i) => i.id !== s.excluir!.id);
      persistir(itens);
      return { ...s, itens, excluir: null };
    });
    avisar("Movimentação excluída", "#mimo-gato-preocupado");
  }, [avisar]);

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
      if (evento.key === "Enter" && state.modal) salvar();
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
    actions: {
      irPara,
      andarMes,
      irParaHoje,
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
      setBusca: (query: string) => setFiltro({ query }),
    },
  };
}

export type MimoApp = ReturnType<typeof useMimoApp>;
