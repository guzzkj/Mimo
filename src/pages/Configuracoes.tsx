import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Moldura, type DestinoDock } from "../components/Moldura";
import { useMimoApp } from "../hooks/useMimoApp";
import { AUTORES, MOTOR_DUO } from "../lib/contaDuo";
import { definirNotifs, EMAIL_SUELEN, notifsBase, type Notif } from "../lib/notificacoes";
import { brl, btnPrim, btnSec, campoSt, CARTAO, ERRO_CAMPO, numBR, OLHO, opcao, ROTULO, segmento, SORA } from "../components/mimo/estilos";
import { Gato, type Expressao } from "../components/mimo/Gato";
import { Avatar, Chave, Ic, Presenca, Skel, Spinner, Toast } from "../components/mimo/ui";
import { useTimers } from "../hooks/useTimers";
import { salvarPlano, usePlano, type Plano } from "../lib/plano";
import { aplicarEscolhaTema, escolhaTemaSalva, useCompacto, useTemaTela, type EscolhaTema } from "../lib/tema";
import { CORES_CAT, lerAjustes, salvarAjustes, type Ajustes } from "../lib/ajustes";
import { CATS, MESES_LONGOS } from "../lib/constants";
import { DIA_HOJE, dataBr, dataSeed } from "../lib/helpers";
import { OrcamentosConfig } from "../components/OrcamentosConfig";

// Porta de docs/ref/AppConfig.dc.html ("Mimo Configurações e Alertas"):
//   Lista mobile (/ajustes) · 5a Perfil · 5b Finanças · 5c Categorias
//   5d Conta Duo · 5e Notificações · 5f Aparência (/ajustes/:secao)
//   6a Centro de notificações (sino, ou /notificacoes)
//   7a/7c Carteira (/investimentos) · 7b Adicionar ativo (modal)
// Sem backend: tudo é mock + estado local. ?estado= reproduz os estados do
// protótipo (vazio, pendencia, preenchendo, erro, loading, sucesso, lidas)
// e ?abrir=ativo abre o modal de ativo.

type Tela = "config" | "perfil" | "financas" | "categorias" | "duo" | "notificacoes-pref" | "aparencia" | "investimentos";
type FormKey = "perfil" | "fin" | "cat" | "convite" | "ativo";
type DuoStatus = "nenhum" | "pendente" | "vinculado";
type Dono = "gustavo" | "suelen";
type TipoAtivo = "acao" | "fii" | "etf" | "rf";
interface Ativo { id: string; dono: Dono; tipo: TipoAtivo; ticker: string; qtd: number; pm: number; atual?: number; novo?: boolean }
interface Cat { id: string; nome: string; cor: string; n: number; novo?: boolean }
interface Forms {
  perfil: { nome: string; email: string; avatar: number };
  fin: { renda: string; limite: string; fecha?: string; vence?: string };
  cat: { nome: string; cor: string };
  convite: { email: string };
  ativo: { tipo: TipoAtivo; ticker: string; qtd: string; pm: string; atual: string; dono: Dono };
}
interface Prefs { conta: boolean; contaDias: number; limite: boolean; limiteQuando: string; meta: boolean; email: boolean; parceira: boolean }
interface Comp { movs: boolean; metas: boolean; invest: boolean; renda: boolean }

interface S {
  plano: Plano; modal: "ativo" | "desvincular" | null; notifOpen: boolean; forms: Forms; tentou: Partial<Record<FormKey, boolean>>;
  duoStatus: DuoStatus; privado: boolean; temaLocal: EscolhaTema; abrirOculto: boolean; pageLoading: boolean;
  enviando: FormKey | "desv" | null; salvo: FormKey | null; cats: Cat[]; catForm: string | null; confirmCat: string | null;
  prefs: Prefs; comp: Comp; notifs: Notif[]; ativos: Ativo[]; invView: "casal" | Dono; editAtivo: string | null; confirmAtivo: boolean; toast: string | null;
}

const P = {
  gustavo: { nome: "Gustavo", av: "#4e9e79", ini: "G", cor: "#4e9e79", tabby: false },
  suelen: { nome: "Suelen", av: "#e2a24f", ini: "S", cor: "#e2a24f", tabby: true },
};
const EMAIL = "gustavo.martins@gmail.com";
const EMAIL_S = EMAIL_SUELEN;
const IC = {
  perfil: "M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8z M4.5 20a7.5 7.5 0 0 1 15 0",
  financas: "M3.5 6.5h17v12h-17z M3.5 10.5h17 M7 14.5h3",
  categorias: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  duo: "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14a6.5 6.5 0 0 1 3.5 6",
  notif: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0",
  aparencia: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 3v18",
  invest: "M4 19.5h16 M5.5 15l4.5-4.5 3 3 5.5-6.5 M15 7h3.5v3.5",
  home: "M3.5 10.5 12 4l8.5 6.5V20h-5.5v-5.5h-6V20H3.5z",
  metas: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z",
  ajustes: "M12 15a3 3 0 1 0 0-6a3 3 0 1 0 0 6z M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.8 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L3 9.3l2-3.4 1.9.7a7 7 0 0 1 1.8-1l.3-2h4l.3 2a7 7 0 0 1 1.8 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z",
  conta: "M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4",
  limite: "M12 4 21 19.5H3z M12 10v4.5 M12 17.2v.1",
  meta: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z",
  convite: "M3.5 6.5h17v11h-17z M3.5 7l8.5 6.5L20.5 7",
  lock: "M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3",
};
const SECOES: [Tela, string, string][] = [["perfil", "Perfil", IC.perfil], ["financas", "Finanças", IC.financas], ["categorias", "Categorias", IC.categorias], ["duo", "Conta Duo", IC.duo], ["notificacoes-pref", "Notificações", IC.notif], ["aparencia", "Aparência", IC.aparencia]];
const AVATARES: [string, boolean, string][] = [["#4e9e79", false, "Verde"], ["#e2a24f", true, "Âmbar rajado"], ["#6f5cf0", false, "Roxo"], ["#8a90a0", false, "Cinza"], ["#d98a5f", true, "Laranja rajado"], ["#3a4050", false, "Grafite"]];
// As mesmas categorias do formulário de movimentação e dos gráficos, com as mesmas cores.
const CAT_PADRAO: [string, string][] = CATS.map((nome) => [nome, CORES_CAT[nome] ?? "#8790a6"]);
const CAT_CUSTOM: Cat[] = [{ id: "c1", nome: "Pets", cor: "#d98a5f", n: 12 }, { id: "c2", nome: "Presentes", cor: "#f2a3ad", n: 5 }, { id: "c3", nome: "Assinaturas", cor: "#8d7eff", n: 8 }];
const PALETA = ["#6f5cf0", "#4e9e79", "#10a88f", "#5b8def", "#e2a24f", "#d98a5f", "#d94f6e", "#f2a3ad", "#8790a6"];
const COT: Record<string, number> = { PETR4: 38.12, ITSA4: 10.42, IVVB11: 341.6, BBAS3: 27.9, HGLG11: 162.75, BOVA11: 126.1, WEGE3: 38.95, VALE3: 61.3, MXRF11: 9.62, TAEE11: 35.4, KNRI11: 158.3, ITUB4: 36.8 };
const TIPOS: Record<TipoAtivo, [string, string]> = { acao: ["Ação", "#6f5cf0"], fii: ["FII", "#10a88f"], etf: ["ETF", "#5b8def"], rf: ["Renda fixa", "#8790a6"] };
const ATIVOS: Ativo[] = [
  { id: "a1", dono: "gustavo", tipo: "acao", ticker: "PETR4", qtd: 100, pm: 32.4 },
  { id: "a2", dono: "gustavo", tipo: "acao", ticker: "ITSA4", qtd: 300, pm: 9.85 },
  { id: "a3", dono: "gustavo", tipo: "etf", ticker: "IVVB11", qtd: 20, pm: 285.1 },
  { id: "a4", dono: "gustavo", tipo: "rf", ticker: "Tesouro Selic 2029", qtd: 1, pm: 14820, atual: 15390 },
  { id: "a5", dono: "suelen", tipo: "acao", ticker: "BBAS3", qtd: 150, pm: 24.3 },
  { id: "a6", dono: "suelen", tipo: "fii", ticker: "HGLG11", qtd: 30, pm: 158.2 },
  { id: "a7", dono: "suelen", tipo: "etf", ticker: "BOVA11", qtd: 40, pm: 118.4 },
  { id: "a8", dono: "suelen", tipo: "acao", ticker: "WEGE3", qtd: 50, pm: 41.2 },
];
const PREFS: Prefs = { conta: true, contaDias: 3, limite: true, limiteQuando: "80", meta: true, email: false, parceira: true };
const COMP: Comp = { movs: true, metas: true, invest: false, renda: false };
const VAZIO: Forms = {
  perfil: { nome: "Gustavo Martins", email: EMAIL, avatar: 0 },
  fin: { renda: "", limite: "" },
  cat: { nome: "", cor: PALETA[0] },
  convite: { email: "" },
  ativo: { tipo: "acao", ticker: "", qtd: "", pm: "", atual: "", dono: "gustavo" },
};
const CHEIO: Forms = {
  perfil: { nome: "Gustavo Martins Lima", email: "gustavo.lima@gmail.com", avatar: 0 },
  fin: { renda: "6.200", limite: "" },
  cat: { nome: "Academia", cor: "#5b8def" },
  convite: { email: EMAIL_S },
  ativo: { tipo: "acao", ticker: "VALE3", qtd: "50", pm: "58,20", atual: "", dono: "gustavo" },
};
const ERRO: Forms = {
  perfil: { nome: "", email: "gustavo@gmail", avatar: 0 },
  fin: { renda: "6.200", limite: "" },
  cat: { nome: "Mercado", cor: "#10a88f" },
  convite: { email: EMAIL },
  ativo: { tipo: "acao", ticker: "XPTO3", qtd: "0", pm: "", atual: "", dono: "gustavo" },
};
const numBRtxt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SLUG: Record<string, Tela> = { perfil: "perfil", financas: "financas", categorias: "categorias", duo: "duo", notificacoes: "notificacoes-pref", aparencia: "aparencia" };
function lerRota(path: string, cp: boolean): { tela: Tela; notif: boolean } | null {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/ajustes") return { tela: cp ? "config" : "perfil", notif: false };
  if (p === "/investimentos") return { tela: "investimentos", notif: false };
  if (p === "/notificacoes") return { tela: cp ? "investimentos" : "perfil", notif: true };
  const m = /^\/ajustes\/([^/]+)$/.exec(p);
  if (m && SLUG[m[1]]) return { tela: SLUG[m[1]], notif: false };
  return null;
}
const rotaDe = (t: Tela) => (t === "config" ? "/ajustes" : t === "investimentos" ? "/investimentos" : t === "notificacoes-pref" ? "/ajustes/notificacoes" : `/ajustes/${t}`);

const clonar = (f: Forms): Forms => ({ perfil: { ...f.perfil }, fin: { ...f.fin }, cat: { ...f.cat }, convite: { ...f.convite }, ativo: { ...f.ativo } });

const catsDe = (a: Ajustes): Cat[] => a.categorias.map((c, i) => ({ id: "c" + i + c.nome, nome: c.nome, cor: c.cor, n: 0 }));

function init(t0: Tela, notif: boolean, est: string, abrir: string, planoG: Plano): S {
  const duo = planoG === "duo";
  // Sem ?estado=, os formulários abrem com o que já foi salvo (lib/ajustes),
  // a mesma fonte que o painel, o topo e as notificações usam.
  const aj = lerAjustes(duo ? "duo" : "solo");
  let modal: S["modal"] = null;
  if (abrir === "ativo") modal = "ativo";
  const chaveTela = modal === "ativo" ? "ativo" : notif ? "notificacoes" : t0;
  const fKey: FormKey | null = ({ perfil: "perfil", financas: "fin", categorias: "cat", ativo: "ativo" } as Record<string, FormKey>)[chaveTela] || (t0 === "duo" && ["preenchendo", "erro"].includes(est) ? "convite" : null);
  const fEst = fKey ? est : null;
  const forms = clonar(VAZIO);
  forms.fin = { renda: numBRtxt(aj.renda), limite: numBRtxt(aj.limite), fecha: String(aj.cartao.fecha), vence: String(aj.cartao.vence) };
  forms.perfil = { nome: aj.nome, email: aj.email, avatar: aj.avatar };
  if (fKey) {
    const src = fEst === "vazio" ? VAZIO : fEst === "erro" ? ERRO : fEst === "preenchendo" || fEst === "loading" ? CHEIO : null;
    if (src) (forms as unknown as Record<string, unknown>)[fKey] = { ...src[fKey] };
    if (fKey === "fin") {
      if (fEst === "erro") forms.fin = { renda: "6.200", limite: duo ? "12.500" : "7.500" };
      else if (fEst === "preenchendo" || fEst === "loading") forms.fin = { renda: "6.800", limite: duo ? "6.400" : "4.200" };
    }
  }
  const tentou: S["tentou"] = fEst === "erro" && fKey ? { [fKey]: true } : {};
  let duoStatus: DuoStatus = !duo ? "nenhum" : est === "pendencia" ? "pendente" : ["vazio", "preenchendo", "erro"].includes(est) && t0 === "duo" ? "nenhum" : "vinculado";
  if (t0 === "duo" && est === "sucesso") duoStatus = "pendente";
  const s: S = {
    plano: planoG, modal, notifOpen: notif, forms, tentou, duoStatus,
    privado: false, temaLocal: escolhaTemaSalva(), abrirOculto: aj.abrirOculto,
    pageLoading: est === "loading" && (["duo", "notificacoes-pref", "investimentos"].includes(t0) || notif),
    enviando: fEst === "loading" ? fKey : null, salvo: fEst === "sucesso" ? fKey : null,
    cats: t0 === "categorias" && est === "vazio" ? [] : est === "dados" ? catsDe(aj) : CAT_CUSTOM.map((c) => ({ ...c })),
    catForm: t0 === "categorias" && ["preenchendo", "erro", "loading"].includes(est) ? "novo" : null, confirmCat: null,
    prefs: { ...PREFS, ...aj.avisos }, comp: { ...COMP },
    notifs: notif && est === "vazio" ? [] : notifsBase(duo, est === "pendencia").map((n) => ({ ...n, lido: n.lido || (notif && est === "lidas") })),
    ativos: t0 === "investimentos" && est === "vazio" ? [] : ATIVOS.filter((a) => duo || a.dono === "gustavo").map((a) => ({ ...a })),
    invView: "casal", editAtivo: null, confirmAtivo: false, toast: null,
  };
  if (fEst === "sucesso") {
    if (fKey === "cat") { s.cats = [...s.cats, { id: "c9", nome: "Academia", cor: "#5b8def", n: 0, novo: true }]; s.salvo = null; s.toast = "Categoria “Academia” criada."; }
    if (fKey === "ativo") { s.modal = null; s.ativos = [{ id: "a9", dono: "gustavo", tipo: "acao", ticker: "VALE3", qtd: 50, pm: 58.2, novo: true }, ...s.ativos]; s.toast = "VALE3 adicionado à carteira."; }
    if (fKey === "perfil") forms.perfil = { ...CHEIO.perfil, email: EMAIL };
    if (fKey === "fin") forms.fin = { renda: "6.800", limite: duo ? "6.400" : "4.200" };
  }
  if (t0 === "duo" && est === "sucesso") s.toast = "Convite enviado para " + EMAIL_S + ".";
  return s;
}

const calc = (a: Ativo) => {
  const rf = a.tipo === "rf";
  const preco = rf ? (a.atual ?? 0) : COT[a.ticker] ?? a.pm;
  const valor = rf ? (a.atual ?? 0) : a.qtd * preco;
  const inv = rf ? a.pm : a.qtd * a.pm;
  return { ...a, preco, valor, inv, r: valor / inv - 1 };
};

type Erros = Record<string, string>;
type CampoF = { v: string; on: (e: { target: { value: string } }) => void; erro: string; borda: string };

const LINHA_SEC: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", border: "none", borderBottom: "1px solid var(--line-soft)", background: "transparent", color: "var(--ink)", textAlign: "left", cursor: "pointer" };

function Salvo({ texto }: { texto: string }) {
  return (
    <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--in-ink)", animation: "mmFade .3s ease both" }}>
      <Ic d="m5 12.5 4.5 4.5L19 7.5" size={15} sw={2.4} />{texto}
    </span>
  );
}

function BotaoEnvio({ env, label, onClick, style }: { env: boolean; label: string; onClick: () => void; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} aria-busy={env} style={{ ...btnPrim(), opacity: env ? 0.7 : 1, ...style }}>
      {env && <Spinner />}
      {label}
    </button>
  );
}

function Moeda({ f, extra }: { f: CampoF; extra?: CSSProperties }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--faint)" }}>R$</span>
      <input inputMode="decimal" value={f.v} onChange={f.on} placeholder="0,00" style={campoSt(f.borda, { height: 50, padding: "0 14px 0 42px", fontFamily: SORA, fontSize: 17, ...extra })} />
    </div>
  );
}

function Campo({ rotulo, f, children }: { rotulo: ReactNode; f: CampoF; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      <span style={ROTULO}>{rotulo}</span>
      {children}
      {f.erro && <span style={ERRO_CAMPO}>{f.erro}</span>}
    </label>
  );
}

export default function Configuracoes() {
  const tema = useTemaTela();
  const cp = useCompacto();
  const planoGlobal = usePlano();
  const loc = useLocation();
  const navigate = useNavigate();
  const { later } = useTimers();
  const rota = lerRota(loc.pathname, cp);
  const t: Tela = rota?.tela ?? "perfil";

  const [s, setS] = useState<S>(() => {
    const q = new URLSearchParams(loc.search);
    const est = q.get("estado") ?? "";
    const st = init(t, !!rota?.notif, est || "dados", q.get("abrir") ?? "", planoGlobal);
    // cotações "atualizando" por um instante na primeira abertura da carteira
    if (!est && t === "investimentos") st.pageLoading = true;
    return st;
  });
  const autoCarregar = useRef(!new URLSearchParams(loc.search).get("estado") && t === "investimentos");
  const sRef = useRef(s);
  useLayoutEffect(() => { sRef.current = s; });
  // motor de movimentações da conta ativa: alimenta o painel lateral, o LIMITE e o dock
  const app = useMimoApp(s.plano === "duo" && s.duoStatus === "vinculado" ? MOTOR_DUO : {});
  // estados de protótipo (?estado=) da central de notificações valem para a lista compartilhada
  const notifsIniciais = useRef(new URLSearchParams(loc.search).get("estado") ? s.notifs : null);
  useEffect(() => {
    if (notifsIniciais.current) definirNotifs(s.plano === "duo" && s.duoStatus === "vinculado" ? "duo" : "solo", notifsIniciais.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoCarregar.current) return;
    later(() => setS((p) => ({ ...p, pageLoading: false })), 800);
  }, [later]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  // a lista de ajustes só existe no layout compacto
  useEffect(() => { if (!cp && t === "config") navigate("/ajustes/perfil", { replace: true }); }, [cp, t, navigate]);

  if (!rota) return <Navigate to="/ajustes" replace />;

  const up = (patch: Partial<S> | ((p: S) => Partial<S>)) => setS((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const fmtDe = (st: S) => (v: number, dec = true) => (st.privado ? "R$ ••••" : brl(v, dec));
  const fmt = fmtDe(s);
  const duoDe = (st: S) => st.plano === "duo" && st.duoStatus === "vinculado";
  const duo = duoDe(s);
  const planoDuo = s.plano === "duo";

  const toast = (msg: string) => {
    up({ toast: msg });
    later(() => setS((p) => (p.toast === msg ? { ...p, toast: null } : p)), 2600);
  };
  const ir = (tela: Tela) => {
    up({ notifOpen: false, pageLoading: false, modal: null });
    navigate(rotaDe(tela));
  };
  const setForm = <F extends FormKey, K extends keyof Forms[F]>(f: F, k: K, v: Forms[F][K]) =>
    setS((p) => ({ ...p, forms: { ...p.forms, [f]: { ...p.forms[f], [k]: v } }, salvo: p.salvo === f ? null : p.salvo }));

  const errosDe = (st: S, f: FormKey): Erros => {
    const e: Erros = {};
    const d = duoDe(st);
    if (f === "perfil") {
      const x = st.forms.perfil;
      if (x.nome.trim().length < 2) e.nome = "Informe seu nome.";
      if (!EMAIL_RE.test(x.email.trim())) e.email = "E-mail inválido. Use o formato nome@email.com.";
    }
    if (f === "fin") {
      const x = st.forms.fin;
      const r = numBR(x.renda);
      const l = numBR(x.limite);
      const tot = r + (d ? lerAjustes("duo").rendaParceira : 0);
      if (!(r > 0)) e.renda = "Informe sua renda mensal.";
      if (!(l > 0)) e.limite = "Informe um limite maior que zero.";
      else if (r > 0 && l > tot) e.limite = "O limite passa da renda" + (d ? " de vocês" : "") + " (" + fmtDe(st)(tot, false) + ").";
    }
    if (f === "cat") {
      const n = st.forms.cat.nome.trim();
      const edit = st.catForm;
      if (!n) e.nome = "Dê um nome para a categoria.";
      else if (n.length > 20) e.nome = "Use até 20 caracteres.";
      else if ([...CAT_PADRAO.map((c) => ({ nome: c[0] })), ...st.cats.filter((c) => c.id !== edit)].some((c) => c.nome.toLowerCase() === n.toLowerCase())) e.nome = "Já existe uma categoria “" + n + "”.";
    }
    if (f === "convite") {
      const m = st.forms.convite.email.trim().toLowerCase();
      if (!EMAIL_RE.test(m)) e.email = "E-mail inválido. Use o formato nome@email.com.";
      else if (m === EMAIL || m === st.forms.perfil.email.trim().toLowerCase()) e.email = "Esse é o seu e-mail. Convide o e-mail da outra pessoa.";
    }
    if (f === "ativo") {
      const x = st.forms.ativo;
      const rf = x.tipo === "rf";
      const tk = x.ticker.trim().toUpperCase();
      if (rf) {
        if (tk.length < 3) e.ticker = "Dê um nome para o título, como Tesouro Selic 2029.";
        if (!(numBR(x.pm) > 0)) e.pm = "Informe o valor aplicado.";
        if (!(numBR(x.atual) > 0)) e.atual = "Informe o valor atual.";
      } else {
        if (!/^[A-Z]{4}\d{1,2}$/.test(tk)) e.ticker = "Use o código da B3, como PETR4.";
        else if (!COT[tk]) e.ticker = "Não encontramos " + tk + " na B3. Confira o código.";
        const qq = numBR(x.qtd);
        if (!(qq > 0)) e.qtd = "Informe uma quantidade maior que zero.";
        else if (!Number.isInteger(qq)) e.qtd = "Use um número inteiro de cotas.";
        if (!(numBR(x.pm) > 0)) e.pm = "Informe o preço médio pago.";
      }
    }
    return e;
  };
  const campo = <F extends FormKey>(f: F, k: keyof Forms[F] & string): CampoF => {
    const err = s.tentou[f] ? (errosDe(s, f)[k] || "") : "";
    return { v: String(s.forms[f][k] ?? ""), on: (e) => setForm(f, k, e.target.value as Forms[F][typeof k]), erro: err, borda: err ? "var(--out-line)" : "var(--line2)" };
  };
  const enviar = (f: FormKey, fim: (st: S) => void) => {
    const st = sRef.current;
    if (st.enviando) return;
    if (Object.keys(errosDe(st, f)).length) { setS((p) => ({ ...p, tentou: { ...p.tentou, [f]: true } })); return; }
    up({ enviando: f });
    later(() => { setS((p) => ({ ...p, enviando: null, tentou: { ...p.tentou, [f]: false } })); fim(sRef.current); }, 1300);
  };
  const env = (f: FormKey | "desv") => s.enviando === f;

  // ---- navegação ---------------------------------------------------------------------
  const cfg = t === "config" || SECOES.some((x) => x[0] === t);
  const av = AVATARES[s.forms.perfil.avatar] || AVATARES[0];
  const secoes = SECOES.map(([id, label, ic]) => ({
    id, label, ic, on: t === id, dot: id === "duo" && s.duoStatus === "pendente",
    info: id === "duo" ? (s.duoStatus === "vinculado" ? "Suelen" : s.duoStatus === "pendente" ? "Convite pendente" : "") : id === "aparencia" ? ({ claro: "Claro", escuro: "Escuro", auto: "Automático" }[s.temaLocal]) : "",
  }));
  const SUB: Partial<Record<Tela, string>> = {
    perfil: "Como você aparece no Mimo" + (duo ? " e para Suelen." : "."),
    financas: duo ? "Sua renda e o limite de gastos do casal. O Mimo usa esses números para mostrar quanto da renda já está comprometido." : "Sua renda e seu limite de gastos. O Mimo usa esses números para mostrar quanto da renda já está comprometido.",
    categorias: "As categorias padrão cobrem o básico. Crie as suas para o resto.",
    duo: "Quem divide a conta com você e o que é compartilhado por padrão.",
    "notificacoes-pref": "Escolha quando o Mimo deve chamar sua atenção.",
    aparencia: "Tema e como os valores aparecem ao abrir o app.",
  };

  // ---- perfil ------------------------------------------------------------------------
  const pf = s.forms.perfil;
  const fp = { nome: campo("perfil", "nome"), email: campo("perfil", "email") };
  const pErr = s.tentou.perfil && Object.keys(errosDe(s, "perfil")).length;
  const perfilExp: Expressao = pErr ? "preocupado" : s.salvo === "perfil" ? "feliz" : "padrao";
  const emailMudou = !!pf.email.trim() && pf.email.trim().toLowerCase() !== EMAIL && !fp.email.erro && s.salvo !== "perfil";
  const planoGatos = [{ ...P.gustavo, cor: av[0], tabby: av[1] }, ...(duo ? [P.suelen] : [])];

  // ---- finanças ----------------------------------------------------------------------
  const ff = { renda: campo("fin", "renda"), limite: campo("fin", "limite") };
  const r = numBR(s.forms.fin.renda);
  const lim = numBR(s.forms.fin.limite);
  const rt = (r > 0 ? r : 0) + (duo ? app.ajustes.rendaParceira : 0);
  // gasto real do mês corrente da conta ativa (mesmo número do LIMITE no topo)
  const gasto = app.derivado.saidas;
  const mesAtualNome = MESES_LONGOS[Number(app.state.mesRef.slice(5)) - 1].toLowerCase();
  const pct = r > 0 && lim > 0 ? (lim / rt) * 100 : null;
  const fin = pct == null
    ? { pct: "—", w: "0%", cor: "var(--line2)", exp: "curioso" as Expressao, texto: r > 0 ? "Defina um limite para ver quanto da renda ele compromete." : "Informe sua renda para o Mimo calcular quanto dela está comprometido.", temGasto: false, gw: "0%", gcor: "" }
    : {
      pct: pct.toFixed(0) + "%", w: Math.min(100, pct) + "%", cor: pct > 100 ? "var(--out)" : pct > 80 ? "var(--duo)" : "var(--solo)", exp: (pct > 80 ? "preocupado" : "feliz") as Expressao,
      texto: pct > 100 ? "O limite passa da renda. Esse valor não fecha no mês." : pct > 80 ? "Sobra menos de 20% da renda para guardar. A regra 50/30/20 sugere reservar pelo menos 20%." : "Sobram " + fmt(rt - lim, false) + " (" + (100 - pct).toFixed(0) + "%) para guardar. Dentro da regra 50/30/20.",
      temGasto: true, gw: Math.min(100, (gasto / lim) * 100) + "%", gcor: gasto > lim ? "var(--out)" : "var(--accent)",
    };

  // ---- categorias --------------------------------------------------------------------
  const salvarCats = (stt: S, cats: Cat[]) => salvarAjustes(duoDe(stt) ? "duo" : "solo", { categorias: cats.map((c) => ({ nome: c.nome, cor: c.cor })) });
  const usoCat = (nome: string) => app.state.itens.filter((i) => i.categoria === nome).length;
  const cf = s.forms.cat;
  const editC = s.cats.find((c) => c.id === s.catForm);
  const fc = campo("cat", "nome");

  // ---- conta duo ---------------------------------------------------------------------
  const st = s.duoStatus;
  const conviteErro = s.tentou.convite ? errosDe(s, "convite").email : "";
  const dz = st === "vinculado"
    ? { vinc: true, slot: false, slotTxt: "", slotBorda: "", form: false, pend: false, tag: "Vinculada", tagBg: "var(--in-soft)", tagCor: "var(--in-ink)", borda: "var(--duo-line)", expG: "feliz" as Expressao, titulo: "Você e Suelen dividem uma conta Duo", texto: "Vinculados desde 02/03/2026. Os dois têm acesso igual à conta conjunta e às metas do casal." }
    : st === "pendente"
      ? { vinc: false, slot: true, slotTxt: "?", slotBorda: "var(--duo-line)", form: false, pend: true, tag: "Aguardando resposta", tagBg: "var(--duo-soft)", tagCor: "var(--duo-ink)", borda: "var(--duo-line)", expG: "curioso" as Expressao, titulo: "Convite enviado para " + EMAIL_S, texto: "Enviado em " + dataBr(dataSeed(0, Math.max(1, DIA_HOJE - 5))) + " e válido por 7 dias. Quando Suelen aceitar, a conta vira Duo para os dois." }
      : { vinc: false, slot: true, slotTxt: "+", slotBorda: "var(--line2)", form: true, pend: false, tag: planoDuo ? "Sem par vinculado" : "Conta Solo", tagBg: "var(--solo-soft)", tagCor: "var(--solo-ink)", borda: "var(--line)", expG: (conviteErro ? "preocupado" : "curioso") as Expressao, titulo: "Use o Mimo a dois", texto: "Convide quem divide as contas com você. Vocês ganham uma conta conjunta, divisão de despesas e metas do casal. O que você já registrou continua privado." };
  const COMPL: [keyof Comp, string, string][] = [["movs", "Novas movimentações", "Começam como compartilhadas. Você pode mudar em cada lançamento."], ["metas", "Novas metas", "Metas que você criar aparecem para Suelen e aceitam aportes dela."], ["invest", "Investimentos", "Suelen vê sua carteira além do consolidado do casal."], ["renda", "Renda mensal", "Suelen vê o valor da sua renda. Desligado, ela vê só a proporção usada na divisão."]];

  // ---- preferências ------------------------------------------------------------------
  const p = s.prefs;
  // preferências valem de verdade: o sino passa a gerar (ou não) cada tipo de aviso
  const setP = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    const prefs = { ...sRef.current.prefs, [k]: v };
    setS((x) => ({ ...x, prefs }));
    salvarAjustes(duoDe(sRef.current) ? "duo" : "solo", { avisos: { ...prefs, limiteQuando: prefs.limiteQuando === "100" ? "100" : "80" } });
  };
  const prefLista: { k: keyof Prefs; ic: string; label: string; desc: string; chips: { label: string; on: boolean; onClick: () => void }[] | null }[] = [
    { k: "conta", ic: IC.conta, label: "Contas a pagar vencendo", desc: "Aviso antes do vencimento de contas registradas.", chips: p.conta ? [1, 3, 7].map((d) => ({ label: d === 1 ? "1 dia antes" : d + " dias antes", on: p.contaDias === d, onClick: () => setP("contaDias", d) })) : null },
    { k: "limite", ic: IC.limite, label: "Limite mensal", desc: duo ? "Quando os gastos do casal se aproximam ou passam do limite." : "Quando seus gastos se aproximam ou passam do limite.", chips: p.limite ? [["80", "Aos 80% e aos 100%"], ["100", "Só ao estourar"]].map(([k, l]) => ({ label: l, on: p.limiteQuando === k, onClick: () => setP("limiteQuando", k) })) : null },
    { k: "meta", ic: IC.meta, label: "Meta perto da data alvo", desc: "Quando faltar 60 dias e o ritmo de aportes não for suficiente.", chips: null },
    { k: "email", ic: IC.convite, label: "E-mail semanal de resumo", desc: "Toda segunda às 8h, em " + (pf.email || EMAIL) + ".", chips: null },
    ...(duo ? [{ k: "parceira" as const, ic: IC.duo, label: "Atividade de Suelen", desc: "Acertos, limites propostos e aportes que ela fizer nas metas do casal.", chips: null }] : []),
  ];
  const TEMAS: [EscolhaTema, string, string, string, string, string][] = [["claro", "Claro", "Sempre claro", "#f5f6fb", "#ffffff", "rgba(28,31,43,.14)"], ["escuro", "Escuro", "Sempre escuro", "#0d0f16", "#1a1e28", "rgba(226,232,244,.18)"], ["auto", "Automático", "Segue o sistema", "linear-gradient(90deg, #f5f6fb 50%, #0d0f16 50%)", "linear-gradient(90deg, #ffffff 50%, #1a1e28 50%)", "rgba(111,92,240,.35)"]];

  // ---- investimentos -----------------------------------------------------------------
  const pc = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(1).replace(".", ",") + "%";
  const all = s.ativos.map(calc);
  const view = duo ? s.invView : "gustavo";
  const lista = view === "casal" ? all : all.filter((a) => a.dono === view);
  const soma = (l: ReturnType<typeof calc>[]) => ({ v: l.reduce((x, a) => x + a.valor, 0), i: l.reduce((x, a) => x + a.inv, 0) });
  const T = soma(lista);
  const rTot = T.i ? T.v / T.i - 1 : 0;
  const G = soma(all.filter((a) => a.dono === "gustavo"));
  const Sx = soma(all.filter((a) => a.dono === "suelen"));
  const aloc = (Object.entries(TIPOS) as [TipoAtivo, [string, string]][]).map(([k, [label, cor]]) => {
    const v = lista.filter((a) => a.tipo === k).reduce((x, a) => x + a.valor, 0);
    return { label, cor, v: fmt(v, false), pct: T.v ? Math.round((v / T.v) * 100) + "%" : "0%", w: T.v ? (v / T.v) * 100 + "%" : "0%", raw: v };
  }).filter((a) => a.raw > 0);
  const rc = (x: number) => (x >= 0 ? { rCor: "var(--in-ink)", rBg: "var(--in-soft)", rLine: "var(--in-line)" } : { rCor: "var(--out-ink)", rBg: "var(--out-soft)", rLine: "var(--out-line)" });
  const n2 = (v: number) => (s.privado ? "••••" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const rcT = rc(rTot);
  const colunas = cp ? "minmax(0, 1fr) auto auto" : "minmax(0, 2fr) repeat(4, minmax(0, 1fr)) 90px";
  const novoAtivo = () => setS((x) => ({ ...x, modal: "ativo", editAtivo: null, confirmAtivo: false, tentou: { ...x.tentou, ativo: false }, forms: { ...x.forms, ativo: { ...VAZIO.ativo, dono: duoDe(x) && x.invView === "suelen" ? "suelen" : "gustavo" } } }));

  // ---- notificações ------------------------------------------------------------------
  const nLoad = s.pageLoading && !!rota.notif;
  const fecharNotif = () => { up({ notifOpen: false }); if (rota.notif) navigate(rotaDe(t), { replace: true }); };

  // ---- modal de ativo ----------------------------------------------------------------
  const fAt = s.forms.ativo;
  const rf = fAt.tipo === "rf";
  const fa = { ticker: campo("ativo", "ticker"), qtd: campo("ativo", "qtd"), pm: campo("ativo", "pm"), atual: campo("ativo", "atual") };
  const tk = fAt.ticker.trim().toUpperCase();
  const qn = numBR(fAt.qtd);
  const pmn = numBR(fAt.pm);
  const invN = rf ? pmn : qn * pmn;
  const temCot = !rf && !!COT[tk];
  const atResumo = temCot && qn > 0
    ? fmt(qn * COT[tk]) + (pmn > 0 ? " · " + ((qn * COT[tk]) / invN - 1 >= 0 ? "+" : "−") + Math.abs(((qn * COT[tk]) / invN - 1) * 100).toFixed(1).replace(".", ",") + "%" : "")
    : invN > 0 ? fmt(invN) : "—";

  const fecharModal = () => up({ modal: null, confirmAtivo: false });
  const modalNode = s.modal ? (
    <div onClick={fecharModal} style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "auto", display: "flex", alignItems: cp ? "flex-end" : "center", justifyContent: "center", padding: cp ? 0 : 24, background: "rgba(10,12,20,.46)", backdropFilter: "blur(3px)", animation: "mmFade .25s ease both" }}>
      <div role="dialog" aria-modal="true" className="mm-sai-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, maxHeight: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, padding: 26, borderRadius: cp ? "26px 26px 0 0" : 26, background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 40px 80px -40px rgba(0,0,0,.6)", animation: "mmRiseC .35s cubic-bezier(.2,.8,.2,1) both" }}>
        {s.modal === "ativo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={OLHO}>Investimentos</span>
                <span style={{ fontFamily: SORA, fontSize: 23, letterSpacing: "-.03em" }}>{s.editAtivo ? "Editar " + fAt.ticker : "Adicionar ativo"}</span>
              </div>
              <button type="button" title="Fechar" aria-label="Fechar" onClick={fecharModal} className="mm-h-sec" style={{ flex: "none", width: 36, height: 36, borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--muted)", display: "grid", placeItems: "center", cursor: "pointer" }}><Ic d="M6 6l12 12M18 6 6 18" size={16} sw={2} /></button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Object.entries(TIPOS) as [TipoAtivo, [string, string]][]).map(([k, [label]]) => {
                const o = opcao(fAt.tipo === k);
                return <button key={k} type="button" aria-pressed={fAt.tipo === k} onClick={() => setForm("ativo", "tipo", k)} style={{ height: 38, padding: "0 14px", borderRadius: 999, border: `1px solid ${o.borda}`, background: o.bg, color: o.cor, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>;
              })}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={ROTULO}>{rf ? "Nome do título" : "Código na B3"}</span>
              <input value={fa.ticker.v} onChange={fa.ticker.on} placeholder={rf ? "Ex.: Tesouro Selic 2029" : "Ex.: PETR4"} style={campoSt(fa.ticker.borda, { fontWeight: 600, textTransform: rf ? "none" : "uppercase" })} />
              {fa.ticker.erro && <span style={ERRO_CAMPO}>{fa.ticker.erro}</span>}
              {temCot && !fa.ticker.erro && <span style={{ fontSize: 12, color: "var(--in-ink)", animation: "mmFade .25s ease both" }}>{"Cotação de fechamento: " + fmt(COT[tk])}</span>}
            </label>
            {!rf ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Campo rotulo="Quantidade" f={fa.qtd}><input inputMode="numeric" value={fa.qtd.v} onChange={fa.qtd.on} placeholder="0" style={campoSt(fa.qtd.borda)} /></Campo>
                <Campo rotulo="Preço médio" f={fa.pm}><input inputMode="decimal" value={fa.pm.v} onChange={fa.pm.on} placeholder="R$ 0,00" style={campoSt(fa.pm.borda)} /></Campo>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Campo rotulo="Valor aplicado" f={fa.pm}><input inputMode="decimal" value={fa.pm.v} onChange={fa.pm.on} placeholder="R$ 0,00" style={campoSt(fa.pm.borda)} /></Campo>
                <Campo rotulo="Valor atual" f={fa.atual}><input inputMode="decimal" value={fa.atual.v} onChange={fa.atual.on} placeholder="R$ 0,00" style={campoSt(fa.atual.borda)} /></Campo>
              </div>
            )}
            {duo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={ROTULO}>De quem é</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([["gustavo", "Você"], ["suelen", "Suelen"]] as const).map(([k, label]) => {
                    const o = opcao(fAt.dono === k);
                    return (
                      <button key={k} type="button" aria-pressed={fAt.dono === k} onClick={() => setForm("ativo", "dono", k)} style={{ height: 48, padding: "0 12px", borderRadius: 14, border: `1px solid ${o.borda}`, background: o.bg, color: o.cor, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
                        <Avatar av={P[k].av} ini={P[k].ini} size={26} />{label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "14px 16px", borderRadius: 16, background: "var(--line-soft)", fontSize: 13, color: "var(--muted)" }}>
              <span>{temCot && qn > 0 ? "Valor hoje" : "Valor investido"}</span>
              <strong style={{ fontFamily: SORA, fontWeight: 500, color: "var(--ink)" }}>{atResumo}</strong>
            </div>
            {s.confirmAtivo && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--out-line)", background: "var(--out-soft)", animation: "mmDrop .25s ease both" }}>
                <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>Remover {fa.ticker.v} da carteira?</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => up({ confirmAtivo: false })} style={{ height: 36, padding: "0 12px", borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Manter</button>
                  <button type="button" onClick={() => { const id = s.editAtivo; const tt = fAt.ticker; setS((x) => ({ ...x, modal: null, confirmAtivo: false, ativos: x.ativos.filter((a) => a.id !== id) })); toast(tt + " removido da carteira."); }} style={{ height: 36, padding: "0 12px", borderRadius: 11, border: "none", background: "var(--out)", color: "#ffffff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Remover</button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              {s.editAtivo && (
                <button type="button" title="Remover ativo" aria-label="Remover ativo" onClick={() => up({ confirmAtivo: true })} style={{ flex: "none", width: 48, height: 48, borderRadius: 15, border: "1px solid var(--out-line)", background: "var(--surface)", color: "var(--out)", display: "grid", placeItems: "center", cursor: "pointer" }}><Ic d="M5 7h14 M9.5 7V4.5h5V7 M7 7l1 13h8l1-13" size={17} sw={1.9} /></button>
              )}
              <button type="button" onClick={fecharModal} style={btnSec({ flex: 1, padding: 0 })}>Cancelar</button>
              <BotaoEnvio env={env("ativo")} label={env("ativo") ? "Buscando cotação…" : s.editAtivo ? "Salvar" : "Adicionar"} style={{ flex: 1.4, padding: 0 }} onClick={() => enviar("ativo", (stt) => {
                const x = stt.forms.ativo;
                const rfx = x.tipo === "rf";
                const d = duoDe(stt);
                const novo = { tipo: x.tipo, ticker: rfx ? x.ticker.trim() : x.ticker.trim().toUpperCase(), qtd: rfx ? 1 : numBR(x.qtd), pm: numBR(x.pm), atual: rfx ? numBR(x.atual) : undefined, dono: d ? x.dono : ("gustavo" as Dono) };
                const id = stt.editAtivo;
                setS((y) => ({ ...y, modal: null, ativos: id ? y.ativos.map((a) => (a.id === id ? { ...a, ...novo } : a)) : [{ id: "a" + Date.now(), ...novo, novo: true }, ...y.ativos] }));
                toast(id ? novo.ticker + " atualizado." : novo.ticker + " adicionado à carteira.");
              })} />
            </div>
          </div>
        )}

        {s.modal === "desvincular" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 100 }}><Gato cor={av[0]} tabby={av[1]} expressao="preocupado" /></div>
              <div style={{ width: 100, marginLeft: 10 }}><Gato cor="#e2a24f" tabby expressao="preocupado" /></div>
            </div>
            <span style={{ fontFamily: SORA, fontSize: 23, letterSpacing: "-.03em" }}>Desvincular de Suelen?</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", textAlign: "left" }}>
              {["Cada um volta para uma conta Solo, com as próprias movimentações.", "A conta conjunta é encerrada. O saldo de " + fmt(4812.4) + " precisa ser dividido fora do Mimo.", "Metas do casal ficam arquivadas no histórico dos dois, com os aportes de cada um."].map((d) => (
                <span key={d} style={{ display: "flex", gap: 10, padding: "11px 13px", borderRadius: 13, background: "var(--line-soft)", fontSize: 13, lineHeight: 1.5, color: "var(--ink2)" }}><span style={{ flex: "none", width: 6, height: 6, marginTop: 7, borderRadius: "50%", background: "var(--out)" }} />{d}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button type="button" onClick={fecharModal} style={btnSec({ flex: 1, padding: 0 })}>Manter vínculo</button>
              <button type="button" onClick={() => { if (sRef.current.enviando) return; up({ enviando: "desv" }); later(() => { up({ enviando: null, modal: null, duoStatus: "nenhum", plano: "solo" }); salvarPlano("solo"); toast("Conta desvinculada. Suelen recebeu um aviso."); }, 1300); }} aria-busy={env("desv")} style={btnPrim({ flex: 1, padding: 0, background: "var(--out)", color: "#ffffff", opacity: env("desv") ? 0.7 : 1 })}>
                {env("desv") && <Spinner />}
                {env("desv") ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  const secaoKey = t + (s.pageLoading ? "-sk" : "");

  const destino: DestinoDock = t === "investimentos" ? "investimentos" : "config";
  const navegar = (d: DestinoDock) => {
    if (d === "investimentos") { ir("investimentos"); return true; }
    if (d === "config") { ir(cp ? "config" : "perfil"); return true; }
    return false;
  };

  return (
    <Moldura
      conta={duo ? "duo" : "solo"}
      app={app}
      ativo={destino}
      onNavegar={navegar}
      onPrivacidade={() => up((p) => ({ privado: !p.privado }))}
      autores={duo ? AUTORES : undefined}
      notif={{
        aberto: s.notifOpen,
        onAberto: (aberto) => (aberto ? up({ notifOpen: true }) : fecharNotif()),
        carregando: nLoad,
        gato: { cor: av[0], tabby: av[1] },
        onPreferencias: () => ir("notificacoes-pref"),
        onAceitarConvite: () => up({ plano: "duo", duoStatus: "vinculado" }),
      }}
    >
        <div data-mimo="app" data-tema={tema} className="view" style={{ maxWidth: 1120, color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif", animation: "mmPagina .35s ease both" }}>
          {t === "config" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "mmRiseC .5s cubic-bezier(.2,.8,.2,1) both" }}>
              <h1 style={{ margin: 0, fontFamily: SORA, fontSize: 30, fontWeight: 300, letterSpacing: "-.04em" }}>Ajustes</h1>
              <button type="button" onClick={() => ir("perfil")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 22, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                <div style={{ flex: "none", width: 64 }}><Gato cor={av[0]} tabby={av[1]} expressao="padrao" corpo={false} /></div>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{pf.nome || "Gustavo"}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pf.email}</span>
                </span>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: duo ? "var(--duo-soft)" : "var(--solo-soft)", color: duo ? "var(--duo-ink)" : "var(--solo-ink)", fontSize: 11, fontWeight: 700 }}>{duo ? "Conta Duo" : "Conta Solo"}</span>
              </button>
              <div style={{ display: "flex", flexDirection: "column", borderRadius: 22, border: "1px solid var(--line)", background: "var(--surface)", overflow: "hidden" }}>
                {secoes.map((sc, i) => (
                  <button key={sc.id} type="button" onClick={() => ir(sc.id)} className="mm-h-linha" style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 58, padding: "0 16px", border: "none", borderBottom: "1px solid var(--line-soft)", borderRadius: 0, background: "transparent", color: "var(--ink)", textAlign: "left", cursor: "pointer", animation: `mmFade .35s ${i * 0.04}s ease both` }}>
                    <span style={{ flex: "none", width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-ink)" }}><Ic d={sc.ic} size={17} /></span>
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{sc.label}</span>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>{sc.info}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cfg && t !== "config" && (
            <div style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
              {!cp && (
                <aside style={{ flex: "none", width: 220, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ padding: "0 12px 10px", ...OLHO }}>Configurações</span>
                  {secoes.map((sc) => (
                    <button key={sc.id} type="button" aria-current={sc.on ? "page" : undefined} onClick={() => ir(sc.id)} className={sc.on ? undefined : "mm-h-linha"} style={{ display: "flex", alignItems: "center", gap: 11, height: 44, padding: "0 12px", borderRadius: 13, border: "none", background: sc.on ? "var(--accent-soft)" : "transparent", color: sc.on ? "var(--ink)" : "var(--muted)", fontSize: 13.5, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
                      <Ic d={sc.ic} size={17} />
                      <span style={{ flex: 1 }}>{sc.label}</span>
                      {sc.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--duo)", animation: "mmPulse 2s ease-out infinite" }} />}
                    </button>
                  ))}
                </aside>
              )}
              <div key={secaoKey} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18, animation: "mmRiseC .5s cubic-bezier(.2,.8,.2,1) both" }}>
                {cp && <button type="button" onClick={() => ir("config")} style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Ajustes</button>}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <h1 style={{ margin: 0, fontFamily: SORA, fontSize: 30, fontWeight: 300, letterSpacing: "-.04em" }}>{(SECOES.find((x) => x[0] === t) || [])[1]}</h1>
                  <p style={{ margin: 0, maxWidth: 620, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{SUB[t]}</p>
                </div>

                {s.pageLoading && (t === "duo" || t === "notificacoes-pref") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: "var(--muted2)" }}>
                      <div style={{ width: 56 }}><Gato cor="#4e9e79" expressao="atento" corpo={false} /></div>
                      Carregando suas preferências…
                    </div>
                    {[1, 2, 3].map((k) => <Skel key={k} h={92} />)}
                  </div>
                )}

                {t === "perfil" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 22 }}>
                        <div style={{ flex: "none", width: 124, padding: 6, borderRadius: 26, background: "var(--line-soft)" }}><Gato key={s.forms.perfil.avatar} cor={av[0]} tabby={av[1]} expressao={perfilExp} /></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <span style={ROTULO}>Seu avatar</span>
                          <div role="radiogroup" aria-label="Seu avatar" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {AVATARES.map(([cor, tabby, label], i) => (
                              <button key={label} type="button" role="radio" aria-checked={pf.avatar === i} title={label} aria-label={label} onClick={() => setForm("perfil", "avatar", i)} style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", border: "none", background: cor, cursor: "pointer", boxShadow: pf.avatar === i ? "0 0 0 3px var(--surface), 0 0 0 5px var(--accent)" : "none" }}>
                                {tabby && <span style={{ position: "absolute", inset: "9px 12px", borderTop: "2.5px solid rgba(0,0,0,.25)", borderBottom: "2.5px solid rgba(0,0,0,.25)" }} />}
                              </button>
                            ))}
                          </div>
                          <span style={{ fontSize: 12, color: "var(--faint)" }}>{duo ? "Suelen vê o seu gato ao lado do dela." : "Aparece no topo e nas mensagens do Mimo."}</span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
                        <Campo rotulo="Nome" f={fp.nome}><input value={fp.nome.v} onChange={fp.nome.on} placeholder="Seu nome" style={campoSt(fp.nome.borda)} /></Campo>
                        <Campo rotulo="E-mail" f={fp.email}><input type="email" value={fp.email.v} onChange={fp.email.on} placeholder="nome@email.com" style={campoSt(fp.email.borda)} /></Campo>
                      </div>
                      {emailMudou && (
                        <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 14, background: "var(--accent-soft)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink2)", animation: "mmDrop .25s ease both" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }} aria-hidden="true"><path d="M3.5 6.5h17v11h-17z M3.5 7l8.5 6.5L20.5 7" /></svg>
                          <span>Vamos enviar um código para o novo e-mail. Até você confirmar, o login continua com {EMAIL}.</span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                        {s.salvo === "perfil" && <Salvo texto="Alterações salvas" />}
                        <BotaoEnvio env={env("perfil")} label={env("perfil") ? "Salvando…" : "Salvar alterações"} style={{ minWidth: 160 }} onClick={() => enviar("perfil", (stt) => {
                          up({ salvo: "perfil" });
                          const perfil = { nome: stt.forms.perfil.nome.trim(), email: stt.forms.perfil.email.trim(), avatar: stt.forms.perfil.avatar };
                          salvarAjustes("solo", perfil);
                          salvarAjustes("duo", perfil); if (stt.forms.perfil.email.trim().toLowerCase() !== EMAIL) toast("Enviamos um código para " + stt.forms.perfil.email.trim() + "."); })} />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "20px 24px", borderRadius: 24, border: `1px solid ${duo ? "var(--duo-line)" : "var(--solo-line)"}`, background: duo ? "var(--duo-soft)" : "var(--solo-soft)" }}>
                      <div style={{ flex: "none", display: "flex" }}>
                        {planoGatos.map((g, i) => <div key={g.nome} style={{ width: 64, marginLeft: i ? -16 : 0 }}><Gato cor={g.cor} tabby={g.tabby} expressao="feliz" corpo={false} /></div>)}
                      </div>
                      <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ ...OLHO, color: duo ? "var(--duo-ink)" : "var(--solo-ink)" }}>Plano atual</span>
                        <span style={{ fontFamily: SORA, fontSize: 19, letterSpacing: "-.02em" }}>{duo ? "Duo com Suelen" : "Solo"}</span>
                        <span style={{ fontSize: 13, color: "var(--muted2)" }}>{duo ? "Conta conjunta, divisão de despesas e metas do casal." : planoDuo && st === "pendente" ? "Duo aguardando Suelen aceitar o convite." : "Suas finanças, só você vê."}</span>
                      </div>
                      <button type="button" onClick={() => ir("duo")} className="mm-h-sec" style={btnSec({ height: 44, padding: "0 16px", borderRadius: 14, fontSize: 13.5 })}>{duo ? "Gerenciar conta Duo" : st === "pendente" ? "Ver convite" : "Convidar alguém"}</button>
                    </div>
                  </div>
                )}

                {t === "financas" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "start" }}>
                    <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <span style={ROTULO}>{duo ? "Sua renda mensal" : "Renda mensal"}</span>
                        <Moeda f={ff.renda} />
                        {ff.renda.erro && <span style={ERRO_CAMPO}>{ff.renda.erro}</span>}
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>Valor líquido, depois de impostos. Usado só para calcular percentuais.</span>
                      </label>
                      {duo && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--duo-soft)" }}>
                          <Avatar av="#e2a24f" ini="S" size={30} fs={12} />
                          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>Renda de Suelen · {fmt(app.ajustes.rendaParceira)}</span>
                            <span style={{ fontSize: 12, color: "var(--muted2)" }}>Ela edita a própria renda nos ajustes dela.</span>
                          </span>
                        </div>
                      )}
                      <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <span style={ROTULO}>{duo ? "Limite mensal do casal" : "Limite mensal de gastos"}</span>
                        <Moeda f={ff.limite} />
                        {ff.limite.erro && <span style={ERRO_CAMPO}>{ff.limite.erro}</span>}
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>{duo ? "Mudanças no limite do casal pedem a confirmação de Suelen." : "Quando os gastos passarem desse valor, o Mimo avisa."}</span>
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {([["fecha", "Fatura fecha no dia"], ["vence", "Fatura vence no dia"]] as const).map(([k, label]) => (
                          <label key={k} style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                            <span style={ROTULO}>{label}</span>
                            <select value={s.forms.fin[k] ?? ""} onChange={(e) => setS((x) => ({ ...x, forms: { ...x.forms, fin: { ...x.forms.fin, [k]: e.target.value } } }))} style={campoSt("var(--line2)", { padding: "0 12px" })}>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                      <span style={{ marginTop: -8, fontSize: 12, color: "var(--faint)" }}>Cartão de crédito: o vencimento aparece no Cartão Mimo, no calendário e no sino.</span>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                        {s.salvo === "fin" && <Salvo texto="Salvo" />}
                        <BotaoEnvio env={env("fin")} label={env("fin") ? "Salvando…" : "Salvar"} style={{ minWidth: 150 }} onClick={() => enviar("fin", (stt) => {
                          up({ salvo: "fin" });
                          salvarAjustes(duoDe(stt) ? "duo" : "solo", { renda: numBR(stt.forms.fin.renda), limite: numBR(stt.forms.fin.limite), cartao: { fecha: Number(stt.forms.fin.fecha) || app.ajustes.cartao.fecha, vence: Number(stt.forms.fin.vence) || app.ajustes.cartao.vence } });
                          if (duoDe(stt)) toast("Novo limite enviado para Suelen confirmar.");
                        })} />
                      </div>
                    </div>
                    <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: "none", width: 72 }}><Gato cor="#4e9e79" expressao={fin.exp} corpo={false} /></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={OLHO}>Renda comprometida</span>
                          <span style={{ fontFamily: SORA, fontSize: 36, fontWeight: 300, letterSpacing: "-.04em", lineHeight: 1 }}>{fin.pct}</span>
                        </div>
                      </div>
                      <div style={{ position: "relative", height: 12, borderRadius: 99, background: "var(--line-soft)" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: fin.w, borderRadius: 99, background: fin.cor, transition: "width .5s ease, background .3s ease" }} />
                        <span title="80%" style={{ position: "absolute", top: -4, bottom: -4, left: "80%", width: 2, borderRadius: 2, background: "var(--ink)" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--faint)" }}><span>0%</span><span style={{ marginLeft: "60%" }}>80%</span><span>100%</span></div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{fin.texto}</p>
                      {fin.temGasto && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--muted)" }}><span>{"Gasto em " + mesAtualNome}</span><span><strong style={{ color: "var(--ink)" }}>{fmt(gasto, false)}</strong> de {fmt(lim, false)}</span></div>
                          <div style={{ height: 8, borderRadius: 99, overflow: "hidden", background: "var(--line-soft)" }}><div style={{ width: fin.gw, height: "100%", borderRadius: 99, background: fin.gcor, transition: "width .5s ease, background .3s ease" }} /></div>
                        </div>
                      )}
                    </div>
                    <OrcamentosConfig
                      conta={duoDe(s) ? "duo" : "solo"}
                      ajustes={app.ajustes}
                      gastos={Object.fromEntries(app.derivado.categorias.map((c) => [c.nome, c.valor]))}
                      fmt={(v) => fmt(v, false)}
                      onSalvo={() => toast("Orçamentos salvos. Categorias e o sino já usam os novos valores.")}
                    />
                  </div>
                )}

                {t === "categorias" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {s.catForm && (
                      <div style={{ ...CARTAO, border: "1px solid var(--accent-line)", display: "flex", flexDirection: "column", gap: 16, animation: "mmDrop .3s ease both" }}>
                        <span style={{ fontFamily: SORA, fontSize: 17 }}>{editC ? "Editar “" + editC.nome + "”" : "Nova categoria"}</span>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16, alignItems: "start" }}>
                          <Campo rotulo="Nome" f={fc}><input value={fc.v} onChange={fc.on} placeholder="Ex.: Academia" style={campoSt(fc.borda)} /></Campo>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            <span style={ROTULO}>Cor</span>
                            <div role="radiogroup" aria-label="Cor" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {PALETA.map((cor) => (
                                <button key={cor} type="button" role="radio" aria-checked={cf.cor === cor} title={cor} aria-label={cor} onClick={() => setForm("cat", "cor", cor)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: cor, cursor: "pointer", boxShadow: cf.cor === cor ? "0 0 0 3px var(--surface), 0 0 0 5px var(--accent)" : "none" }} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--faint)" }}>Prévia <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: "var(--line-soft)", color: "var(--ink)", fontWeight: 700 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: cf.cor, transition: "background .2s ease" }} />{cf.nome.trim() || "Nome da categoria"}</span></span>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button type="button" onClick={() => setS((x) => ({ ...x, catForm: null, tentou: { ...x.tentou, cat: false } }))} style={btnSec({ height: 44, padding: "0 16px", borderRadius: 14, fontSize: 13.5 })}>Cancelar</button>
                            <BotaoEnvio env={env("cat")} label={env("cat") ? "Salvando…" : editC ? "Salvar" : "Criar categoria"} style={{ minWidth: 130, height: 44, padding: "0 18px", borderRadius: 14, fontSize: 13.5 }} onClick={() => enviar("cat", (stt) => {
                              const f = stt.forms.cat;
                              const id = stt.catForm;
                              const cats = id !== "novo"
                                ? stt.cats.map((c) => (c.id === id ? { ...c, nome: f.nome.trim(), cor: f.cor } : c))
                                : [...stt.cats, { id: "c" + Date.now(), nome: f.nome.trim(), cor: f.cor, n: 0, novo: true }];
                              setS((x) => ({ ...x, catForm: null, cats }));
                              salvarCats(stt, cats);
                              toast(id !== "novo" ? "Categoria atualizada." : "Categoria “" + f.nome.trim() + "” criada. Já aparece no formulário de movimentação.");
                            })} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ ...CARTAO, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                        <span style={OLHO}>Suas categorias</span>
                        {!s.catForm && <button type="button" onClick={() => setS((x) => ({ ...x, catForm: "novo", confirmCat: null, tentou: { ...x.tentou, cat: false }, forms: { ...x.forms, cat: { ...VAZIO.cat } } }))} className="mm-h-sec" style={btnSec({ height: 38, padding: "0 14px", borderRadius: 12, fontSize: 13 })}>+ Nova categoria</button>}
                      </div>
                      {s.cats.map((c) => (
                        <div key={c.id} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--line-soft)", animation: c.novo ? "mmDrop .3s ease both" : undefined }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 58 }}>
                            <span style={{ flex: "none", width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: c.cor, transition: "background .3s ease" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,.85)" }} /></span>
                            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>{c.nome}{c.novo && <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5 }}>Nova</span>}</span>
                              <span style={{ fontSize: 12, color: "var(--faint)" }}>{(c.n || usoCat(c.nome)) ? (c.n || usoCat(c.nome)) + " movimentações" : "Nenhuma movimentação ainda"}</span>
                            </span>
                            <button type="button" title="Editar" aria-label={"Editar " + c.nome} onClick={() => setS((x) => ({ ...x, catForm: c.id, confirmCat: null, tentou: { ...x.tentou, cat: false }, forms: { ...x.forms, cat: { nome: c.nome, cor: c.cor } } }))} className="mm-h-sec" style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--muted)", display: "grid", placeItems: "center", cursor: "pointer" }}><Ic d="M4 20h4L19 9l-4-4L4 16z" size={15} sw={1.9} /></button>
                            <button type="button" title="Remover" aria-label={"Remover " + c.nome} onClick={() => up({ confirmCat: c.id })} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--out)", display: "grid", placeItems: "center", cursor: "pointer" }}><Ic d="M5 7h14 M9.5 7V4.5h5V7 M7 7l1 13h8l1-13" size={15} sw={1.9} /></button>
                          </div>
                          {s.confirmCat === c.id && (
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--out-line)", background: "var(--out-soft)", animation: "mmDrop .25s ease both" }}>
                              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink2)" }}>{c.n ? c.n + " movimentações usam “" + c.nome + "”. Elas passam para Outros." : "Remover “" + c.nome + "”?"}</span>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" onClick={() => up({ confirmCat: null })} style={{ height: 36, padding: "0 12px", borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Manter</button>
                                <button type="button" onClick={() => { const cats = s.cats.filter((y) => y.id !== c.id); setS((x) => ({ ...x, confirmCat: null, cats })); salvarCats(s, cats); toast("“" + c.nome + "” removida."); }} style={{ height: 36, padding: "0 12px", borderRadius: 11, border: "none", background: "var(--out)", color: "#ffffff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Remover</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {!s.cats.length && (
                        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0 4px" }}>
                          <div style={{ flex: "none", width: 84 }}><Gato cor={av[0]} tabby={av[1]} expressao="curioso" corpo={false} /></div>
                          <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--muted2)", textWrap: "pretty" }}>Nenhuma categoria sua ainda. Crie uma para o que as padrão não cobrem, como pets ou academia.</span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 22, borderRadius: 24, border: "1px solid var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                        <span style={OLHO}>Padrão do Mimo</span>
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>Não podem ser removidas</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {CAT_PADRAO.map(([nome, cor]) => (
                          <span key={nome} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: 999, border: "1px solid var(--line)", fontSize: 13, fontWeight: 600, color: "var(--ink2)" }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor }} />{nome}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={IC.lock} /></svg>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {t === "duo" && !s.pageLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 24, alignItems: "center", padding: 26, borderRadius: 26, border: `1px solid ${dz.borda}`, background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)", transition: "border-color .3s ease" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8 }}>
                        <div style={{ width: 118 }}><Gato cor={av[0]} tabby={av[1]} expressao={dz.expG} /></div>
                        {dz.vinc && <div style={{ width: 118, animation: "mmPop .5s cubic-bezier(.2,.8,.2,1) both" }}><Gato cor="#e2a24f" tabby expressao="feliz" /></div>}
                        {dz.slot && <div key={dz.slotTxt} style={{ width: 118, height: 111, borderRadius: 30, border: `2px dashed ${dz.slotBorda}`, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 30, fontWeight: 300, animation: "mmFade .3s ease both" }}>{dz.slotTxt}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, background: dz.tagBg, color: dz.tagCor, fontSize: 11.5, fontWeight: 700 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", animation: st === "pendente" ? "mmPulse 2s ease-out infinite" : undefined }} />{dz.tag}</span>
                        <span style={{ fontFamily: SORA, fontSize: 24, fontWeight: 300, letterSpacing: "-.03em", lineHeight: 1.25, textWrap: "pretty" }}>{dz.titulo}</span>
                        <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{dz.texto}</span>
                        {dz.form && (() => {
                          const fcv = campo("convite", "email");
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <input type="email" aria-label="E-mail da outra pessoa" value={fcv.v} onChange={fcv.on} placeholder="E-mail da outra pessoa" style={campoSt(fcv.borda, { flex: 1, minWidth: 200, width: "auto" })} />
                                <BotaoEnvio env={env("convite")} label={env("convite") ? "Enviando…" : "Enviar convite"} style={{ minWidth: 140, padding: "0 18px", borderRadius: 14, gap: 8 }} onClick={() => enviar("convite", (stt) => { up({ duoStatus: "pendente", plano: "duo" }); toast("Convite enviado para " + stt.forms.convite.email.trim() + "."); })} />
                              </div>
                              {fcv.erro && <span style={ERRO_CAMPO}>{fcv.erro}</span>}
                            </div>
                          );
                        })()}
                        {dz.pend && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button type="button" onClick={() => toast("Convite reenviado para " + EMAIL_S + ".")} style={btnPrim({ height: 42, padding: "0 14px", borderRadius: 13, fontSize: 13 })}>Reenviar convite</button>
                            <button type="button" onClick={() => toast("Link do convite copiado.")} className="mm-h-sec" style={btnSec({ height: 42, padding: "0 14px", borderRadius: 13, fontSize: 13 })}>Copiar link</button>
                            <button type="button" onClick={() => { setS((x) => ({ ...x, duoStatus: "nenhum", forms: { ...x.forms, convite: { email: "" } } })); toast("Convite cancelado."); }} style={{ height: 42, padding: "0 14px", borderRadius: 13, border: "none", background: "transparent", color: "var(--out-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar convite</button>
                          </div>
                        )}
                        {dz.vinc && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>
                            <span>E-mail · <strong style={{ color: "var(--ink)" }}>{EMAIL_S}</strong></span>
                            <span>Conta conjunta · <strong style={{ color: "var(--ink)" }}>{fmt(4812.4)}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                    {dz.vinc && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "mmFade .35s ease both" }}>
                        <div style={{ ...CARTAO, padding: "8px 22px", display: "flex", flexDirection: "column" }}>
                          <span style={{ padding: "14px 0 6px", ...OLHO }}>Compartilhado por padrão</span>
                          {COMPL.map(([k, label, desc]) => (
                            <button key={k} type="button" role="switch" aria-checked={s.comp[k]} onClick={() => setS((x) => ({ ...x, comp: { ...x.comp, [k]: !x.comp[k] } }))} style={{ ...LINHA_SEC, borderRadius: 0 }}>
                              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span><span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--muted2)" }}>{desc}</span></span>
                              <Chave on={s.comp[k]} />
                            </button>
                          ))}
                          <span style={{ padding: "12px 0 14px", fontSize: 12, lineHeight: 1.5, color: "var(--faint)" }}>Vale para o que for criado daqui pra frente. Cada lançamento ainda pode ser marcado como privado ou compartilhado.</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "20px 22px", borderRadius: 24, border: "1px solid var(--out-line)", background: "var(--out-soft)" }}>
                          <span style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>Desvincular conta Duo</span>
                            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted2)" }}>Cada um volta para uma conta Solo. O histórico compartilhado fica com os dois.</span>
                          </span>
                          <button type="button" onClick={() => up({ modal: "desvincular" })} style={{ height: 42, padding: "0 16px", borderRadius: 13, border: "1px solid var(--out-line)", background: "var(--surface)", color: "var(--out-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Desvincular</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {t === "notificacoes-pref" && !s.pageLoading && (
                  <div style={{ ...CARTAO, padding: "8px 22px", display: "flex", flexDirection: "column" }}>
                    {prefLista.map((o) => {
                      const on = p[o.k] as boolean;
                      return (
                        <div key={o.k} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--line-soft)" }}>
                          <button type="button" role="switch" aria-checked={on} onClick={() => setP(o.k, !on as Prefs[typeof o.k])} style={{ display: "flex", alignItems: "center", gap: 14, padding: 0, border: "none", background: "transparent", color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                            <span style={{ flex: "none", width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: on ? "var(--accent-soft)" : "var(--line-soft)", color: on ? "var(--accent-ink)" : "var(--faint)", transition: "background .2s ease, color .2s ease" }}><Ic d={o.ic} size={17} /></span>
                            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{o.label}</span><span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--muted2)" }}>{o.desc}</span></span>
                            <Chave on={on} />
                          </button>
                          {o.chips && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 50, animation: "mmDrop .25s ease both" }}>
                              {o.chips.map((c) => {
                                const oo = opcao(c.on);
                                return <button key={c.label} type="button" aria-pressed={c.on} onClick={c.onClick} style={{ height: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${oo.borda}`, background: oo.bg, color: oo.cor, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{c.label}</button>;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <span style={{ padding: "12px 0 14px", fontSize: 12, color: "var(--faint)" }}>As mudanças são salvas na hora.</span>
                  </div>
                )}

                {t === "aparencia" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div role="radiogroup" aria-label="Tema" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12 }}>
                      {TEMAS.map(([k, label, desc, fundo, card, linha]) => {
                        const on = s.temaLocal === k;
                        return (
                          <button key={k} type="button" role="radio" aria-checked={on} onClick={(e) => { up({ temaLocal: k }); aplicarEscolhaTema(k, e.currentTarget); }} className={on ? undefined : "mm-h-card"} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 12px 14px", borderRadius: 20, border: `1.5px solid ${on ? "var(--accent)" : "var(--line2)"}`, background: "var(--surface)", color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                            <span style={{ position: "relative", height: 96, borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", background: fundo }}>
                              <span style={{ position: "absolute", left: 12, top: 12, width: "40%", height: 8, borderRadius: 4, background: linha }} />
                              <span style={{ position: "absolute", left: 12, top: 30, right: 12, height: 34, borderRadius: 9, background: card }} />
                              <span style={{ position: "absolute", left: 12, bottom: 12, width: "30%", height: 8, borderRadius: 4, background: "#6f5cf0" }} />
                            </span>
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span><span style={{ fontSize: 12, color: "var(--faint)" }}>{desc}</span></span>
                              <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${on ? "var(--accent)" : "var(--line2)"}`, display: "grid", placeItems: "center", transition: "border-color .2s ease" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: on ? "var(--accent)" : "transparent", transform: on ? "scale(1)" : "scale(.4)", transition: "transform .25s cubic-bezier(.2,.8,.2,1), background .2s ease" }} /></span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" role="switch" aria-checked={s.abrirOculto} onClick={() => { const abrirOculto = !s.abrirOculto; up({ abrirOculto }); salvarAjustes(duoDe(s) ? "duo" : "solo", { abrirOculto }); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 22px", borderRadius: 22, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 14, fontWeight: 700 }}>Abrir o app com valores ocultos</span><span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--muted2)" }}>Os valores aparecem como R$ •••• até você tocar no ícone de olho.</span></span>
                      <Chave on={s.abrirOculto} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {t === "investimentos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "mmRiseC .5s cubic-bezier(.2,.8,.2,1) both" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: 999, border: "1px dashed var(--accent-line)", color: "var(--accent-ink)", fontSize: 11.5, fontWeight: 700 }}>Baixa prioridade · V2/V3</span>
                  <h1 style={{ margin: 0, fontFamily: SORA, fontSize: 30, fontWeight: 300, letterSpacing: "-.04em" }}>Investimentos</h1>
                </div>
                <button type="button" onClick={novoAtivo} style={btnPrim({ height: 46, padding: "0 18px" })}>+ Adicionar ativo</button>
              </div>
              {duo && (
                <div style={{ display: "inline-flex", alignSelf: "flex-start", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 14, background: "var(--line-soft)" }}>
                  {([["casal", "Casal", "linear-gradient(135deg, #4e9e79 50%, #e2a24f 50%)", ""], ["gustavo", "Você", "#4e9e79", "G"], ["suelen", "Suelen", "#e2a24f", "S"]] as const).map(([k, label, avc, ini]) => (
                    <button key={k} type="button" aria-pressed={s.invView === k} onClick={() => up({ invView: k })} style={{ height: 38, padding: "0 14px 0 8px", borderRadius: 11, border: "none", ...segmento(s.invView === k), fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Avatar av={avc} ini={ini} size={22} fs={10} />{label}
                    </button>
                  ))}
                </div>
              )}

              {s.pageLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "mmFade .3s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: "var(--muted2)" }}>
                    <div style={{ width: 56 }}><Gato cor="#4e9e79" expressao="atento" corpo={false} /></div>
                    Atualizando cotações…
                  </div>
                  <Skel h={150} r={24} />
                  {[1, 2, 3].map((k) => <Skel key={k} h={62} r={18} />)}
                </div>
              )}

              {!s.pageLoading && !all.length && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "44px 20px", borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center", animation: "mmFade .35s ease both" }}>
                  <div style={{ display: "flex" }}>
                    {[P.gustavo, ...(duo ? [P.suelen] : [])].map((g, i) => <div key={g.nome} style={{ width: 112, marginLeft: i ? -24 : 0 }}><Gato cor={g.cor} tabby={g.tabby} expressao="curioso" /></div>)}
                  </div>
                  <span style={{ fontFamily: SORA, fontSize: 22, fontWeight: 300, letterSpacing: "-.02em" }}>Nenhum ativo cadastrado</span>
                  <span style={{ maxWidth: 400, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{duo ? "Cadastrem ações, FIIs, ETFs e renda fixa que vocês já têm. O Mimo mostra a carteira de cada um e a do casal." : "Cadastre ações, FIIs, ETFs e renda fixa que você já tem. O Mimo acompanha a rentabilidade da carteira."}</span>
                  <button type="button" onClick={novoAtivo} style={btnPrim({ marginTop: 4, height: 46, padding: "0 18px" })}>Cadastrar o primeiro ativo</button>
                </div>
              )}

              {!s.pageLoading && all.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "mmFade .35s ease both" }}>
                  <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "stretch" }}>
                    <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                      <span style={OLHO}>{view === "casal" ? "Carteira do casal" : view === "suelen" ? "Carteira de Suelen" : "Sua carteira"}</span>
                      <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
                        <span key={view} style={{ fontFamily: SORA, fontSize: 44, fontWeight: 300, letterSpacing: "-.045em", lineHeight: 1, animation: "mmFade .3s ease both" }}>{fmt(T.v)}</span>
                        <span style={{ marginBottom: 5, padding: "4px 10px", borderRadius: 999, border: `1px solid ${rcT.rLine}`, background: rcT.rBg, color: rcT.rCor, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>{pc(rTot) + " no total"}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", columnGap: 28, rowGap: 10, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                        {[["Investido", fmt(T.i), "var(--ink)"], ["Resultado", (T.v - T.i >= 0 ? "+ " : "− ") + fmt(Math.abs(T.v - T.i)), rcT.rCor], ["Ativos", String(lista.length), "var(--ink)"]].map(([k, v, cor]) => (
                          <span key={k} style={{ display: "flex", flexDirection: "column", gap: 5 }}><span style={{ fontSize: 11.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--faint)" }}>{k}</span><span style={{ fontFamily: SORA, fontSize: 18, color: cor }}>{v}</span></span>
                        ))}
                      </div>
                      {view === "casal" && duo && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--line-soft)" }}>
                            <div style={{ width: (G.v / (G.v + Sx.v || 1)) * 100 + "%", background: "#4e9e79", transition: "width .5s ease" }} /><div style={{ width: (Sx.v / (G.v + Sx.v || 1)) * 100 + "%", background: "#e2a24f", transition: "width .5s ease" }} />
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--muted)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4e9e79" }} />Você <strong style={{ color: "var(--ink)" }}>{fmt(G.v, false)}</strong> · {pc(G.i ? G.v / G.i - 1 : 0)}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2a24f" }} />Suelen <strong style={{ color: "var(--ink)" }}>{fmt(Sx.v, false)}</strong> · {pc(Sx.i ? Sx.v / Sx.i - 1 : 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                      <span style={OLHO}>Por tipo de ativo</span>
                      <div style={{ display: "flex", height: 14, borderRadius: 99, overflow: "hidden", background: "var(--line-soft)", gap: 2 }}>
                        {aloc.map((a) => <div key={a.label} style={{ width: a.w, background: a.cor, transition: "width .5s cubic-bezier(.22,.9,.18,1)" }} />)}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {aloc.map((a) => (
                          <span key={a.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--muted)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: a.cor }} />{a.label} · {a.pct}</span>
                            <span style={{ fontFamily: SORA, fontSize: 15 }}>{a.v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                  <div style={{ ...CARTAO, padding: "8px 22px", display: "flex", flexDirection: "column" }}>
                    {!cp && (
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(4, minmax(0, 1fr)) 90px", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--faint)" }}>
                        <span>Ativo</span><span style={{ textAlign: "right" }}>Qtd</span><span style={{ textAlign: "right" }}>Preço médio</span><span style={{ textAlign: "right" }}>Atual</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>Rent.</span>
                      </div>
                    )}
                    {lista.slice().sort((x, y) => y.valor - x.valor).map((a, i) => (
                      <button key={a.id} type="button" className="mm-h-linha" onClick={() => setS((x) => ({ ...x, modal: "ativo", editAtivo: a.id, confirmAtivo: false, tentou: { ...x.tentou, ativo: false }, forms: { ...x.forms, ativo: { tipo: a.tipo, ticker: a.ticker, qtd: String(a.qtd), pm: String(a.pm).replace(".", ","), atual: a.atual ? String(a.atual).replace(".", ",") : "", dono: a.dono } } }))} style={{ display: "grid", gridTemplateColumns: colunas, gap: 12, alignItems: "center", minHeight: 62, padding: "8px 0", border: "none", borderBottom: "1px solid var(--line-soft)", borderRadius: 0, background: a.novo ? "var(--accent-soft)" : "transparent", color: "var(--ink)", textAlign: "left", cursor: "pointer", fontSize: 13.5, animation: `mmFade .35s ${i * 0.04}s ease both` }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                          <span style={{ position: "relative", flex: "none", width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: TIPOS[a.tipo][1], color: "#ffffff", fontSize: 10, fontWeight: 700 }}>
                            {{ acao: "AÇ", fii: "FII", etf: "ETF", rf: "RF" }[a.tipo]}
                            {duo && view === "casal" && <span style={{ position: "absolute", right: -4, bottom: -4, width: 16, height: 16, borderRadius: "50%", background: P[a.dono].av, boxShadow: "0 0 0 2px var(--surface)" }} />}
                          </span>
                          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.ticker}{a.novo && <span style={{ padding: "2px 7px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5 }}>Novo</span>}</span>
                            <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{TIPOS[a.tipo][0] + (cp ? (a.tipo === "rf" ? "" : " · " + a.qtd + " cotas") : "") + (duo && view === "casal" ? " · " + (a.dono === "suelen" ? "Suelen" : "você") : "")}</span>
                          </span>
                        </span>
                        {!cp && (
                          <>
                            <span style={{ textAlign: "right", color: "var(--muted)" }}>{a.tipo === "rf" ? "—" : String(a.qtd)}</span>
                            <span style={{ textAlign: "right", color: "var(--muted)" }}>{a.tipo === "rf" ? "—" : n2(a.pm)}</span>
                            <span style={{ textAlign: "right", color: "var(--muted)" }}>{a.tipo === "rf" ? "—" : n2(a.preco)}</span>
                          </>
                        )}
                        <span style={{ textAlign: "right", fontFamily: SORA, whiteSpace: "nowrap" }}>{fmt(a.valor)}</span>
                        <span style={{ textAlign: "right", fontWeight: 700, color: a.r >= 0 ? "var(--in-ink)" : "var(--out-ink)", whiteSpace: "nowrap" }}>{pc(a.r)}</span>
                      </button>
                    ))}
                    <span style={{ padding: "12px 0 14px", fontSize: 12, lineHeight: 1.5, color: "var(--faint)" }}>Ativos cadastrados manualmente. Cotações de fechamento de {dataBr(dataSeed(0, Math.max(1, DIA_HOJE - 1)))}. Toque em um ativo para editar.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* modais e avisos numa camada fixa acima do topo e do dock */}
      <div data-mimo="app" data-tema={tema} style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none", color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <Presenca aberto={!!s.modal}>{modalNode}</Presenca>
        <Toast msg={s.toast} bottom={cp ? "88px" : "124px"} anim="mmRiseC" z={60} />
      </div>
    </Moldura>
  );
}
