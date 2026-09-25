import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Moldura, type DestinoDock } from "../components/Moldura";
import { ViewLista } from "../components/ViewLista";
import { btnPrim, btnSec, campoSt, CARTAO, ERRO_CAMPO, LINK_TEXTO, numBR, OLHO, opcao, OPCIONAL, ROTULO, segmento, SORA, brl } from "../components/mimo/estilos";
import { Gato, type Expressao } from "../components/mimo/Gato";
import { Avatar, Chave, Ic, Presenca, Skel, Spinner } from "../components/mimo/ui";
import { useDialogo } from "../hooks/useDialogo";
import { useMimoApp } from "../hooks/useMimoApp";
import { useTimers } from "../hooks/useTimers";
import { categoriasDe, salvarAjustes } from "../lib/ajustes";
import { AUTORES, MOTOR_DUO, lerAcertos, nomeMes, resumoDuo, rotuloMes, salvarAcertos, useAcertos, type Acerto, type Regra } from "../lib/contaDuo";
import { MESES } from "../lib/constants";
import { DIA_HOJE, HOJE_ISO, MES_REF, PROXIMO_MES, dataBr, dataSeed } from "../lib/helpers";
import { usePlano } from "../lib/plano";
import { useCompacto, useTemaTela } from "../lib/tema";
import type { Autor, Item } from "../types";

// Porta de docs/ref/AppDuoMetas.dc.html ("Mimo Duo e Metas", escopos 3 e 4):
//   3a Visão do casal (/duo) · 3b Movimentações (/duo/movimentacoes)
//   3c Divisão (/duo/divisao) · 3d Limite de lazer (modal) · 3e Lançamento
//   (o formulário comum do painel, com quem vê e dividir)
//   4a Metas (/metas) · 4b/4c Criar (/metas/nova, /metas/catalogo)
//   4d Detalhe (/metas/:id) · 4e Aporte e 4f Marcos (modais)
//   4g Por prioridade (/metas/:id/prioridade)
// A Visão do casal, a Divisão e o Lazer saem das movimentações do motor Duo
// (useMimoApp) e dos ajustes da conta; metas e aportes ficam no navegador.
// ?estado= reproduz os estados do protótipo (vazio, pendencia, loading,
// preenchendo, erro, sucesso) e ?abrir= abre um modal (lancamento, lazer,
// aporte, marco-25/50/75/100).

type Quem = "gustavo" | "suelen" | "conjunta";
type Tela = "duo-geral" | "duo-movs" | "duo-divisao" | "metas" | "meta-nova" | "meta-catalogo" | "meta-detalhe" | "meta-prioridade";
type Modal = "lazer" | "aporte" | "marco" | "editar" | null;
type Dados = "vazio" | "dados" | "pendencia" | "loading";
type FormKey = "meta" | "cat" | "aporte" | "lazer" | "editar";
type Pessoa = { nome: string; rot: string; av: string; ini: string; cor: string; tabby: boolean };

interface Meta { id: string; nome: string; ic: string; alvo: number; g: number; s: number; prazo: number | null; ritmo: number; itens?: boolean }
interface MetaCalc extends Meta { tot: number }
interface AporteH { d: string; quem: "gustavo" | "suelen"; v: number; nota: string }

interface Forms {
  editar: { nome: string; alvo: string; prazo: string };
  meta: { nome: string; ic: string; alvo: string; prazo: string; inicial: string; inicialS: string };
  cat: { q: string; sel: string | null; auto: boolean; prazo: string; inicial: string };
  aporte: { quem: "gustavo" | "suelen"; valor: string; data: string; nota: string };
  lazer: { valor: string; modo: "juntos" | "metade" };
}

interface S {
  modal: Modal; marco: number; dados: Dados; forms: Forms; tentou: Partial<Record<FormKey, boolean>>;
  privado: boolean; regra: Regra;
  metaSel: string; aba: "manual" | "catalogo"; enviando: FormKey | "acerto" | null; buscando: boolean;
  ok: FormKey | null; aportes: Record<string, AporteH[]>; criadas: Meta[];
  /** Metas arquivadas e ajustes (nome, alvo, prazo) feitos nas metas de exemplo. */
  arquivadas: string[]; edicoes: Record<string, Partial<Meta>>;
}

const P: Record<Quem, Pessoa> = {
  gustavo: { nome: "Gustavo", rot: "Você", av: "#4e9e79", ini: "G", cor: "#4e9e79", tabby: false },
  suelen: { nome: "Suelen", rot: "Suelen", av: "#e2a24f", ini: "S", cor: "#e2a24f", tabby: true },
  conjunta: { nome: "Conta conjunta", rot: "Conta conjunta", av: "linear-gradient(135deg, #4e9e79 50%, #e2a24f 50%)", ini: "", cor: "var(--accent)", tabby: false },
};

const ICON: Record<string, string> = {
  casa: "M3.5 10.5 12 4l8.5 6.5V20h-5.5v-5.5h-6V20H3.5z",
  viagem: "M21 3 3 10.4l7.2 2.4L12.6 20z M10.2 12.8 15 8",
  anel: "M12 9.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z M9.2 3.5h5.6L12 9.5z",
  reforma: "M14.5 5.5a4 4 0 0 0-5 5L3.5 16.5l3 3 6-6a4 4 0 0 0 5-5l-2.4 2.4-2.3-.7-.7-2.3z",
  escudo: "M12 3.5 19.5 6v5.5c0 4.6-3.2 7.7-7.5 9-4.3-1.3-7.5-4.4-7.5-9V6z",
  carro: "M4 15.5h16v3.5h-3v-1.5H7V19H4z M5.5 15.5 7.3 9h9.4l1.8 6.5",
  produto: "M4 7.5 12 3.5l8 4v9l-8 4-8-4z M4 7.5l8 4 8-4 M12 11.5v9",
};
type Prio = "essencial" | "importante" | "conforto";
const ITENS: { nome: string; art: string; p: Prio; v: number }[] = [
  { nome: "Geladeira Brastemp Frost Free 480L", art: "a geladeira", p: "essencial", v: 4899 },
  { nome: "Máquina de lavar Electrolux 12kg", art: "a máquina de lavar", p: "essencial", v: 2799 },
  { nome: "Fogão Consul 5 bocas", art: "o fogão", p: "essencial", v: 1699 },
  { nome: "Cama box queen com colchão", art: "a cama", p: "importante", v: 3200 },
  { nome: "Sofá retrátil 3 lugares", art: "o sofá", p: "importante", v: 3450 },
  { nome: "Mesa de jantar 4 lugares", art: "a mesa de jantar", p: "importante", v: 1890 },
  { nome: "Smart TV Samsung 55\" 4K", art: "a TV", p: "conforto", v: 3299 },
  { nome: "Air fryer e micro-ondas", art: "a air fryer e o micro-ondas", p: "conforto", v: 1180 },
  { nome: "Rack e tapete da sala", art: "o rack e o tapete", p: "conforto", v: 1584 },
];
const PRIO: Record<Prio, { label: string; cor: string }> = { essencial: { label: "Essencial", cor: "#6f5cf0" }, importante: { label: "Importante", cor: "rgba(111,92,240,.55)" }, conforto: { label: "Conforto", cor: "rgba(111,92,240,.26)" } };
const ORDEM: Prio[] = ["essencial", "importante", "conforto"];
const TOTAL_ITENS = ITENS.reduce((a, i) => a + i.v, 0);
const METAS_DUO: Meta[] = [
  { id: "casa", nome: "Montar a casa nova", ic: "casa", alvo: 24000, g: 6300, s: 5100, prazo: 6, ritmo: 1825, itens: true },
  { id: "japao", nome: "Viagem ao Japão", ic: "viagem", alvo: 28000, g: 11200, s: 9800, prazo: 7, ritmo: 2400 },
  { id: "casamento", nome: "Casamento", ic: "anel", alvo: 45000, g: 7100, s: 5500, prazo: 13, ritmo: 1500 },
  { id: "banheiro", nome: "Reforma do banheiro", ic: "reforma", alvo: 8000, g: 900, s: 1100, prazo: null, ritmo: 400 },
];
const METAS_SOLO: Meta[] = [
  { id: "casa", nome: "Montar o apê", ic: "casa", alvo: 24000, g: 11400, s: 0, prazo: 6, ritmo: 1825, itens: true },
  { id: "chile", nome: "Viagem ao Chile", ic: "viagem", alvo: 9500, g: 7200, s: 0, prazo: 3, ritmo: 800 },
  { id: "cozinha", nome: "Reforma da cozinha", ic: "reforma", alvo: 18000, g: 9300, s: 0, prazo: 9, ritmo: 950 },
  { id: "reserva", nome: "Reserva de emergência", ic: "escudo", alvo: 20000, g: 4100, s: 0, prazo: null, ritmo: 500 },
];
const CATALOGO = [
  { id: "g1", cat: "Geladeira", marca: "Brastemp", modelo: "Frost Free Inverse 480L BRE85", preco: 4899, vr: -3.2 },
  { id: "g2", cat: "Geladeira", marca: "Electrolux", modelo: "Inverter Frost Free 454L IB7S", preco: 4349, vr: 1.4 },
  { id: "g3", cat: "Geladeira", marca: "Consul", modelo: "Frost Free Duplex 410L CRM50", preco: 3199, vr: -0.8 },
  { id: "g4", cat: "Geladeira", marca: "Samsung", modelo: "French Door 470L RF48", preco: 6190, vr: 2.1 },
  { id: "f1", cat: "Fogão", marca: "Consul", modelo: "5 bocas CFS5", preco: 1699, vr: -1.1 },
  { id: "m1", cat: "Máquina de lavar", marca: "Electrolux", modelo: "12kg LFE12", preco: 2799, vr: -0.4 },
  { id: "s1", cat: "Sofá", marca: "Tok&Stok", modelo: "Retrátil 3 lugares Duda", preco: 3450, vr: 1.8 },
  { id: "t1", cat: "Smart TV", marca: "Samsung", modelo: "55\" Crystal UHD 4K", preco: 3299, vr: -4.5 },
  { id: "t2", cat: "Smart TV", marca: "LG", modelo: "55\" OLED evo C4", preco: 6499, vr: -2.0 },
  { id: "n1", cat: "Notebook", marca: "Apple", modelo: "MacBook Air M3 13\"", preco: 9299, vr: 0.6 },
];
const HOJE = HOJE_ISO;
/** "aaaa-mm" daqui a N meses (negativo: meses atrás). */
const mesDaqui = (n: number) => dataSeed(-n, 1).slice(0, 7);
const VAZIO: Forms = {
  editar: { nome: "", alvo: "", prazo: "" },
  meta: { nome: "", ic: "casa", alvo: "", prazo: "", inicial: "", inicialS: "" },
  cat: { q: "", sel: null, auto: true, prazo: "", inicial: "" },
  aporte: { quem: "gustavo", valor: "", data: HOJE, nota: "" },
  lazer: { valor: "", modo: "juntos" },
};
const CHEIO: Forms = {
  editar: { nome: "Viagem ao Japão", alvo: "30.000", prazo: mesDaqui(8) },
  meta: { nome: "Viagem para Salvador", ic: "viagem", alvo: "6.500", prazo: mesDaqui(4), inicial: "800", inicialS: "600" },
  cat: { q: "geladeira", sel: "g1", auto: true, prazo: mesDaqui(3), inicial: "1.200" },
  aporte: { quem: "gustavo", valor: "800", data: HOJE, nota: "Parte do salário" },
  lazer: { valor: "800", modo: "juntos" },
};
const ERRO: Forms = {
  editar: { nome: "", alvo: "0", prazo: mesDaqui(-3) },
  meta: { nome: "", ic: "casa", alvo: "5.000", prazo: mesDaqui(-3), inicial: "4.000", inicialS: "3.500" },
  cat: { q: "geladeira xpto 9000", sel: null, auto: true, prazo: "", inicial: "" },
  aporte: { quem: "gustavo", valor: "15.000", data: dataSeed(-1, 2), nota: "" },
  lazer: { valor: "0", modo: "juntos" },
};

// ---- rotas ---------------------------------------------------------------------
function lerRota(path: string): { tela: Tela; metaId?: string } | null {
  const p = path.replace(/\/+$/, "") || "/";
  const fixas: Record<string, Tela> = { "/duo": "duo-geral", "/duo/movimentacoes": "duo-movs", "/duo/divisao": "duo-divisao", "/metas": "metas", "/metas/nova": "meta-nova", "/metas/catalogo": "meta-catalogo" };
  if (fixas[p]) return { tela: fixas[p] };
  let m = /^\/metas\/([^/]+)\/prioridade$/.exec(p);
  if (m) return { tela: "meta-prioridade", metaId: decodeURIComponent(m[1]) };
  m = /^\/metas\/([^/]+)$/.exec(p);
  if (m) return { tela: "meta-detalhe", metaId: decodeURIComponent(m[1]) };
  return null;
}
function rotaDe(tela: Tela, metaId: string) {
  const r: Record<Tela, string> = {
    "duo-geral": "/duo", "duo-movs": "/duo/movimentacoes", "duo-divisao": "/duo/divisao", metas: "/metas", "meta-nova": "/metas/nova",
    "meta-catalogo": "/metas/catalogo", "meta-detalhe": `/metas/${encodeURIComponent(metaId)}`, "meta-prioridade": `/metas/${encodeURIComponent(metaId)}/prioridade`,
  };
  return r[tela];
}

const clonar = (f: Forms): Forms => ({ editar: { ...f.editar }, meta: { ...f.meta }, cat: { ...f.cat }, aporte: { ...f.aporte }, lazer: { ...f.lazer } });

interface Salvas { criadas: Meta[]; aportes: Record<string, AporteH[]>; arquivadas: string[]; edicoes: Record<string, Partial<Meta>> }

function init(tela: Tela, metaId: string | undefined, est: string, duo: boolean, abrir: string): S {
  let modal: Modal = null;
  let marco = 50;
  if (abrir === "lazer") modal = "lazer";
  if (abrir === "aporte") modal = "aporte";
  if (abrir === "editar") modal = "editar";
  const mk = /^marco-(25|50|75|100)$/.exec(abrir);
  if (mk) { modal = "marco"; marco = Number(mk[1]); }
  if (!duo && modal === "lazer") modal = null;
  const fKey: FormKey | null = modal && modal !== "marco" ? modal : tela === "meta-nova" ? "meta" : tela === "meta-catalogo" ? "cat" : null;
  const fEst = fKey ? ({ dados: "preenchendo", pendencia: "preenchendo" } as Record<string, string>)[est] || est : null;
  const dados: Dados = fKey || modal ? "dados" : ((({ vazio: "vazio", pendencia: "pendencia", loading: "loading" } as Record<string, Dados>)[est]) || "dados");
  const forms = clonar(VAZIO);
  if (fKey) {
    const src = fEst === "vazio" ? VAZIO : fEst === "erro" ? ERRO : CHEIO;
    (forms as unknown as Record<string, unknown>)[fKey] = { ...src[fKey] };
  }
  if (fKey === "cat" && fEst === "loading") forms.cat = { ...VAZIO.cat, q: "geladeira" };
  const tentou: S["tentou"] = {};
  if (fEst === "erro" && fKey) tentou[fKey] = true;
  const s: S = {
    modal, marco, dados, forms, tentou,
    privado: false, regra: "meio",
    metaSel: metaId ?? "casa", aba: tela === "meta-catalogo" ? "catalogo" : "manual",
    enviando: fEst === "loading" && fKey !== "cat" ? fKey : null, buscando: fKey === "cat" && fEst === "loading",
    ok: null,
    // sem estado forçado, as metas criadas, os aportes e as edições voltam do navegador
    ...(est === "dados" ? metasSalvas(duo) : { criadas: [], aportes: {}, arquivadas: [], edicoes: {} }),
  };
  if (fEst === "sucesso") {
    if (fKey === "lazer") s.modal = null;
    else if (fKey === "aporte") { s.aportes = { casa: [{ d: dataBr(HOJE), quem: "gustavo", v: 800, nota: "Parte do salário" }] }; s.modal = "marco"; s.marco = 50; }
    else if (fKey === "editar") s.modal = null;
    else s.ok = fKey;
  }
  return s;
}

// ---- metas salvas no navegador (uma lista por conta) ---------------------------
const chaveMetas = (duo: boolean) => `mimo.metas.${duo ? "duo" : "solo"}.v1`;
function metasSalvas(duo: boolean): Salvas {
  const vazio: Salvas = { criadas: [], aportes: {}, arquivadas: [], edicoes: {} };
  try {
    const bruto = localStorage.getItem(chaveMetas(duo));
    const lido = bruto ? JSON.parse(bruto) : null;
    if (lido && Array.isArray(lido.criadas) && lido.aportes && typeof lido.aportes === "object") return { ...vazio, ...lido };
  } catch {
    // sem armazenamento, começa vazio
  }
  return vazio;
}
function guardarMetas(duo: boolean, salvas: Salvas) {
  try {
    localStorage.setItem(chaveMetas(duo), JSON.stringify(salvas));
  } catch {
    // segue só em memória
  }
}

// ---- cálculos (funções puras sobre o estado) -----------------------------------
function metasDe(st: S, duo: boolean, tela: Tela): MetaCalc[] {
  if (st.dados === "vazio" && tela === "metas") return st.criadas.map((m) => ({ ...m, tot: m.g + m.s }));
  return [...(duo ? METAS_DUO : METAS_SOLO), ...st.criadas]
    .filter((m) => !st.arquivadas.includes(m.id))
    .map((m0) => {
      const m = { ...m0, ...st.edicoes[m0.id] };
      let g = m.g;
      let sv = m.s;
      if (st.dados === "vazio" && !m.id.startsWith("n")) { g = 0; sv = 0; }
      const ex = st.aportes[m.id] ?? [];
      ex.forEach((a) => { if (a.quem === "suelen" && duo) sv += a.v; else g += a.v; });
      return { ...m, g, s: sv, tot: g + sv };
    });
}

// "dd/mm/aaaa" -> "aaaa-mm" e "aaaa-mm-dd"
const mesDoAporte = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}`;
const isoDoAporte = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

// Histórico de exemplo das metas de fábrica: um aporte por pessoa nos últimos
// 6 meses, proporcional ao que cada um já guardou. Sai sempre igual (sem sorteio).
function exemploAportes(m: Meta, duo: boolean): AporteH[] {
  const l: AporteH[] = [];
  const arred = (v: number) => Math.max(50, Math.round(v / 50) * 50);
  for (let k = 5; k >= 0; k--) {
    const ajuste = [0.85, 1.1, 0.95, 1.2, 0.9, 1.05][k];
    const diaG = k === 0 ? Math.min(5, DIA_HOJE) : 5;
    const diaS = k === 0 ? Math.min(18, DIA_HOJE) : 18;
    if (m.g) l.push({ d: dataBr(dataSeed(k, diaG)), quem: "gustavo", v: arred(m.g * 0.08 * ajuste), nota: k === 3 ? "Venda da bicicleta" : "Parte do salário" });
    if (duo && m.s) l.push({ d: dataBr(dataSeed(k, diaS)), quem: "suelen", v: arred(m.s * 0.08 * (2.1 - ajuste)), nota: k % 2 ? "Freela de ilustração" : "" });
  }
  return l;
}

/** Rótulo "setembro de 2026" para daqui a k meses. */
const mesLabel = (k: number) => rotuloMes(mesDaqui(k));

/** "a, b e c" */
const juntar = (l: string[]) => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]);

// Skeleton de carregamento só no primeiro acesso da sessão.
const CARREGOU = "mimo.duo.carregou";
const jaCarregou = () => {
  try { return Boolean(sessionStorage.getItem(CARREGOU)); } catch { return false; }
};
const marcarCarregou = () => {
  try { sessionStorage.setItem(CARREGOU, "1"); } catch { /* sem armazenamento */ }
};

type Erros = Record<string, string>;

const TRANSICAO_PAGINA: CSSProperties = { animation: "mmRise .6s cubic-bezier(.2,.8,.2,1) both" };
const H1: CSSProperties = { margin: 0, fontFamily: SORA, fontSize: 32, fontWeight: 300, letterSpacing: "-.04em" };
const VOLTAR: CSSProperties = { alignSelf: "flex-start", padding: 0, border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const LINHA: CSSProperties = { display: "flex", alignItems: "center", borderBottom: "1px solid var(--line-soft)" };

function Barra({ partes, h = 8, marcos, anim }: { partes: { w: string; cor: string; op?: string }[]; h?: number; marcos?: string[]; anim?: string }) {
  return (
    <div style={{ position: "relative", display: "flex", height: h, borderRadius: 99, overflow: "hidden", background: "var(--line-soft)" }}>
      {partes.map((b, i) => <div key={i} style={{ width: b.w, background: b.cor, opacity: b.op, transition: anim ?? "width .6s cubic-bezier(.22,.9,.18,1)" }} />)}
      {marcos?.map((mk) => <span key={mk} style={{ position: "absolute", top: 0, bottom: 0, left: mk, width: 2, background: "var(--surface)" }} />)}
    </div>
  );
}

function Opcao({ on, onClick, children, style }: { on: boolean; onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  const o = opcao(on);
  return <button type="button" aria-pressed={on} onClick={onClick} style={{ border: `1px solid ${o.borda}`, background: o.bg, color: o.cor, cursor: "pointer", ...style }}>{children}</button>;
}

type CampoF = { v: string; on: (e: { target: { value: string } }) => void; borda: string };

function BotaoEnvio({ env, label, labelEnv, onClick, style }: { env: boolean; label: string; labelEnv: string; onClick: () => void; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} aria-busy={env} style={{ ...btnPrim(), opacity: env ? 0.7 : 1, ...style }}>
      {env && <Spinner />}
      {env ? labelEnv : label}
    </button>
  );
}

function Moeda({ f, h = 48, fs, pad = "0 12px 0 42px", style }: { f: CampoF; h?: number; fs?: number; pad?: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--faint)" }}>R$</span>
      <input inputMode="decimal" value={f.v} onChange={f.on} placeholder="0,00" style={campoSt(f.borda, { height: h, padding: pad, fontSize: fs ?? 14.5, ...style })} />
    </div>
  );
}

function GatosDuplos({ w, ml, exp, corpo = false }: { w: number; ml: number; exp: Expressao; corpo?: boolean }) {
  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: w }}><Gato cor="#4e9e79" expressao={exp} corpo={corpo} /></div>
      <div style={{ width: w, marginLeft: ml }}><Gato cor="#e2a24f" tabby expressao={exp} corpo={corpo} /></div>
    </div>
  );
}

export default function DuoMetas() {
  const tema = useTemaTela();
  const cp = useCompacto();
  const plano = usePlano();
  const duo = plano === "duo";
  const loc = useLocation();
  const navigate = useNavigate();
  const { later } = useTimers();
  const rota = lerRota(loc.pathname);
  const t: Tela = rota?.tela ?? "duo-geral";

  const [s, setS] = useState<S>(() => {
    const q = new URLSearchParams(loc.search);
    const est = q.get("estado") ?? "";
    const st = init(t, rota?.metaId, est || "dados", duo, q.get("abrir") ?? "");
    // sem estado forçado, as telas de lista abrem com um instante de skeleton,
    // só no primeiro acesso da sessão
    if (!est && !st.modal && ["duo-geral", "metas"].includes(t) && !jaCarregou()) st.dados = "loading";
    return st;
  });
  const autoCarregar = useRef(!new URLSearchParams(loc.search).get("estado"));
  const sRef = useRef(s);
  useLayoutEffect(() => { sRef.current = s; });
  const metaSel = rota?.metaId ?? s.metaSel;
  const app = useMimoApp(duo ? MOTOR_DUO : {});
  const acertos = useAcertos();
  const caixaModal = useDialogo<HTMLDivElement>(Boolean(s.modal));

  useEffect(() => {
    if (!autoCarregar.current) return;
    later(() => {
      marcarCarregou();
      setS((p) => (p.dados === "loading" ? { ...p, dados: "dados" } : p));
    }, 750);
  }, [later]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  // ?abrir=lancamento: o formulário de lançamento é o do painel (com quem vê e dividir)
  const abrirPedido = useRef(new URLSearchParams(loc.search).get("abrir"));
  const { abrirNova } = app.actions;
  useEffect(() => {
    if (abrirPedido.current === "lancamento" && duo) { abrirPedido.current = null; abrirNova(); }
  }, [duo, abrirNova]);
  // metas criadas, aportes e edições ficam salvos (menos nos estados de protótipo ?estado=)
  const salvaMetas = useRef(!new URLSearchParams(loc.search).get("estado"));
  useEffect(() => {
    if (salvaMetas.current) guardarMetas(duo, { criadas: s.criadas, aportes: s.aportes, arquivadas: s.arquivadas, edicoes: s.edicoes });
  }, [duo, s.criadas, s.aportes, s.arquivadas, s.edicoes]);

  if (!rota) return <Navigate to={duo ? "/duo" : "/metas"} replace />;
  if (!duo && t.startsWith("duo")) return <Navigate to="/metas" replace />;
  // "Por prioridade" só existe para metas com lista de itens (hoje, a da casa)
  if (t === "meta-prioridade") {
    const alvo = metasDe(s, duo, t).find((x) => x.id === metaSel);
    if (alvo && !alvo.itens) return <Navigate to={rotaDe("meta-detalhe", metaSel)} replace />;
  }

  const up = (patch: Partial<S> | ((p: S) => Partial<S>)) => setS((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const fmtDe = (st: S) => (v: number, dec = true) => (st.privado ? "R$ ••••" : brl(v, dec));
  const fmt = fmtDe(s);
  const metaDe = (st: S): MetaCalc | undefined => { const l = metasDe(st, duo, t); return l.find((m) => m.id === metaSel) || l[0]; };

  const toast = (msg: string, acao?: { label: string; onClick: () => void }) => {
    app.avisar(msg, "#mimo-gato-feliz", acao);
  };
  const ir = (tela: Tela, extra: Partial<S> = {}) => {
    setS((p) => ({ ...p, modal: null, ok: null, dados: p.dados === "loading" ? "dados" : p.dados, ...extra }));
    navigate(rotaDe(tela, extra.metaSel ?? metaSel));
  };
  const setForm = <F extends FormKey, K extends keyof Forms[F]>(f: F, k: K, v: Forms[F][K]) =>
    setS((p) => ({ ...p, forms: { ...p.forms, [f]: { ...p.forms[f], [k]: v } } }));

  const rendaCasal = app.ajustes.renda + app.ajustes.rendaParceira;
  const prazoMin = "Escolha um mês a partir de " + rotuloMes(PROXIMO_MES) + ".";
  const errosDe = (st: S, f: FormKey): Erros => {
    const e: Erros = {};
    const fm = fmtDe(st);
    if (f === "meta") {
      const x = st.forms.meta;
      if (x.nome.trim().length < 2) e.nome = "Dê um nome para a meta.";
      const a = numBR(x.alvo);
      if (!(a > 0)) e.alvo = duo ? "Informe quanto vocês querem juntar." : "Informe quanto você quer juntar.";
      const i = (numBR(x.inicial) || 0) + (duo ? (numBR(x.inicialS) || 0) : 0);
      if (a > 0 && i > a) e.inicial = "O valor já guardado passa do alvo (" + fm(a, false) + ").";
      if (x.prazo && x.prazo < PROXIMO_MES) e.prazo = prazoMin;
    }
    if (f === "editar") {
      const x = st.forms.editar;
      const m = metaDe(st);
      if (x.nome.trim().length < 2) e.nome = "Dê um nome para a meta.";
      const a = numBR(x.alvo);
      if (!(a > 0)) e.alvo = "Informe um alvo maior que zero.";
      else if (m && a < m.tot) e.alvo = "O alvo não pode ser menor que o já guardado (" + fm(m.tot, false) + ").";
      if (x.prazo && x.prazo < PROXIMO_MES) e.prazo = prazoMin;
    }
    if (f === "cat") {
      const x = st.forms.cat;
      const it = CATALOGO.find((c) => c.id === x.sel);
      if (!it) e.sel = "Escolha um produto do catálogo.";
      if (it && (numBR(x.inicial) || 0) > it.preco) e.inicial = "O valor já guardado passa do preço de referência.";
      if (x.prazo && x.prazo < PROXIMO_MES) e.prazo = prazoMin;
    }
    if (f === "aporte") {
      const x = st.forms.aporte;
      const v = numBR(x.valor);
      const m = metaDe(st);
      const falta = m ? m.alvo - m.tot : 0;
      if (!(v > 0)) e.valor = "Informe um valor maior que zero.";
      else if (v > falta) e.valor = "Passa do que falta para a meta (" + fm(falta) + ").";
      if (!x.data) e.data = "Informe a data.";
      else if (x.data > HOJE) e.data = "A data não pode ser no futuro.";
    }
    if (f === "lazer") {
      const v = numBR(st.forms.lazer.valor);
      if (!(v > 0)) e.valor = "Informe um limite maior que zero.";
      else if (rendaCasal && v > rendaCasal * 0.4) e.valor = "Passa de 40% da renda de vocês (" + fm(rendaCasal * 0.4, false) + "). Tente um valor menor.";
    }
    return e;
  };
  const campo = <F extends FormKey>(f: F, k: keyof Forms[F] & string) => {
    const err = s.tentou[f] ? (errosDe(s, f)[k] || "") : "";
    return {
      v: String(s.forms[f][k] ?? ""),
      on: (e: { target: { value: string } }) => setForm(f, k, e.target.value as Forms[F][typeof k]),
      erro: err,
      borda: err ? "var(--out-line)" : "var(--line2)",
    };
  };
  // Pequena pausa de "salvando" para o botão dar retorno, sem travar a pessoa.
  const enviar = (f: FormKey, fim: (st: S) => void) => {
    const st = sRef.current;
    if (st.enviando) return;
    if (Object.keys(errosDe(st, f)).length) { setS((p) => ({ ...p, tentou: { ...p.tentou, [f]: true } })); return; }
    up({ enviando: f });
    later(() => { setS((p) => ({ ...p, enviando: null })); fim(sRef.current); }, 500);
  };

  // ---- derivados comuns: tudo sai das movimentações do motor Duo ---------------------
  const loading = s.dados === "loading" && ["duo-geral", "metas"].includes(t);
  const vazio = s.dados === "vazio";
  const mesRef = app.state.mesRef;
  const mesNome = nomeMes(mesRef);
  const lim: number | null = vazio ? null : (app.ajustes.orcamentos.Lazer || null);
  const r = resumoDuo(vazio ? [] : app.state.itens, mesRef, { regra: s.regra, renda: app.ajustes.renda, rendaParceira: app.ajustes.rendaParceira, acertos: vazio ? [] : acertos, limiteLazer: lim ?? 0 });
  const dv = r.divisao;
  const movs = [...r.doMes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id));
  // lançamento privado de Suelen: só o valor, sem descrição
  const row = (it: Item) => {
    const p = P[it.quem ?? "conjunta"];
    const oculto = it.privado && it.quem === "suelen";
    return { desc: oculto ? "Lançamento privado" : it.descricao, quemNome: p.nome, av: p.av, ini: p.ini, priv: !!it.privado, data: dataBr(it.data).slice(0, 5),
      vFmt: (it.tipo === "entrada" ? "+ " : "− ") + fmt(it.valor), cor: it.tipo === "entrada" ? "var(--in-ink)" : "var(--ink)" };
  };
  const abs = Math.abs(dv.dev);
  const quites = abs < 0.01;
  const divStatus = dv.vazio ? "Nada para dividir ainda" : quites ? "Tudo certo entre vocês" : dv.dev > 0 ? "Você deve " + fmt(abs) + " para Suelen" : "Suelen deve " + fmt(abs) + " para você";
  const pctG = Math.round(dv.pctG * 100);
  const regraTxt = s.regra === "meio" ? "meio a meio" : "proporcional à renda (" + pctG + "% e " + (100 - pctG) + "%)";
  const gExp: Expressao = vazio ? "curioso" : !quites && dv.dev > 0 ? "preocupado" : "padrao";
  const sExp: Expressao = vazio ? "curioso" : !quites && dv.dev > 0 ? "curioso" : "feliz";
  const lg = r.lazer.g;
  const ls = r.lazer.s;
  const lazerModo = app.ajustes.lazerModo;
  const lazerPend = !vazio && app.ajustes.lazerPendente;
  const geralVazio = !movs.length;
  const gatosPlano = (duo ? [P.gustavo, P.suelen] : [P.gustavo]).map((g, i) => ({ ...g, ml: i ? -26 : 0 }));
  const pctW = (v: number, tot: number) => (tot ? (v / tot) * 100 + "%" : "0%");
  const pagasConj = r.pagasPelaConjunta;
  const fraseConj = !r.cIn && !pagasConj.length
    ? "Nada entrou ou saiu da conjunta em " + mesNome + " ainda."
    : (r.cIn ? "Entraram " + fmt(r.cIn, false) + " na conjunta em " + mesNome + ". " : "")
      + (pagasConj.length ? juntar(pagasConj.slice(0, 3)) + (pagasConj.length > 3 ? " e mais " + (pagasConj.length - 3) : "") + (pagasConj.length === 1 ? " foi pago" : " foram pagos") + " por ela." : "");

  const abrirLanc = app.actions.abrirNova;
  const abrirLazer = () => setS((p) => ({ ...p, modal: "lazer", tentou: {}, forms: { ...p.forms, lazer: { valor: lim ? String(lim) : "", modo: lazerModo } } }));
  const abrirAporte = () => setS((p) => ({ ...p, modal: "aporte", tentou: {}, forms: { ...p.forms, aporte: { ...VAZIO.aporte } } }));

  // ---- metas -------------------------------------------------------------------------
  const metas = metasDe(s, duo, t);
  const pctM = (m: MetaCalc) => Math.min(100, m.alvo ? (m.tot / m.alvo) * 100 : 0);
  const barrasM = (m: MetaCalc) => (duo ? [{ w: (m.g / m.alvo) * 100 + "%", cor: "#4e9e79" }, { w: (m.s / m.alvo) * 100 + "%", cor: "#e2a24f" }] : [{ w: pctM(m) + "%", cor: "var(--accent)" }]);
  const irNova = (extra: Partial<Forms["meta"]> = {}) => {
    setS((p) => ({ ...p, aba: "manual", ok: null, tentou: {}, forms: { ...p.forms, meta: { ...VAZIO.meta, ...extra } } }));
    navigate("/metas/nova");
  };
  const irCatalogo = () => { up({ aba: "catalogo", ok: null, tentou: {} }); navigate("/metas/catalogo"); };
  const fm = { nome: campo("meta", "nome"), alvo: campo("meta", "alvo"), prazo: campo("meta", "prazo"), inicial: campo("meta", "inicial"), inicialS: campo("meta", "inicialS") };
  const c = s.forms.cat;
  const q = c.q.trim().toLowerCase();
  const res = q ? CATALOGO.filter((it) => q.split(/\s+/).every((w) => (it.cat + " " + it.marca + " " + it.modelo).toLowerCase().includes(w))) : [];
  const sel = CATALOGO.find((it) => it.id === c.sel);
  const varLbl = (v: number) => (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + "% no mês";
  const catErrs = s.tentou.cat ? errosDe(s, "cat") : {};
  let spark: { linha: string; area: string } | null = null;
  if (sel) {
    const h = [1.05, 1.07, 1.03, 1.02, 1 / (1 + sel.vr / 100), 1].map((k) => sel.preco * k);
    const mn = Math.min(...h) * 0.98;
    const mx = Math.max(...h) * 1.01;
    const pts = h.map((v, i) => [i * 60, 66 - ((v - mn) / (mx - mn)) * 60]);
    const linha = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    spark = { linha, area: linha + " L300 70 L0 70 Z" };
  }
  // prazo "aaaa-mm" vira quantos meses faltam a partir do mês atual
  const mesesAte = (prazo: string) => { const [y, mo] = prazo.split("-").map(Number); const [ya, ma] = MES_REF.split("-").map(Number); return y && mo ? Math.max(1, (y - ya) * 12 + (mo - ma)) : null; };
  const salvarMeta = (nome: string, ic: string, alvo: number, g: number, sv: number, prazo = ""): Meta => {
    const meses = mesesAte(prazo);
    return { id: "n" + Date.now(), nome, ic, alvo, g, s: sv, prazo: meses, ritmo: Math.max(300, Math.round((alvo - g - sv) / (meses ?? 12))) };
  };
  const criarOk = !!s.ok && (s.ok === "meta" || s.ok === "cat") && (t === "meta-nova" || t === "meta-catalogo");
  const criarOkTexto = s.ok === "cat" && sel
    ? "“" + sel.marca + " " + sel.modelo + "” virou meta com alvo de " + fmt(sel.preco) + (c.auto ? ". O alvo acompanha o preço de referência todo mês." : ".")
    : "“" + (s.forms.meta.nome || "Viagem para Salvador") + "” foi criada com alvo de " + fmt(numBR(s.forms.meta.alvo) || 6500) + ".";
  const catBuscar = (v: string) => {
    setS((p) => ({ ...p, buscando: !!v.trim(), forms: { ...p.forms, cat: { ...p.forms.cat, q: v, sel: null } } }));
    later(() => { if (sRef.current.forms.cat.q === v) up({ buscando: false }); }, 650);
  };

  // ---- detalhe (4d) e prioridade (4g) --------------------------------------------------
  // Os 7 meses que terminam no atual (histórico) e os 7 seguintes (projeção).
  const JANELA = Array.from({ length: 14 }, (_, i) => mesDaqui(i - 6));
  const m = metaDe(s);
  const detalhe = m ? (() => {
    const pct = Math.min(100, (m.tot / m.alvo) * 100);
    const falta = Math.max(0, m.alvo - m.tot);
    const novosAportes = s.aportes[m.id] ?? [];
    // aportes feitos aqui aparecem em qualquer meta; o exemplo só nas de fábrica
    const exemplo = m.id.startsWith("n") || vazio ? [] : exemploAportes(m, duo);
    const hist = [...novosAportes, ...exemplo]
      .map((h) => ({ ...h, quem: duo ? h.quem : ("gustavo" as const) }))
      .sort((a, b) => (isoDoAporte(b.d) > isoDoAporte(a.d) ? 1 : -1));
    // Ritmo real: média dos aportes dos últimos 3 meses (com o atual). Sem
    // aportes recentes, vale o ritmo planejado da meta.
    const recentes = hist.filter((h) => JANELA.slice(4, 7).includes(mesDoAporte(h.d)));
    const ritmoReal = recentes.length ? Math.round(recentes.reduce((a, h) => a + h.v, 0) / 3) : 0;
    const passo = ritmoReal || m.ritmo;
    const origemRitmo = ritmoReal ? "média dos últimos 3 meses" : "ritmo planejado";
    let ritmo: string;
    if (m.tot >= m.alvo) ritmo = "Meta concluída.";
    else if (!m.tot) ritmo = "Registre o primeiro aporte para ver quando " + (duo ? "vocês chegam" : "você chega") + " lá.";
    else {
      const n = Math.ceil(falta / passo);
      const base = "No ritmo atual (" + fmt(passo, false) + "/mês, " + origemRitmo + "), " + (duo ? "vocês chegam" : "você chega") + " lá em " + mesLabel(n);
      if (m.prazo == null) ritmo = base + ".";
      else if (n <= m.prazo) ritmo = base + ", dentro do prazo.";
      else ritmo = base + ", " + (n - m.prazo) + (n - m.prazo === 1 ? " mês" : " meses") + " depois do prazo. Com " + fmt(Math.ceil(falta / m.prazo / 50) * 50, false) + "/mês, " + (duo ? "chegam" : "chega") + " em " + mesLabel(m.prazo) + ".";
    }
    const itens = m.itens ? ORDEM.flatMap((p) => ITENS.filter((i) => i.p === p)) : [];
    let acc = 0;
    const itensC = itens.map((i) => { acc += i.v; return { ...i, ok: acc <= m.tot }; });
    const okList = itensC.filter((i) => i.ok);
    const prox = itensC.find((i) => !i.ok);
    const maior = okList.slice().sort((a, b) => b.v - a.v)[0];
    const essOk = itensC.filter((i) => i.p === "essencial").every((i) => i.ok);
    const compraTitulo = maior ? (duo ? "Vocês já podem comprar " : "Você já pode comprar ") + maior.art + "!" : "Ainda não dá para comprar nenhum item";
    const compraSub = !itens.length ? "" : (maior && essOk ? "O que está guardado cobre todos os itens essenciais. " : "") + (prox ? "Faltam " + fmt(itensC.slice(0, itensC.indexOf(prox) + 1).reduce((a, i) => a + i.v, 0) - m.tot) + " para " + prox.art + "." : "Tudo pago. Hora de comprar.");
    return {
      pct, falta, ritmo, passo, itensC, okList, maior, compraTitulo, compraSub, hist,
      guardado: fmt(m.tot), alvo: fmt(m.alvo, false), pctTxt: pct.toFixed(1).replace(".", ",") + "% guardado", faltaTxt: falta ? "Faltam " + fmt(falta) : "Meta atingida",
      barras: duo ? [{ w: (m.g / m.alvo) * 100 + "%", cor: "#4e9e79" }, { w: (m.s / m.alvo) * 100 + "%", cor: "#e2a24f" }] : [{ w: pct + "%", cor: "var(--accent)" }],
      contrib: [{ ...P.gustavo, nome: "Você", v: fmt(m.g), pct: m.tot ? Math.round((m.g / m.tot) * 100) + "%" : "0%", soft: "var(--solo-soft)" }, { ...P.suelen, v: fmt(m.s), pct: m.tot ? Math.round((m.s / m.tot) * 100) + "%" : "0%", soft: "var(--duo-soft)" }],
    };
  })() : null;

  const C = 2 * Math.PI * 70;
  const donut: { label: string; cor: string; pct: string; dash: string; off: string }[] = [];
  const prios: { label: string; cor: string; coberto: string; total: string; w: string; nota: string }[] = [];
  if (m) {
    let off = 0;
    let sobra = m.tot;
    ORDEM.forEach((p) => {
      const tot = ITENS.filter((i) => i.p === p).reduce((a, i) => a + i.v, 0);
      const cob = Math.min(tot, Math.max(0, sobra));
      sobra -= tot;
      const len = (tot / TOTAL_ITENS) * C;
      donut.push({ label: PRIO[p].label, cor: PRIO[p].cor, pct: Math.round((tot / TOTAL_ITENS) * 100) + "%", dash: len.toFixed(1) + " " + (C - len).toFixed(1), off: (-off).toFixed(1) });
      off += len;
      prios.push({ label: PRIO[p].label, cor: PRIO[p].cor, coberto: fmt(cob, false), total: fmt(tot, false), w: (cob / tot) * 100 + "%", nota: cob >= tot ? "Totalmente coberto" : cob > 0 ? Math.round((cob / tot) * 100) + "% coberto" : "Começa depois dos importantes" });
    });
  }
  // Evolução e linha do tempo saem do histórico de aportes da própria meta:
  // o que já estava guardado antes da janela entra como ponto de partida.
  const histMeta = detalhe?.hist ?? [];
  const porMesAporte = JANELA.slice(0, 7).map((chave) => {
    const doMes = histMeta.filter((h) => mesDoAporte(h.d) === chave);
    const g = doMes.filter((h) => h.quem !== "suelen").reduce((a, h) => a + h.v, 0);
    const sv = doMes.filter((h) => h.quem === "suelen").reduce((a, h) => a + h.v, 0);
    return { chave, g, s: sv };
  });
  const naJanela = porMesAporte.reduce((a, x) => a + x.g + x.s, 0);
  const inicio = Math.max(0, (m?.tot ?? 0) - naJanela);
  const real = porMesAporte.reduce<number[]>((acc, x) => [...acc, (acc.length ? acc[acc.length - 1] : inicio) + x.g + x.s], []);
  if (vazio) real.fill(0);
  const X = (i: number) => 44 + i * (584 / 13);
  // escala do gráfico acompanha o alvo da meta
  const escala = Math.max(1000, Math.ceil(((m?.alvo ?? 24000) * 1.08) / 1000) * 1000);
  const Y = (v: number) => 202 - (Math.min(v, escala) / escala) * 186;
  const pr = [real[6]];
  for (let i = 7; i <= 13; i++) pr.push(Math.min(m?.alvo ?? escala, pr[pr.length - 1] + (detalhe?.passo ?? 0)));
  const realD = real.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const prazoIdx = m?.prazo != null && m.prazo <= 7 ? 6 + m.prazo : null;
  const ch = {
    real: realD, area: realD + " L" + X(6).toFixed(1) + " 202 L44 202 Z",
    proj: pr.map((v, k) => (k ? "L" : "M") + X(6 + k).toFixed(1) + " " + Y(v).toFixed(1)).join(" "),
    metaY: Y(m?.alvo ?? 0).toFixed(1), prazoX: prazoIdx != null ? X(prazoIdx).toFixed(1) : null, hojeX: X(6).toFixed(1), hojeY: Y(real[6]).toFixed(1),
    grade: [0, Math.round(escala / 2000) * 1000, Math.floor(escala / 1000) * 1000].map((v) => ({ y: Y(v).toFixed(1), ty: (Y(v) + 4).toFixed(1), label: s.privado ? "••" : v ? v / 1000 + " mil" : "0" })),
    meses: JANELA.map((chave, i) => ({ x: X(i).toFixed(1), label: i % 2 === 0 || !cp ? MESES[Number(chave.slice(5)) - 1] : "" })),
  };
  const mxBar = Math.max(1, ...porMesAporte.map((x) => x.g + x.s));
  const linhaTempo = porMesAporte.map((x) => {
    const tot = x.g + x.s;
    return { mes: MESES[Number(x.chave.slice(5)) - 1], total: tot ? fmt(tot, false).replace("R$", "").trim() : "—", h: Math.max(tot ? 4 : 0, (tot / mxBar) * 100) + "%", fg: duo ? x.g : tot, fs: duo ? x.s : 0, corG: duo ? "#4e9e79" : "var(--accent)" };
  });

  // ---- modais --------------------------------------------------------------------------
  const md = s.modal;
  const fechar = () => up({ modal: null, ok: null });
  const cab = md && md !== "marco" ? ({ aporte: [m ? m.nome : "", "Novo aporte", "var(--faint)"], lazer: ["Lazer do casal", "Limite de lazer", "var(--duo-ink)"], editar: [m ? m.nome : "", "Editar meta", "var(--faint)"] } as Record<string, string[]>)[md] : null;
  const a = s.forms.aporte;
  const av = numBR(a.valor) > 0 ? numBR(a.valor) : 0;
  const apErr = s.tentou.aporte ? errosDe(s, "aporte") : {};
  let apNota = "";
  let apNotaCor = "var(--muted2)";
  let apBarras: { w: string; cor: string; op: string }[] = [];
  let antes = 0;
  let depois = 0;
  if (m) {
    antes = m.tot;
    depois = Math.min(m.alvo, m.tot + av);
    const quemS = duo && a.quem === "suelen";
    const w = (v: number) => (v / m.alvo) * 100 + "%";
    apBarras = duo
      ? [{ w: w(m.g), cor: "#4e9e79", op: "1" }, ...(quemS ? [] : [{ w: w(depois - m.tot), cor: "#4e9e79", op: ".45" }]), { w: w(m.s), cor: "#e2a24f", op: "1" }, ...(quemS ? [{ w: w(depois - m.tot), cor: "#e2a24f", op: ".45" }] : [])]
      : [{ w: w(m.tot), cor: "var(--accent)", op: "1" }, { w: w(depois - m.tot), cor: "var(--accent)", op: ".4" }];
    const pa = (antes / m.alvo) * 100;
    const pd = ((m.tot + av) / m.alvo) * 100;
    const cruza = [25, 50, 75, 100].filter((k) => pa < k && pd >= k).pop();
    apNota = !av ? "Digite um valor para ver como a meta fica." : cruza ? "Com esse aporte " + (duo ? "vocês passam" : "você passa") + " de " + cruza + "% da meta." : "A meta vai para " + pd.toFixed(1).replace(".", ",") + "%.";
    apNotaCor = cruza ? "var(--in-ink)" : "var(--muted2)";
  }
  const MC = ({
    25: ["Um quarto do caminho", duo ? "Vocês já guardaram 25% de “" + (m && m.nome) + "”. O começo costuma ser a parte mais difícil." : "Você já guardou 25% de “" + (m && m.nome) + "”. O começo costuma ser a parte mais difícil."],
    50: ["Metade do caminho", (duo ? "Vocês chegaram" : "Você chegou") + " a " + (m ? fmt(m.alvo / 2, false) : "") + " de " + (m ? fmt(m.alvo, false) : "") + ". Daqui pra frente, cada aporte aparece mais rápido na barra."],
    75: ["Falta só um quarto", "Faltam " + (m ? fmt(m.alvo * 0.25, false) : "") + ". No ritmo atual, " + (duo ? "vocês chegam" : "você chega") + " lá em poucos meses."],
    100: ["Meta concluída!", (duo ? "Vocês juntaram" : "Você juntou") + " " + (m ? fmt(m.alvo, false) : "") + ". Hora de comprar, ou de marcar a meta como realizada."],
  } as Record<number, string[]>)[s.marco] || ["", ""];
  const cores = ["#6f5cf0", "#4e9e79", "#e2a24f", "#f2a3ad", "#10a88f"];

  const salvarAporte = () => enviar("aporte", (st) => {
    const f = st.forms.aporte;
    const v = numBR(f.valor);
    const mm = metaDe(st);
    if (!mm) return;
    const pa = (mm.tot / mm.alvo) * 100;
    const pd = ((mm.tot + v) / mm.alvo) * 100;
    const cruza = [25, 50, 75, 100].filter((k) => pa < k && pd >= k).pop();
    const novo: AporteH = { d: dataBr(f.data), quem: duo ? f.quem : "gustavo", v, nota: f.nota.trim() };
    setS((p) => ({ ...p, aportes: { ...p.aportes, [mm.id]: [novo, ...(p.aportes[mm.id] ?? [])] } }));
    if (cruza) up({ modal: "marco", marco: cruza });
    else { up({ modal: null }); toast("Aporte de " + fmtDe(st)(v) + " registrado."); }
  });
  // O limite de lazer do casal é o orçamento de Lazer da conta Duo: o mesmo
  // número aparece em Categorias e dispara o aviso do sino.
  const salvarLazer = () => enviar("lazer", (st) => {
    const f = st.forms.lazer;
    salvarAjustes("duo", { orcamentos: { ...app.ajustes.orcamentos, Lazer: numBR(f.valor) }, lazerModo: f.modo, lazerPendente: true });
    up({ modal: null });
    toast("Limite proposto. Suelen recebeu um aviso para confirmar.");
  });
  const acertar = () => {
    if (sRef.current.enviando) return;
    const valor = dv.dev;
    up({ enviando: "acerto" });
    later(() => {
      const novo: Acerto = { id: Date.now(), mes: mesRef, data: HOJE, valor };
      salvarAcertos([...lerAcertos(), novo]);
      up({ enviando: null });
      toast("Acerto de " + fmt(Math.abs(valor)) + " registrado. Suelen recebeu um aviso.", {
        label: "Desfazer",
        onClick: () => salvarAcertos(lerAcertos().filter((x) => x.id !== novo.id)),
      });
    }, 500);
  };
  const abrirEditar = () => {
    if (!m) return;
    const prazo = m.prazo != null ? mesDaqui(m.prazo) : "";
    setS((p) => ({ ...p, modal: "editar", tentou: {}, forms: { ...p.forms, editar: { nome: m.nome, alvo: m.alvo.toLocaleString("pt-BR"), prazo } } }));
  };
  const salvarEdicao = () => enviar("editar", (st) => {
    const mm = metaDe(st);
    if (!mm) return;
    const f = st.forms.editar;
    const alvo = numBR(f.alvo);
    const meses = f.prazo ? mesesAte(f.prazo) : null;
    const mudanca: Partial<Meta> = { nome: f.nome.trim(), alvo, prazo: meses, ritmo: Math.max(300, Math.round((alvo - mm.tot) / (meses ?? 12))) };
    setS((p) => (mm.id.startsWith("n")
      ? { ...p, modal: null, criadas: p.criadas.map((x) => (x.id === mm.id ? { ...x, ...mudanca } : x)) }
      : { ...p, modal: null, edicoes: { ...p.edicoes, [mm.id]: { ...p.edicoes[mm.id], ...mudanca } } }));
    toast("Meta atualizada.");
  });
  const arquivar = () => {
    if (!m) return;
    const id = m.id;
    const nome = m.nome;
    setS((p) => ({ ...p, arquivadas: [...p.arquivadas, id] }));
    navigate("/metas");
    toast("“" + nome + "” foi arquivada.", { label: "Desfazer", onClick: () => setS((p) => ({ ...p, arquivadas: p.arquivadas.filter((x) => x !== id) })) });
  };

  const modalNode = md ? (
    <div onClick={fechar} style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "auto", display: "flex", alignItems: cp ? "flex-end" : "center", justifyContent: "center", padding: cp ? 0 : 24, background: "rgba(10,12,20,.46)", backdropFilter: "blur(3px)", animation: "mmFade .25s ease both" }}>
      <div role="dialog" aria-modal="true" aria-label={cab ? cab[1] : md === "marco" ? MC[0] : undefined} ref={caixaModal} className="mm-sai-card" onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 18, padding: 26, borderRadius: cp ? "26px 26px 0 0" : 26, background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 40px 80px -40px rgba(0,0,0,.6)", animation: "mmRise .35s cubic-bezier(.2,.8,.2,1) both" }}>
        {cab && (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...OLHO, color: cab[2] }}>{cab[0]}</span>
              <span style={{ fontFamily: SORA, fontSize: 23, fontWeight: 400, letterSpacing: "-.03em" }}>{cab[1]}</span>
            </div>
            <button type="button" title="Fechar" aria-label="Fechar" onClick={fechar} className="mm-h-sec" style={{ flex: "none", width: 36, height: 36, borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--muted)", display: "grid", placeItems: "center", cursor: "pointer" }}><Ic d="M6 6l12 12M18 6 6 18" size={16} sw={2} /></button>
          </div>
        )}

        {md === "editar" && (() => {
          const fe = { nome: campo("editar", "nome"), alvo: campo("editar", "alvo"), prazo: campo("editar", "prazo") };
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={ROTULO}>Nome da meta</span>
                <input value={fe.nome.v} onChange={fe.nome.on} style={campoSt(fe.nome.borda)} />
                {fe.nome.erro && <span style={ERRO_CAMPO}>{fe.nome.erro}</span>}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                  <span style={ROTULO}>Valor alvo</span>
                  <Moeda f={fe.alvo} />
                  {fe.alvo.erro && <span style={ERRO_CAMPO}>{fe.alvo.erro}</span>}
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                  <span style={ROTULO}>Prazo <span style={OPCIONAL}>· opcional</span></span>
                  <input type="month" value={fe.prazo.v} onChange={fe.prazo.on} style={campoSt(fe.prazo.borda)} />
                  {fe.prazo.erro && <span style={ERRO_CAMPO}>{fe.prazo.erro}</span>}
                </label>
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={fechar} style={btnSec({ flex: 1, padding: 0 })}>Cancelar</button>
                <BotaoEnvio env={s.enviando === "editar"} label="Salvar meta" labelEnv="Salvando…" onClick={salvarEdicao} style={{ flex: 1.4, padding: 0 }} />
              </div>
            </div>
          );
        })()}

        {md === "aporte" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {duo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={ROTULO}>Quem está aportando</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([["gustavo", "Você"], ["suelen", "Suelen"]] as const).map(([k, label]) => (
                    <Opcao key={k} on={a.quem === k} onClick={() => setForm("aporte", "quem", k)} style={{ height: 52, padding: "0 12px", borderRadius: 15, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar av={P[k].av} ini={P[k].ini} size={28} fs={11.5} />{label}
                    </Opcao>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                <span style={ROTULO}>Valor</span>
                <Moeda f={campo("aporte", "valor")} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                <span style={ROTULO}>Data</span>
                <input type="date" value={a.data} onChange={campo("aporte", "data").on} style={campoSt(campo("aporte", "data").borda, { padding: "0 12px", fontSize: 14 })} />
              </label>
            </div>
            {Object.values(apErr).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.values(apErr).map((e) => <span key={e} style={ERRO_CAMPO}>{e}</span>)}
              </div>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={ROTULO}>Nota <span style={OPCIONAL}>· opcional</span></span>
              <input value={a.nota} onChange={campo("aporte", "nota").on} placeholder="Ex.: Parte do 13º" style={campoSt("var(--line2)")} />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 18, background: "var(--line-soft)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Total da meta</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{fmt(antes, false)} → <strong style={{ fontFamily: SORA, fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>{fmt(depois, false)}</strong></span>
              </div>
              <Barra partes={apBarras} h={10} marcos={["25%", "50%", "75%"]} anim="width .4s ease" />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: apNotaCor, transition: "color .2s ease" }}>{apNota}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={fechar} style={btnSec({ flex: 1, padding: 0 })}>Cancelar</button>
              <BotaoEnvio env={s.enviando === "aporte"} label="Registrar aporte" labelEnv="Registrando…" onClick={salvarAporte} style={{ flex: 1.4, padding: 0 }} />
            </div>
          </div>
        )}

        {md === "lazer" && (() => {
          const fz = campo("lazer", "valor");
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={ROTULO}>Limite do mês</span>
                <Moeda f={fz} h={52} fs={18} pad="0 14px 0 42px" style={{ borderRadius: 15, fontFamily: SORA }} />
                {fz.erro && <span style={ERRO_CAMPO}>{fz.erro}</span>}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={ROTULO}>Como controlar</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 8 }}>
                  {([["juntos", "Um limite para os dois", "Qualquer um pode usar até o total combinado."], ["metade", "Metade para cada", "Cada um tem a sua parte e acompanha a do outro."]] as const).map(([k, label, desc]) => (
                    <Opcao key={k} on={s.forms.lazer.modo === k} onClick={() => setForm("lazer", "modo", k)} style={{ display: "flex", flexDirection: "column", gap: 5, padding: "13px 14px", borderRadius: 16, color: "var(--ink)", textAlign: "left" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</span>
                      <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--muted2)" }}>{desc}</span>
                    </Opcao>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 16, background: "var(--duo-soft)" }}>
                <div style={{ flex: "none", display: "flex" }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#4e9e79", boxShadow: "0 0 0 2px var(--surface)" }} />
                  <span style={{ width: 26, height: 26, marginLeft: -8, borderRadius: "50%", background: "#e2a24f", boxShadow: "0 0 0 2px var(--surface)" }} />
                </div>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink2)" }}>Suelen recebe um aviso para confirmar. Até lá, o limite aparece como proposto.</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={fechar} style={btnSec({ flex: 1, padding: 0 })}>Cancelar</button>
                <BotaoEnvio env={s.enviando === "lazer"} label="Propor limite" labelEnv="Enviando…" onClick={salvarLazer} style={{ flex: 1.4, padding: 0 }} />
              </div>
            </div>
          );
        })()}

        {md === "marco" && (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "6px 0 2px", textAlign: "center" }}>
            <div style={{ position: "absolute", inset: -26, pointerEvents: "none", overflow: "hidden" }}>
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} style={{ position: "absolute", top: 0, left: ((i * 37) % 100) + "%", width: 6 + (i % 3) * 2, height: 10 + (i % 4) * 2, borderRadius: 2, background: cores[i % cores.length], animation: `mmConf ${2.4 + (i % 5) * 0.35}s ${((i * 0.23) % 2.2).toFixed(2)}s ease-in infinite` }} />
              ))}
            </div>
            <div style={{ display: "flex", animation: "mmPop .6s cubic-bezier(.2,.8,.2,1) both" }}>
              {(duo ? [P.gustavo, P.suelen] : [P.gustavo]).map((g, i) => (
                <div key={g.nome} style={{ width: 118, marginLeft: i ? -26 : 0, transform: duo ? (i ? "rotate(6deg)" : "rotate(-6deg)") : "none" }}><Gato cor={g.cor} tabby={g.tabby} expressao="feliz" /></div>
              ))}
            </div>
            <span style={{ fontFamily: SORA, fontSize: 64, fontWeight: 300, letterSpacing: "-.05em", lineHeight: 1, color: "var(--accent-ink)", animation: "mmPop .7s .1s cubic-bezier(.2,.8,.2,1) both" }}>{s.marco}%</span>
            <span style={{ fontFamily: SORA, fontSize: 23, fontWeight: 400, letterSpacing: "-.03em" }}>{MC[0]}</span>
            <span style={{ maxWidth: 380, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{MC[1]}</span>
            <div style={{ display: "flex", alignItems: "center", margin: "6px 0" }}>
              {[25, 50, 75, 100].map((k, i) => {
                const on = k <= s.marco;
                return (
                  <span key={k} style={{ display: "contents" }}>
                    <span style={{ width: i ? 22 : 0, height: 3, background: on ? "var(--accent)" : "var(--line2)" }} />
                    <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: on ? "var(--accent)" : "var(--surface)", color: on ? "#ffffff" : "var(--faint)", border: `1.5px solid ${on ? "var(--accent)" : "var(--line2)"}`, fontSize: 10, fontWeight: 700, animation: on ? `mmPop .45s ${0.15 + i * 0.08}s cubic-bezier(.2,.8,.2,1) both` : undefined }}>{k}</span>
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={fechar} style={btnPrim({ height: 46, padding: "0 22px" })}>Ver meta</button>
              {duo && <button type="button" onClick={() => { up({ modal: null }); toast("Suelen recebeu a notícia."); }} style={btnSec({ height: 46 })}>Comemorar com Suelen</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  // Evolução e linha do tempo da meta (aportes reais): no detalhe de qualquer meta e em "Por prioridade".
  const graficosMeta = m && detalhe ? (
    <>
        <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={OLHO}>Evolução · real, projeção e meta</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 18, height: 3, borderRadius: 2, background: "var(--accent)" }} />Real</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 18, height: 0, borderTop: "2px dashed var(--accent)" }} />Projeção</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 18, height: 0, borderTop: "2px dashed var(--faint)" }} />Meta</span>
            </div>
          </div>
          <svg viewBox="0 0 640 230" width="100%" style={{ display: "block", overflow: "visible", maxWidth: 760, margin: "0 auto" }} role="img" aria-label="Evolução da meta: valor real, projeção e alvo">
            {ch.grade.map((gl) => (
              <g key={gl.y}>
                <line x1="44" x2="628" y1={gl.y} y2={gl.y} stroke="var(--line)" strokeWidth="1" />
                <text x="36" y={gl.ty} textAnchor="end" fontSize="11" fill="var(--faint)" fontFamily="Manrope, sans-serif">{gl.label}</text>
              </g>
            ))}
            <line x1="44" x2="628" y1={ch.metaY} y2={ch.metaY} stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="5 5" />
            {ch.prazoX && (
              <>
                <line x1={ch.prazoX} x2={ch.prazoX} y1="16" y2="202" stroke="var(--line2)" strokeWidth="1" strokeDasharray="3 4" />
                <text x={ch.prazoX} y="12" textAnchor="middle" fontSize="10.5" fill="var(--faint)" fontFamily="Manrope, sans-serif">prazo</text>
              </>
            )}
            <path d={ch.area} fill="var(--accent-soft)" style={{ animation: "mmFade .8s .2s ease both" }} />
            <path d={ch.real} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" style={{ animation: "mmTraco 1.1s cubic-bezier(.4,.7,.2,1) both" }} />
            <path d={ch.proj} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity=".75" style={{ animation: "mmFade .6s .9s ease both" }} />
            <circle cx={ch.hojeX} cy={ch.hojeY} r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" style={{ animation: "mmFade .3s 1s ease both" }} />
            {ch.meses.map((mx, i) => <text key={i} x={mx.x} y="222" textAnchor="middle" fontSize="11" fill="var(--faint)" fontFamily="Manrope, sans-serif">{mx.label}</text>)}
          </svg>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted2)" }}>{detalhe.ritmo}</span>
        </div>
        <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={OLHO}>Linha do tempo de aportes</span>
            {duo && (
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4e9e79" }} />Você</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e2a24f" }} />Suelen</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }}>
            {linhaTempo.map((lt, i) => (
              <div key={lt.mes} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{lt.total}</span>
                <div style={{ width: "100%", maxWidth: 44, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", height: lt.h, transformOrigin: "bottom", animation: `mmCresce .7s ${i * 0.06}s cubic-bezier(.22,.9,.18,1) both` }}>
                  <div style={{ flex: lt.fs, background: "#e2a24f" }} />
                  <div style={{ flex: lt.fg, background: lt.corG }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--faint)" }}>{lt.mes}</span>
              </div>
            ))}
          </div>
        </div>
    </>
  ) : null;

  const conteudo = (
    <>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "mmFade .3s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex" }}>
                  {(duo ? [P.gustavo, P.suelen] : [P.gustavo]).map((g) => <div key={g.nome} style={{ width: 64 }}><Gato cor={g.cor} tabby={g.tabby} expressao="atento" corpo={false} /></div>)}
                </div>
                <span style={{ fontSize: 14, color: "var(--muted2)" }}>{duo ? "Juntando os números de vocês…" : "Buscando seus números…"}</span>
              </div>
              <Skel h={130} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 18 }}>
                {[1, 2, 3].map((k) => <Skel key={k} h={200} />)}
              </div>
            </div>
          )}

          {t === "duo-geral" && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 30, ...TRANSICAO_PAGINA }}>
              {!vazio && !quites && !dv.vazio && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 14px 13px 18px", borderRadius: 18, border: "1px solid var(--duo-line)", background: "var(--duo-soft)", animation: "mmFade .4s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ flex: "none", width: 9, height: 9, borderRadius: "50%", background: "var(--duo)", animation: "mmPulse 2s ease-out infinite" }} />
                    <span style={{ fontSize: 14, lineHeight: 1.45, color: "var(--ink2)" }}><strong>{divStatus}</strong> nas despesas compartilhadas de {mesNome}.</span>
                  </div>
                  <button type="button" onClick={() => ir("duo-divisao")} className="mm-h-borda-duo" style={{ height: 38, padding: "0 14px", borderRadius: 12, border: "1px solid var(--duo-line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Ver divisão</button>
                </div>
              )}

              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 34, alignItems: "end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <span style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--faint)" }}>Conta conjunta · {rotuloMes(mesRef)}</span>
                  <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
                    <span style={{ fontFamily: SORA, fontSize: cp ? 44 : 60, fontWeight: 300, letterSpacing: "-.045em", lineHeight: 1 }}>{fmt(r.saldoConjunta)}</span>
                    {!vazio && (r.cIn || r.cOut) > 0 && (
                      <span style={{ marginBottom: 6, padding: "5px 11px", borderRadius: 999, border: `1px solid ${r.cIn >= r.cOut ? "var(--in-line)" : "var(--out-line)"}`, background: r.cIn >= r.cOut ? "var(--in-soft)" : "var(--out-soft)", color: r.cIn >= r.cOut ? "var(--in-ink)" : "var(--out-ink)", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {(r.cIn >= r.cOut ? "+ " : "− ") + fmt(Math.abs(r.cIn - r.cOut)) + " no mês"}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, maxWidth: 470, fontSize: 14.5, lineHeight: 1.65, color: "var(--muted2)", textWrap: "pretty" }}>
                    {geralVazio ? "A conta de vocês ainda está em silêncio. Registrem a primeira movimentação do mês." : fraseConj}
                  </p>
                  {geralVazio && <div><button type="button" onClick={abrirLanc} style={btnPrim({ height: 48 })}>Registrar a primeira movimentação</button></div>}
                  <div style={{ display: "flex", flexWrap: "wrap", columnGap: 30, rowGap: 14, marginTop: 8, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
                    {[{ k: "Entradas", v: fmt(r.cIn), cor: "var(--in-ink)" }, { k: "Saídas", v: fmt(r.cOut), cor: "var(--out)" }, { k: "Movimentações", v: String(movs.length), cor: "var(--ink)" }].map((st) => (
                      <div key={st.k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 11.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--faint)" }}>{st.k}</span>
                        <span style={{ fontFamily: SORA, fontSize: 21, color: st.cor }}>{st.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { ...P.gustavo, tag: "Você", soft: "var(--solo-soft)", ink: "var(--solo-ink)", exp: gExp, dados: r.gustavo, nota: r.gustavo.privados ? "Inclui " + r.gustavo.privados + (r.gustavo.privados === 1 ? " lançamento privado seu." : " lançamentos privados seus.") : "" },
                    { ...P.suelen, tag: "Parceira", soft: "var(--duo-soft)", ink: "var(--duo-ink)", exp: sExp, dados: r.suelen, nota: r.suelen.privados ? "Inclui " + r.suelen.privados + (r.suelen.privados === 1 ? " lançamento privado dela." : " lançamentos privados dela.") : "" },
                  ].map((p, i) => (
                    <div key={p.nome} style={{ position: "relative", paddingTop: 62, minWidth: 0, animation: `mmRise .6s ${0.08 + i * 0.07}s cubic-bezier(.2,.8,.2,1) both` }}>
                      <div style={{ position: "absolute", top: 0, left: "50%", width: 92, transform: "translateX(-50%)", pointerEvents: "none" }}><Gato cor={p.cor} tabby={p.tabby} expressao={p.exp} /></div>
                      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 11, padding: "18px 16px 16px", borderRadius: 22, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 40px -30px var(--shadow)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontFamily: SORA, fontSize: 15, fontWeight: 500 }}>{p.nome}</span>
                          <span style={{ padding: "3px 9px", borderRadius: 999, background: p.soft, color: p.ink, fontSize: 11, fontWeight: 700 }}>{p.tag}</span>
                        </div>
                        {[{ k: "Entrou", v: fmt(p.dados.entrou), cor: "var(--in-ink)" }, { k: "Gastou", v: fmt(p.dados.gastou), cor: "var(--ink)" }].map((ln) => (
                          <div key={ln.k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                            <span style={{ color: "var(--muted)" }}>{ln.k}</span>
                            <span style={{ fontWeight: 700, color: ln.cor, whiteSpace: "nowrap" }}>{ln.v}</span>
                          </div>
                        ))}
                        {p.nota && <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--faint)" }}>{p.nota}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 18, alignItems: "start" }}>
                <div style={{ ...CARTAO, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={OLHO}>Divisão de despesas</span>
                    <button type="button" onClick={() => ir("duo-divisao")} style={LINK_TEXTO}>Detalhes</button>
                  </div>
                  <span style={{ fontFamily: SORA, fontSize: 21, fontWeight: 400, letterSpacing: "-.02em", lineHeight: 1.3 }}>{divStatus}</span>
                  <Barra partes={[{ w: pctW(dv.pG, dv.tot), cor: "#4e9e79" }, { w: pctW(dv.pS, dv.tot), cor: "#e2a24f" }]} anim="width .6s ease" />
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--muted)" }}>
                    <span>Você pagou <strong style={{ color: "var(--ink)" }}>{fmt(dv.pG)}</strong></span>
                    <span>Suelen pagou <strong style={{ color: "var(--ink)" }}>{fmt(dv.pS)}</strong></span>
                  </div>
                </div>

                <div style={{ ...CARTAO, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={OLHO}>Lazer do casal</span>
                    <button type="button" onClick={abrirLazer} style={LINK_TEXTO}>{lim == null ? "Definir" : "Ajustar"}</button>
                  </div>
                  {lim != null ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontFamily: SORA, fontSize: 26, letterSpacing: "-.03em", color: lg + ls > lim ? "var(--out)" : undefined }}>{fmt(lg + ls)}</span>
                        <span style={{ fontSize: 13, color: "var(--muted2)" }}>de {fmt(lim, false)}</span>
                        {lazerPend && <span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--duo-soft)", color: "var(--duo-ink)", fontSize: 11, fontWeight: 700, animation: "mmFade .3s ease both" }}>Aguardando Suelen</span>}
                      </div>
                      <Barra partes={lazerModo === "metade"
                        ? [{ w: Math.min(50, (lg / lim) * 100) + "%", cor: "#4e9e79" }, { w: Math.max(0, 50 - Math.min(50, (lg / lim) * 100)) + "%", cor: "transparent" }, { w: Math.min(50, (ls / lim) * 100) + "%", cor: "#e2a24f" }]
                        : [{ w: Math.min(100, (lg / lim) * 100) + "%", cor: "#4e9e79" }, { w: Math.min(100 - Math.min(100, (lg / lim) * 100), (ls / lim) * 100) + "%", cor: "#e2a24f" }]} marcos={lazerModo === "metade" ? ["50%"] : undefined} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: "var(--muted)" }}>
                        {[{ nome: "Você", cor: "#4e9e79", v: fmt(lg) }, { nome: "Suelen", cor: "#e2a24f", v: fmt(ls) }].map((lp) => (
                          <span key={lp.nome} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: lp.cor }} />{lp.nome} <strong style={{ color: "var(--ink)" }}>{lp.v}</strong></span>
                        ))}
                      </div>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted2)" }}>
                        {lazerModo === "metade"
                          ? "Cada um tem " + fmt(lim / 2, false) + " no mês. " + (lg > lim / 2 ? "Você passou da sua metade." : ls > lim / 2 ? "Suelen passou da metade dela." : "Os dois estão dentro da parte de cada um.")
                          : lg + ls >= lim ? "O limite do mês foi atingido."
                            : "Restam " + fmt(lim - lg - ls) + (r.lazer.diasRestantes ? " para " + (r.lazer.diasRestantes === 1 ? "o último dia" : "os próximos " + r.lazer.diasRestantes + " dias") + "." : " no mês.")}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted2)", textWrap: "pretty" }}>Definam juntos quanto querem gastar com lazer no mês. O Mimo avisa os dois quando estiver perto do limite.</span>
                      <div><button type="button" onClick={abrirLazer} className="mm-h-sec" style={btnSec({ height: 42, padding: "0 16px", borderRadius: 13, fontSize: 13 })}>Definir limite</button></div>
                    </div>
                  )}
                </div>

                <div style={{ ...CARTAO, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                    <span style={OLHO}>Últimas movimentações</span>
                    <button type="button" onClick={() => ir("duo-movs")} style={LINK_TEXTO}>Ver todas</button>
                  </div>
                  {movs.slice(0, 5).map((it, i) => {
                    const rw = row(it);
                    const oculto = it.privado && it.quem === "suelen";
                    return (
                      <button key={it.id} type="button" onClick={() => app.actions.abrirEdicao(it.id)} className="mm-h-linha" title={oculto ? "Lançamento privado de Suelen" : "Editar movimentação"} style={{ ...LINHA, gap: 11, padding: "9px 0", border: "none", borderBottom: "1px solid var(--line-soft)", background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer", animation: `mmFade .4s ${0.05 * i}s ease both` }}>
                        <span title={rw.quemNome}><Avatar av={rw.av} ini={rw.ini} size={28} /></span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: oculto ? "italic" : undefined, color: oculto ? "var(--muted)" : undefined }}>{rw.desc}</span>
                        <span style={{ fontFamily: SORA, fontSize: 13, color: rw.cor, whiteSpace: "nowrap" }}>{rw.vFmt}</span>
                      </button>
                    );
                  })}
                  {geralVazio && (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0" }}>
                      <div style={{ flex: "none" }}><GatosDuplos w={58} ml={-14} exp="curioso" /></div>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted2)" }}>Ainda está em silêncio. O que um de vocês lançar aparece aqui para os dois.</span>
                    </div>
                  )}
                </div>
              </section>

              {!vazio && (() => {
                const mx = Math.max(1, ...r.porMes.map((x) => x.gustavo + x.suelen + x.conjunta));
                return (
                  <section style={{ ...CARTAO, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={OLHO}>Quem gastou o quê · últimos 6 meses</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "var(--muted)" }}>
                        {[["Você", "#4e9e79"], ["Suelen", "#e2a24f"], ["Conta conjunta", "var(--accent)"]].map(([k, cor]) => (
                          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: cor }} />{k}</span>
                        ))}
                      </div>
                    </div>
                    <div role="img" aria-label={"Saídas por pessoa nos últimos 6 meses: " + r.porMes.map((x) => x.label + " " + fmt(x.gustavo + x.suelen + x.conjunta, false)).join(", ")} style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 170 }}>
                      {r.porMes.map((x, i) => {
                        const tot = x.gustavo + x.suelen + x.conjunta;
                        const atual = x.chave === mesRef;
                        return (
                          <div key={x.chave} title={`${x.label}: você ${fmt(x.gustavo, false)} · Suelen ${fmt(x.suelen, false)} · conjunta ${fmt(x.conjunta, false)}`} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{tot ? fmt(tot, false).replace("R$", "").trim() : "—"}</span>
                            <div style={{ width: "100%", maxWidth: 46, height: Math.max(tot ? 4 : 0, (tot / mx) * 100) + "%", display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", transformOrigin: "bottom", animation: `mmCresce .7s ${i * 0.06}s cubic-bezier(.22,.9,.18,1) both`, outline: atual ? "2px solid var(--accent-line)" : undefined, outlineOffset: 2 }}>
                              <div style={{ flex: x.conjunta, background: "var(--accent)" }} />
                              <div style={{ flex: x.suelen, background: "#e2a24f" }} />
                              <div style={{ flex: x.gustavo, background: "#4e9e79" }} />
                            </div>
                            <span style={{ fontSize: 11, color: atual ? "var(--ink)" : "var(--faint)", fontWeight: atual ? 700 : 400 }}>{x.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}
            </div>
          )}

          {t === "duo-divisao" && (() => {
            const pagou = dv.dev > 0 ? "Você" : "Suelen";
            const divSub = dv.vazio ? "Quando um de vocês marcar uma despesa como dividida no formulário, ela aparece aqui e o Mimo calcula quem deve quanto."
              : quites ? "As despesas compartilhadas de " + mesNome + " estão divididas " + regraTxt + "."
                : "Você pagou " + fmt(dv.pG) + " e Suelen pagou " + fmt(dv.pS) + ". Pela regra " + regraTxt + ", sua parte é " + fmt(dv.justoG) + (dv.acertado ? ", já descontado o acerto de " + fmt(Math.abs(dv.acertado)) + "." : ".");
            const acertando = s.enviando === "acerto";
            const historico = [...acertos].sort((a, b) => (a.data < b.data ? 1 : -1));
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 22, ...TRANSICAO_PAGINA }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--faint)" }}>{rotuloMes(mesRef)} · despesas compartilhadas</span>
                  <h1 style={H1}>Divisão</h1>
                </div>
                <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 26, alignItems: "center", padding: 28, borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
                    <div style={{ width: 124 }}><Gato cor="#4e9e79" expressao={gExp} /></div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 40, color: quites || dv.vazio ? "var(--faint)" : "var(--duo)", transition: "color .3s ease" }}>
                      <svg width="38" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dv.dev < 0 && !quites ? "rotate(180deg)" : "none", transition: "transform .4s ease" }} aria-hidden="true"><path d={quites || dv.vazio ? "M5 9h14M5 15h14" : "M4 12h16M14 6l6 6-6 6"} /></svg>
                      <span style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--faint)" }}>{dv.vazio ? "sem despesas" : quites ? "quites" : pagou === "Você" ? "você → Suelen" : "Suelen → você"}</span>
                    </div>
                    <div style={{ width: 124 }}><Gato cor="#e2a24f" tabby expressao={sExp} /></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <span key={divStatus} style={{ fontFamily: SORA, fontSize: 30, fontWeight: 300, letterSpacing: "-.035em", lineHeight: 1.2, textWrap: "pretty", animation: "mmFade .35s ease both" }}>{divStatus}</span>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{divSub}</p>
                    {!dv.vazio && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Regra de divisão</span>
                        <div style={{ display: "inline-flex", alignSelf: "flex-start", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 14, background: "var(--line-soft)" }}>
                          {([["meio", "Meio a meio"], ["prop", "Proporcional à renda"]] as const).map(([k, label]) => (
                            <button key={k} type="button" aria-pressed={s.regra === k} onClick={() => up({ regra: k })} style={{ height: 36, padding: "0 14px", borderRadius: 11, border: "none", ...segmento(s.regra === k), fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                          ))}
                        </div>
                        {s.regra === "prop" && <span style={{ fontSize: 12, color: "var(--faint)" }}>{"Pela renda salva em Configurações: você " + fmt(app.ajustes.renda, false) + ", Suelen " + fmt(app.ajustes.rendaParceira, false) + "."}</span>}
                      </div>
                    )}
                    {!dv.vazio && !quites && (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                        <button type="button" onClick={acertar} style={btnPrim({ height: 46, padding: "0 18px", opacity: acertando ? 0.7 : 1 })}>
                          {acertando && <Spinner />}
                          {acertando ? "Registrando…" : dv.dev > 0 ? "Acertar " + fmt(abs) + " com Suelen" : "Registrar que Suelen pagou"}
                        </button>
                        <span style={{ fontSize: 12.5, color: "var(--faint)" }}>Registra um Pix entre vocês e zera o saldo. Dá para desfazer logo depois.</span>
                      </div>
                    )}
                  </div>
                </section>
                {!dv.vazio && (
                  <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "start" }}>
                    <div style={{ ...CARTAO, display: "flex", flexDirection: "column", gap: 18 }}>
                      <span style={OLHO}>Quem pagou o quê</span>
                      {[
                        { ...P.gustavo, nome: "Você", pago: fmt(dv.pG), justo: fmt(dv.justoG), w: pctW(dv.pG, dv.tot), justoPos: pctW(dv.justoG, dv.tot) },
                        { ...P.suelen, pago: fmt(dv.pS), justo: fmt(dv.justoS), w: pctW(dv.pS, dv.tot), justoPos: pctW(dv.justoS, dv.tot) },
                      ].map((dp) => (
                        <div key={dp.ini} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14, fontWeight: 700 }}><Avatar av={dp.av} ini={dp.ini} size={26} />{dp.nome}</span>
                            <span style={{ fontFamily: SORA, fontSize: 16 }}>{dp.pago}</span>
                          </div>
                          <div style={{ position: "relative", height: 8, borderRadius: 99, background: "var(--line-soft)" }}>
                            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: dp.w, borderRadius: 99, background: dp.av, transition: "width .5s ease" }} />
                            <div title="Parte justa" style={{ position: "absolute", top: -4, bottom: -4, left: dp.justoPos, width: 2, borderRadius: 2, background: "var(--ink)", transition: "left .5s ease" }} />
                          </div>
                          <span style={{ fontSize: 12, color: "var(--faint)" }}>Parte justa: {dp.justo}</span>
                        </div>
                      ))}
                      <span style={{ paddingTop: 14, borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--muted)" }}>Total compartilhado <strong style={{ color: "var(--ink)" }}>{fmt(dv.tot)}</strong></span>
                    </div>
                    <div style={{ ...CARTAO, display: "flex", flexDirection: "column" }}>
                      <span style={{ ...OLHO, marginBottom: 6 }}>Despesas marcadas como divididas</span>
                      {dv.lista.map((x) => {
                        const rw = row(x);
                        return (
                          <button key={x.id} type="button" onClick={() => app.actions.abrirEdicao(x.id)} className="mm-h-linha" style={{ ...LINHA, gap: 11, padding: "10px 0", border: "none", borderBottom: "1px solid var(--line-soft)", background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}>
                            <Avatar av={rw.av} ini={rw.ini} size={28} />
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rw.desc}</span>
                              <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{rw.data + " · pago por " + (x.quem === "suelen" ? "Suelen" : "você")}</span>
                            </div>
                            <span style={{ fontFamily: SORA, fontSize: 13.5, whiteSpace: "nowrap" }}>{rw.vFmt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
                <section style={{ ...CARTAO, display: "flex", flexDirection: "column" }}>
                  <span style={{ ...OLHO, marginBottom: 6 }}>Histórico de acertos</span>
                  {historico.map((h) => (
                    <div key={h.id} style={{ ...LINHA, gap: 11, padding: "10px 0" }}>
                      <span style={{ flex: "none", display: "flex" }}>
                        <Avatar av={h.valor > 0 ? P.gustavo.av : P.suelen.av} ini={h.valor > 0 ? "G" : "S"} size={26} fs={10.5} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{h.valor > 0 ? "Você pagou Suelen" : "Suelen pagou você"}</span>
                        <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{"Pix em " + dataBr(h.data) + " · despesas de " + rotuloMes(h.mes)}</span>
                      </div>
                      <span style={{ fontFamily: SORA, fontSize: 13.5, color: "var(--in-ink)", whiteSpace: "nowrap" }}>{fmt(Math.abs(h.valor))}</span>
                    </div>
                  ))}
                  {!historico.length && <span style={{ padding: "8px 0", fontSize: 13, lineHeight: 1.5, color: "var(--muted2)" }}>Nenhum acerto ainda. Quando vocês acertarem a divisão, o Pix aparece aqui.</span>}
                </section>
              </div>
            );
          })()}

          {t === "metas" && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, ...TRANSICAO_PAGINA }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: duo ? "var(--duo-ink)" : "var(--solo-ink)" }}>{duo ? "Metas do casal · Gustavo e Suelen" : "Suas metas"}</span>
                  <h1 style={H1}>Metas</h1>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="button" onClick={irCatalogo} className="mm-h-sec" style={btnSec({ height: 46, padding: "0 16px", fontSize: 13.5 })}>Escolher do catálogo</button>
                  <button type="button" onClick={() => irNova()} style={btnPrim({ height: 46, padding: "0 18px", fontSize: 13.5 })}>+ Nova meta</button>
                </div>
              </div>
              {metas.length > 0 ? (
                <div style={{ position: "relative" }}>
                {/* rabo do gato saindo por trás dos cartões, como na visão geral do painel */}
                <div className="mm-rabo-metas" aria-hidden="true">
                  <svg viewBox="0 0 200 150" width="100%" style={{ overflow: "visible" }}><use href="#mimo-rabo" /></svg>
                </div>
                <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 256px), 1fr))", gap: 18 }}>
                  {metas.map((mt, i) => (
                    <button key={mt.id} type="button" onClick={() => ir("meta-detalhe", { metaSel: mt.id })} className="mm-h-card" style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20, borderRadius: 24, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", textAlign: "left", cursor: "pointer", boxShadow: "0 18px 44px -32px var(--shadow)", animation: `mmRise .55s ${0.05 * i}s cubic-bezier(.2,.8,.2,1) both` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-ink)" }}><Ic d={ICON[mt.ic] || ICON.produto} size={21} sw={1.7} /></span>
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>{mt.prazo != null ? "até " + mesLabel(mt.prazo).replace(" de ", "/").replace(/^(\p{L}{3})\p{L}*/u, "$1") : "sem prazo"}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{mt.nome}</span>
                        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontFamily: SORA, fontSize: 23, letterSpacing: "-.03em" }}>{fmt(mt.tot, false)}</span>
                          <span style={{ fontSize: 12.5, color: "var(--muted2)" }}>de {fmt(mt.alvo, false)}</span>
                        </div>
                      </div>
                      <Barra partes={barrasM(mt)} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                        <span style={{ fontWeight: 700 }}>{Math.floor(pctM(mt))}%</span>
                        {duo && (
                          <div style={{ display: "flex", gap: 10, color: "var(--muted)" }}>
                            {[{ av: "#4e9e79", v: fmt(mt.g, false) }, { av: "#e2a24f", v: fmt(mt.s, false) }].map((cc) => (
                              <span key={cc.av} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: cc.av }} />{cc.v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  <button type="button" onClick={() => irNova()} className="mm-h-tracejado" style={{ minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 24, border: "1.5px dashed var(--line2)", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", animation: `mmRise .55s ${0.05 * metas.length}s cubic-bezier(.2,.8,.2,1) both` }}>
                    <span style={{ fontSize: 26, fontWeight: 300, lineHeight: 1 }}>+</span>Nova meta
                  </button>
                </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "44px 20px", borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center" }}>
                  <div style={{ display: "flex" }}>
                    {gatosPlano.map((g) => <div key={g.nome} style={{ width: 116, marginLeft: g.ml }}><Gato cor={g.cor} tabby={g.tabby} expressao="curioso" /></div>)}
                  </div>
                  <span style={{ fontFamily: SORA, fontSize: 22, fontWeight: 300, letterSpacing: "-.02em" }}>{duo ? "Qual é o primeiro sonho de vocês?" : "Qual é a sua primeira meta?"}</span>
                  <span style={{ maxWidth: 400, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{duo ? "Criem uma meta juntos e acompanhem quanto cada um está guardando. Comece por uma sugestão ou do zero." : "Crie uma meta e acompanhe quanto falta. Comece por uma sugestão ou do zero."}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 4 }}>
                    {(duo ? [["Casa nova", "casa"], ["Casamento", "anel"], ["Viagem", "viagem"], ["Reserva de emergência", "escudo"]] : [["Casa própria", "casa"], ["Viagem", "viagem"], ["Carro", "carro"], ["Reserva de emergência", "escudo"]]).map(([label, ic]) => (
                      <button key={label} type="button" onClick={() => irNova({ nome: label, ic })} className="mm-h-sec" style={{ height: 40, padding: "0 14px", borderRadius: 999, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink2)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}><Ic d={ICON[ic]} size={15} />{label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(t === "meta-nova" || t === "meta-catalogo") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, ...TRANSICAO_PAGINA }}>
              <button type="button" onClick={() => ir("metas")} style={VOLTAR}>← Metas</button>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <h1 style={H1}>Nova meta</h1>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)" }}>{t === "meta-catalogo" ? "Escolha um produto e use o preço de referência como alvo." : duo ? "Definam quanto querem juntar e, se quiserem, até quando." : "Defina quanto quer juntar e, se quiser, até quando."}</p>
              </div>
              {!s.ok && (
                <div style={{ display: "inline-flex", alignSelf: "flex-start", gap: 4, padding: 4, borderRadius: 14, background: "var(--line-soft)" }}>
                  {([["manual", "Valor manual", ""], ["catalogo", "Do catálogo", "V2"]] as const).map(([k, label, tag]) => {
                    const on = k === "catalogo" ? t === "meta-catalogo" : t === "meta-nova";
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => { up({ aba: k }); navigate(k === "catalogo" ? "/metas/catalogo" : "/metas/nova", { replace: true }); }} style={{ height: 38, padding: "0 14px", borderRadius: 11, border: "none", ...segmento(on), fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {label}{tag && <span style={{ padding: "2px 7px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5 }}>{tag}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {!s.ok && t === "meta-nova" && (
                <div key="manual" style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 20, padding: 26, borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)", animation: "mmFade .3s ease both" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <span style={ROTULO}>Nome da meta</span>
                    <input value={fm.nome.v} onChange={fm.nome.on} placeholder="Ex.: Viagem para Salvador" style={campoSt(fm.nome.borda)} />
                    {fm.nome.erro && <span style={ERRO_CAMPO}>{fm.nome.erro}</span>}
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={ROTULO}>Ícone</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[["casa", "Casa"], ["viagem", "Viagem"], ["anel", "Casamento"], ["reforma", "Reforma"], ["carro", "Carro"], ["escudo", "Reserva"]].map(([k, label]) => (
                        <Opcao key={k} on={s.forms.meta.ic === k} onClick={() => setForm("meta", "ic", k)} style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center" }}>
                          <span title={label} style={{ display: "grid" }}><Ic d={ICON[k]} size={20} sw={1.7} /></span>
                        </Opcao>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={ROTULO}>Valor alvo</span>
                      <Moeda f={fm.alvo} pad="0 14px 0 42px" />
                      {fm.alvo.erro && <span style={ERRO_CAMPO}>{fm.alvo.erro}</span>}
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={ROTULO}>Prazo <span style={OPCIONAL}>· opcional</span></span>
                      <input type="month" value={fm.prazo.v} onChange={fm.prazo.on} style={campoSt(fm.prazo.borda)} />
                      {fm.prazo.erro && <span style={ERRO_CAMPO}>{fm.prazo.erro}</span>}
                    </label>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={ROTULO}>Já guardado <span style={OPCIONAL}>· opcional</span></span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
                      {(duo ? [{ ...P.gustavo, f: fm.inicial, ph: "Você" }, { ...P.suelen, f: { ...fm.inicialS, borda: fm.inicial.borda }, ph: "Suelen" }] : [{ ...P.gustavo, f: fm.inicial, ph: "0,00" }]).map((ic) => (
                        <div key={ic.ini} style={{ position: "relative" }}>
                          <Avatar av={ic.av} ini={ic.ini} size={24} fs={10.5} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                          <input inputMode="decimal" value={ic.f.v} onChange={ic.f.on} placeholder={ic.ph} style={campoSt(ic.f.borda, { padding: "0 14px 0 46px" })} />
                        </div>
                      ))}
                    </div>
                    {fm.inicial.erro && <span style={ERRO_CAMPO}>{fm.inicial.erro}</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, paddingTop: 6 }}>
                    <button type="button" onClick={() => ir("metas")} style={btnSec()}>Cancelar</button>
                    <BotaoEnvio env={s.enviando === "meta"} label="Criar meta" labelEnv="Criando…" style={{ minWidth: 150 }} onClick={() => enviar("meta", (st) => {
                      const f = st.forms.meta;
                      setS((p) => ({ ...p, ok: "meta", criadas: [...p.criadas, salvarMeta(f.nome.trim(), f.ic, numBR(f.alvo), numBR(f.inicial) || 0, duo ? numBR(f.inicialS) || 0 : 0, f.prazo)] }));
                    })} />
                  </div>
                </div>
              )}

              {!s.ok && t === "meta-catalogo" && (
                <div key="catalogo" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18, alignItems: "start", animation: "mmFade .3s ease both" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 22, borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)" }}>
                    <div style={{ position: "relative" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
                      <input aria-label="Buscar produto" value={c.q} onChange={(e) => catBuscar(e.target.value)} placeholder="Produto, marca ou modelo" style={campoSt("var(--line2)", { height: 50, padding: "0 14px 0 44px", borderRadius: 15 })} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["Geladeira", "Fogão", "Máquina de lavar", "Sofá", "Smart TV", "Notebook"].map((label) => (
                        <Opcao key={label} on={q === label.toLowerCase()} onClick={() => setS((p) => ({ ...p, forms: { ...p.forms, cat: { ...p.forms.cat, q: label.toLowerCase(), sel: null } } }))} style={{ height: 34, padding: "0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600 }}>{label}</Opcao>
                      ))}
                    </div>
                    {s.buscando && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--muted2)" }}>
                          <div style={{ width: 52 }}><Gato cor="#4e9e79" expressao="atento" corpo={false} /></div>
                          Procurando nas lojas…
                        </div>
                        {[1, 2, 3].map((k) => <Skel key={k} h={64} r={16} />)}
                      </div>
                    )}
                    {!s.buscando && !q && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>Busque o que {duo ? "vocês" : "você"} quer comprar. O preço de referência é a média das principais lojas e é atualizado todo mês.</p>}
                    {!s.buscando && !!q && !res.length && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "18px 8px", textAlign: "center", animation: "mmFade .3s ease both" }}>
                        <div style={{ width: 96 }}><Gato cor="#4e9e79" expressao="preocupado" corpo={false} /></div>
                        <span style={{ fontFamily: SORA, fontSize: 17 }}>Não achamos “{c.q}”</span>
                        <span style={{ maxWidth: 320, fontSize: 13, lineHeight: 1.55, color: "var(--muted2)" }}>Confira o nome do modelo ou busque só pela marca. Se o produto não estiver no catálogo, dá para criar a meta com valor manual.</span>
                        <button type="button" onClick={() => { up({ aba: "manual" }); navigate("/metas/nova", { replace: true }); }} className="mm-h-sec" style={btnSec({ height: 40, padding: "0 14px", borderRadius: 12, fontSize: 13 })}>Criar com valor manual</button>
                      </div>
                    )}
                    {!s.buscando && res.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>{res.length + (res.length === 1 ? " resultado" : " resultados") + " · preço médio de referência"}</span>
                        {res.map((it, i) => {
                          const on = it.id === c.sel;
                          return (
                            <button key={it.id} type="button" aria-pressed={on} onClick={() => setForm("cat", "sel", it.id)} className={on ? undefined : "mm-h-sec"} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, border: `1px solid ${on ? "var(--accent-line)" : "var(--line)"}`, background: on ? "var(--accent-soft)" : "var(--surface)", color: "var(--ink)", textAlign: "left", cursor: "pointer", animation: `mmRise .4s ${i * 0.04}s cubic-bezier(.2,.8,.2,1) both` }}>
                              <span style={{ flex: "none", width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--line-soft)", color: "var(--muted)" }}><Ic d={ICON.produto} size={19} sw={1.6} /></span>
                              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.marca} {it.modelo}</span>
                                <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{it.cat} · <span style={{ color: it.vr < 0 ? "var(--in-ink)" : "var(--out-ink)" }}>{varLbl(it.vr)}</span></span>
                              </span>
                              <span style={{ fontFamily: SORA, fontSize: 14, whiteSpace: "nowrap" }}>{fmt(it.preco, false)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 22, borderRadius: 26, border: `1px solid ${catErrs.sel ? "var(--out-line)" : "var(--line)"}`, background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)", transition: "border-color .2s ease" }}>
                    {sel && spark ? (
                      <div key={sel.id} style={{ display: "flex", flexDirection: "column", gap: 16, animation: "mmFade .3s ease both" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={OLHO}>{sel.cat} · {sel.marca}</span>
                          <span style={{ fontFamily: SORA, fontSize: 20, letterSpacing: "-.02em", lineHeight: 1.3 }}>{sel.modelo}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
                          <span style={{ fontFamily: SORA, fontSize: 32, fontWeight: 300, letterSpacing: "-.035em" }}>{fmt(sel.preco)}</span>
                          <span style={{ padding: "3px 9px", borderRadius: 999, background: sel.vr < 0 ? "var(--in-soft)" : "var(--out-soft)", color: sel.vr < 0 ? "var(--in-ink)" : "var(--out-ink)", fontSize: 11.5, fontWeight: 700 }}>{varLbl(sel.vr)}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <svg viewBox="0 0 300 70" width="100%" height="70" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }} aria-hidden="true">
                            <path d={spark.area} fill="var(--accent-soft)" style={{ animation: "mmFade .6s ease both" }} />
                            <path d={spark.linha} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                          </svg>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--faint)" }}>{[5, 4, 3, 2, 1, 0].map((k) => { const x = MESES[Number(mesDaqui(-k).slice(5)) - 1]; return <span key={k}>{x}</span>; })}</div>
                          <span style={{ fontSize: 11.5, color: "var(--faint)" }}>Média de 6 lojas · atualizado em {dataBr(MES_REF + "-01")}</span>
                        </div>
                        <button type="button" aria-pressed={c.auto} onClick={() => setForm("cat", "auto", !c.auto)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 14, borderRadius: 16, border: "1px solid var(--line2)", background: "var(--field)", color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Atualizar o alvo todo mês</span>
                            <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--muted2)" }}>O valor da meta acompanha o preço de referência.</span>
                          </span>
                          <Chave on={c.auto} />
                        </button>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12 }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            <span style={ROTULO}>Prazo <span style={OPCIONAL}>· opcional</span></span>
                            <input type="month" value={c.prazo} onChange={campo("cat", "prazo").on} style={campoSt(campo("cat", "prazo").borda, { height: 46, padding: "0 12px", fontSize: 14 })} />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            <span style={ROTULO}>Já guardado</span>
                            <input inputMode="decimal" value={c.inicial} onChange={campo("cat", "inicial").on} placeholder="R$ 0,00" style={campoSt(campo("cat", "inicial").borda, { height: 46, padding: "0 12px", fontSize: 14 })} />
                          </label>
                        </div>
                        {(catErrs.inicial || catErrs.prazo) && <span style={ERRO_CAMPO}>{catErrs.inicial || catErrs.prazo}</span>}
                        <BotaoEnvio env={s.enviando === "cat"} label={"Criar meta com " + fmt(sel.preco, false)} labelEnv="Criando…" style={{ height: 50, borderRadius: 16 }} onClick={() => enviar("cat", (st) => {
                          const it = CATALOGO.find((x) => x.id === st.forms.cat.sel);
                          if (!it) return;
                          setS((p) => ({ ...p, ok: "cat", criadas: [...p.criadas, salvarMeta(it.cat + " " + it.marca, "produto", it.preco, numBR(p.forms.cat.inicial) || 0, 0, p.forms.cat.prazo)] }));
                        })} />
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "26px 10px", textAlign: "center" }}>
                        <div style={{ width: 110 }}><Gato cor="#4e9e79" expressao="curioso" /></div>
                        <span style={{ maxWidth: 300, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted2)" }}>Escolha um produto para ver o preço de referência e como ele variou nos últimos 6 meses.</span>
                        {catErrs.sel && <span style={ERRO_CAMPO}>{catErrs.sel}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {criarOk && (
                <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "34px 26px 28px", borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center", boxShadow: "0 18px 44px -30px var(--shadow)", animation: "mmRise .5s ease both" }}>
                  <div style={{ display: "flex", animation: "mmPop .6s cubic-bezier(.2,.8,.2,1) both" }}>
                    {gatosPlano.map((g) => <div key={g.nome} style={{ width: 116, marginLeft: g.ml }}><Gato cor={g.cor} tabby={g.tabby} expressao="feliz" /></div>)}
                  </div>
                  <span style={{ fontFamily: SORA, fontSize: 26, fontWeight: 300, letterSpacing: "-.03em" }}>Meta criada</span>
                  <span style={{ maxWidth: 400, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{criarOkTexto}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 6 }}>
                    <button type="button" onClick={() => ir("metas")} style={btnPrim({ height: 46, padding: "0 18px" })}>Ver metas</button>
                    <button type="button" onClick={() => setS((p) => ({ ...p, ok: null, tentou: {}, forms: { ...p.forms, meta: { ...VAZIO.meta }, cat: { ...VAZIO.cat } } }))} className="mm-h-sec" style={btnSec({ height: 46 })}>Criar outra</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {t === "meta-detalhe" && m && detalhe && (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 20, ...TRANSICAO_PAGINA }}>
              <button type="button" onClick={() => ir("metas")} style={VOLTAR}>← Metas</button>
              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 18, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: 26, borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ flex: "none", width: 48, height: 48, borderRadius: 15, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-ink)" }}><Ic d={ICON[m.ic] || ICON.produto} size={22} sw={1.7} /></span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ ...OLHO, color: duo ? "var(--duo-ink)" : "var(--solo-ink)" }}>{duo ? "Meta do casal" : "Meta pessoal"}</span>
                        <h1 style={{ margin: 0, fontFamily: SORA, fontSize: 26, fontWeight: 400, letterSpacing: "-.03em" }}>{m.nome}</h1>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
                      <span style={{ fontFamily: SORA, fontSize: 44, fontWeight: 300, letterSpacing: "-.045em", lineHeight: 1 }}>{detalhe.guardado}</span>
                      <span style={{ fontSize: 14, color: "var(--muted2)" }}>de {detalhe.alvo}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Barra partes={detalhe.barras} h={12} marcos={["25%", "50%", "75%"]} anim="width .8s cubic-bezier(.22,.9,.18,1)" />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                        <span style={{ fontWeight: 700 }}>{detalhe.pctTxt}</span>
                        <span style={{ color: "var(--faint)" }}>{detalhe.faltaTxt}</span>
                      </div>
                    </div>
                    {duo && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {detalhe.contrib.map((cc) => (
                          <div key={cc.ini} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, background: cc.soft }}>
                            <Avatar av={cc.av} ini={cc.ini} size={30} fs={12} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>{cc.nome} · {cc.pct}</span>
                              <span style={{ fontFamily: SORA, fontSize: 16, whiteSpace: "nowrap" }}>{cc.v}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{detalhe.ritmo}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      <button type="button" onClick={abrirAporte} style={btnPrim()}>+ Adicionar aporte</button>
                      <button type="button" onClick={abrirEditar} className="mm-h-sec" style={btnSec()}>Editar</button>
                      <button type="button" onClick={arquivar} className="mm-h-sec" style={btnSec({ color: "var(--muted)" })}>Arquivar</button>
                      {detalhe.itensC.length > 0 && <button type="button" onClick={() => ir("meta-prioridade")} className="mm-h-sec" style={btnSec()}>Ver por prioridade</button>}
                    </div>
                  </div>
                  <div style={{ ...CARTAO, display: "flex", flexDirection: "column" }}>
                    <span style={{ ...OLHO, marginBottom: 6 }}>Histórico de aportes</span>
                    {detalhe.hist.map((h, i) => (
                      <div key={h.d + h.v + i} style={{ ...LINHA, gap: 11, padding: "11px 0", animation: `mmFade .35s ${i * 0.04}s ease both` }}>
                        <Avatar av={P[h.quem].av} ini={P[h.quem].ini} size={30} fs={11.5} />
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.nota || "Aporte"}</span>
                          <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{h.d + (duo ? " · " + (h.quem === "suelen" ? "Suelen" : "você") : "")}</span>
                        </div>
                        <span style={{ fontFamily: SORA, fontSize: 14, color: "var(--in-ink)", whiteSpace: "nowrap" }}>{"+ " + fmt(h.v)}</span>
                      </div>
                    ))}
                    {!detalhe.hist.length && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                        <div style={{ flex: "none", width: 60 }}><Gato cor="#4e9e79" expressao="curioso" corpo={false} /></div>
                        <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted2)" }}>{duo ? "Nenhum aporte ainda. O primeiro, de qualquer um dos dois, já faz a barra andar." : "Nenhum aporte ainda. O primeiro já faz a barra andar."}</span>
                      </div>
                    )}
                  </div>
                </div>

                {detalhe.itensC.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, border: `1px solid ${detalhe.maior ? "var(--solo-line)" : "var(--line)"}`, background: detalhe.maior ? "var(--solo-soft)" : "var(--surface)" }}>
                      <div style={{ flex: "none", display: "flex" }}>
                        {(duo ? [P.gustavo, P.suelen] : [P.gustavo]).map((g, i) => <div key={g.nome} style={{ width: 74, marginLeft: i ? -18 : 0 }}><Gato cor={g.cor} tabby={g.tabby} expressao={detalhe.maior ? "feliz" : "curioso"} corpo={false} /></div>)}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                        <span style={OLHO}>O que já dá pra comprar</span>
                        <span style={{ fontFamily: SORA, fontSize: 19, letterSpacing: "-.02em", lineHeight: 1.3, textWrap: "pretty" }}>{detalhe.compraTitulo}</span>
                        <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted2)", textWrap: "pretty" }}>{detalhe.compraSub}</span>
                      </div>
                    </div>
                    <div style={{ ...CARTAO, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                        <span style={OLHO}>Itens da meta</span>
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>{detalhe.okList.length + " de " + detalhe.itensC.length + " cobertos"}</span>
                      </div>
                      {detalhe.itensC.map((it, i) => (
                        <div key={it.nome} style={{ ...LINHA, gap: 12, padding: "10px 0" }}>
                          <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", border: `1.5px solid ${it.ok ? "var(--in)" : "var(--line2)"}`, background: it.ok ? "var(--in)" : "transparent", color: "#ffffff", animation: it.ok ? `mmPop .4s ${0.1 + i * 0.05}s cubic-bezier(.2,.8,.2,1) both` : undefined }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity={it.ok ? 1 : 0} aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                          </span>
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: it.ok ? "var(--ink)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.nome}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--faint)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: PRIO[it.p].cor }} />{PRIO[it.p].label}</span>
                          </div>
                          <span style={{ fontFamily: SORA, fontSize: 13.5, whiteSpace: "nowrap" }}>{fmt(it.v, false)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              {graficosMeta}
            </div>
          )}

          {t === "meta-prioridade" && m && detalhe && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, ...TRANSICAO_PAGINA }}>
              <button type="button" onClick={() => ir("meta-detalhe")} style={VOLTAR}>← {m.nome}</button>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ alignSelf: "flex-start", padding: "4px 10px", borderRadius: 999, border: "1px dashed var(--accent-line)", color: "var(--accent-ink)", fontSize: 11.5, fontWeight: 700 }}>Conceito · V2/V3</span>
                <h1 style={H1}>Progresso por prioridade</h1>
                <p style={{ margin: 0, maxWidth: 620, fontSize: 14, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>O valor guardado cobre primeiro os itens essenciais, depois os importantes e por último os de conforto.</p>
              </div>
              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 18, alignItems: "stretch" }}>
                <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  <span style={OLHO}>Coberto por prioridade</span>
                  {prios.map((p, i) => (
                    <div key={p.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</span>
                        <span style={{ fontSize: 12.5, color: "var(--muted)" }}><strong style={{ color: "var(--ink)" }}>{p.coberto}</strong> de {p.total}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 99, overflow: "hidden", background: "var(--line-soft)" }}>
                        <div style={{ width: p.w, height: "100%", borderRadius: 99, background: p.cor, transformOrigin: "left", animation: `mGrowX .9s ${0.15 + i * 0.12}s cubic-bezier(.22,.9,.18,1) both` }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--faint)" }}>{p.nota}</span>
                    </div>
                  ))}
                </div>
                <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  <span style={OLHO}>Divisão do alvo</span>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 26 }}>
                    <div style={{ position: "relative", width: 180, height: 180 }}>
                      <svg viewBox="0 0 180 180" width="180" height="180" style={{ display: "block", transform: "rotate(-90deg)" }} aria-hidden="true">
                        <circle cx="90" cy="90" r="70" fill="none" stroke="var(--line-soft)" strokeWidth="22" />
                        {donut.map((d, i) => <circle key={d.label} cx="90" cy="90" r="70" fill="none" stroke={d.cor} strokeWidth="22" strokeDasharray={d.dash} strokeDashoffset={d.off} style={{ animation: `mmFade .5s ${0.1 + i * 0.12}s ease both` }} />)}
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                        <span style={{ fontFamily: SORA, fontSize: 20 }}>{detalhe.alvo}</span>
                        <span style={{ fontSize: 11, color: "var(--faint)" }}>alvo total</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {donut.map((d) => (
                        <span key={d.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: d.cor }} /><strong>{d.label}</strong><span style={{ color: "var(--muted)" }}>{d.pct}</span></span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              {graficosMeta}
            </div>
          )}
    </>
  );

  // ---- moldura comum: Topbar do Solo, painel lateral e dock da conta ativa ----------
  // filtro por autor: mesmos botões da tela antiga de movimentações do Duo
  const FIL: ["todos" | Autor, string, string, string][] = [["todos", "Todos", P.conjunta.av, ""], ["gustavo", "Eu", P.gustavo.av, "G"], ["suelen", "Suelen", P.suelen.av, "S"], ["conjunta", "Conta conjunta", P.conjunta.av, ""]];
  const itensDuo = app.state.itens;
  const filtrosQuem = (
    <div data-mimo="app" data-tema={tema} style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "-12px 0 26px", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      {FIL.map(([k, label, avc, ini]) => {
        const on = app.state.quemFiltro === k;
        const o = opcao(on);
        return (
          <button key={k} type="button" aria-pressed={on} onClick={() => app.actions.setFiltro({ quemFiltro: k })} style={{ height: 40, padding: "0 14px 0 8px", borderRadius: 999, border: `1px solid ${o.borda}`, background: o.bg, color: o.cor, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Avatar av={avc} ini={ini} size={24} fs={10.5} />
            {label}
            <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{k === "todos" ? itensDuo.length : itensDuo.filter((x) => x.quem === k).length}</span>
          </button>
        );
      })}
    </div>
  );
  const colunaQuem = {
    titulo: "Quem",
    celula: (it: Item) => {
      const p = P[it.quem ?? "conjunta"];
      return <><Avatar av={p.av} ini={p.ini} size={24} fs={10.5} />{p.nome}</>;
    },
  };  const destino: DestinoDock = t === "duo-geral" || t === "duo-movs" || t === "duo-divisao" ? t : "metas";
  const navegar = (d: DestinoDock) => {
    if (d === "duo-geral" || d === "duo-movs" || d === "duo-divisao" || d === "metas") { ir(d); return true; }
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
    >
      {t === "duo-movs" ? (
        <ViewLista
          filtrosExtras={filtrosQuem}
          colunaExtra={colunaQuem}
          derivado={app.derivado}
          itensTotal={app.state.itens.length}
          tipoFiltro={app.state.tipoFiltro}
          statusFiltro={app.state.statusFiltro}
          query={app.state.query}
          fmt={app.fmt}
          onQuery={app.actions.setBusca}
          onFiltroTipo={(tipoFiltro) => app.actions.setFiltro({ tipoFiltro })}
          onFiltroStatus={(statusFiltro) => app.actions.setFiltro({ statusFiltro })}
          onEditar={app.actions.abrirEdicao}
          onExcluir={app.actions.pedirExclusao}
          onPaginaAnterior={app.actions.paginaAnterior}
          onPaginaProxima={app.actions.paginaProxima}
          categoriaFiltro={app.state.categoriaFiltro}
          cartaoFiltro={app.state.cartaoFiltro}
          categorias={categoriasDe(app.ajustes)}
          onFiltroCategoria={(categoriaFiltro) => app.actions.setFiltro({ categoriaFiltro })}
          onFiltroCartao={(cartaoFiltro) => app.actions.setFiltro({ cartaoFiltro })}
          onMarcarPagas={(ids) => { app.actions.marcarPagas(ids); app.avisar(`${ids.length} contas marcadas como pagas`); }}
        />
      ) : (
        <div data-mimo="app" data-tema={tema} className="view" style={{ color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif", animation: "mmPagina .35s ease both" }}>
          {conteudo}
        </div>
      )}

      {/* modais próprios do Duo e Metas (lazer, aporte, marcos) numa camada fixa acima do dock */}
      <div data-mimo="app" data-tema={tema} style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none", color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <Presenca aberto={!!md}>{modalNode}</Presenca>
      </div>
    </Moldura>
  );
}
