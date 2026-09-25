import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Gato, type Expressao } from "../components/mimo/Gato";
import { Spinner } from "../components/mimo/ui";
import { useTimers } from "../hooks/useTimers";
import { lerAjustes, salvarAjustes } from "../lib/ajustes";
import { salvarPlano } from "../lib/plano";
import { useTemaTela } from "../lib/tema";

// Porta de docs/ref/FluxoAcesso.dc.html ("Mimo Acesso e Onboarding"):
// autenticação (1a–1d) e onboarding (2a–2e) num só fluxo. Cada tela tem rota
// própria em /acesso/:tela; o estado do formulário vive neste componente e
// sobrevive às trocas de rota. Sem backend: envios são simulados com timers.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// convite de exemplo: vale 5 dias a partir de hoje
const EXPIRA_CONVITE = new Date(Date.now() + 5 * 86400000);
const V = { email: "gustavo.martins@gmail.com", senha: "mimo2026casa", nome: "Gustavo", renda: "6.800", emailParceiro: "suelen@gmail.com", mensagem: "Oi, Su! Vamos organizar as contas da casa juntos no Mimo?" };

type Tela = "cadastro" | "login" | "recuperar" | "recuperar-enviado" | "verificar" | "plano" | "config" | "duo-escolha" | "duo-convidar" | "duo-enviado" | "duo-pendente" | "duo-convite" | "pronto";
type Plano = "solo" | "duo";
type Estado = "vazio" | "preenchendo" | "erro" | "loading" | "sucesso";
type Campo = "email" | "senha" | "nome" | "renda" | "emailParceiro" | "mensagem";

const TELAS: Tela[] = ["cadastro", "login", "recuperar", "recuperar-enviado", "verificar", "plano", "config", "duo-escolha", "duo-convidar", "duo-enviado", "duo-pendente", "duo-convite", "pronto"];
const CARD: Tela[] = ["cadastro", "login", "recuperar", "recuperar-enviado", "verificar", "config", "duo-escolha", "duo-convidar", "duo-enviado", "duo-convite", "pronto"];
const ESTADOS: Estado[] = ["vazio", "preenchendo", "erro", "loading", "sucesso"];

const fmtMil = (n: number) => n.toLocaleString("pt-BR");
const num = (s: string) => Number(String(s || "").replace(/\D/g, "")) || 0;

// "config-duo" -> { tela: "config", plano: "duo" }
function norm(slug: string): { tela: Tela; plano: Plano | null } | null {
  const m = /^(config|pronto)-(solo|duo)$/.exec(slug);
  if (m) return { tela: m[1] as Tela, plano: m[2] as Plano };
  return (TELAS as string[]).includes(slug) ? { tela: slug as Tela, plano: null } : null;
}
const slugDe = (tela: Tela, plano: Plano) => (tela === "config" || tela === "pronto" ? `${tela}-${plano}` : tela);

interface S {
  plano: Plano;
  erros: Partial<Record<Campo, string>>;
  erroGeral: string;
  aviso: string;
  loading: boolean;
  sucesso: boolean;
  foco: Campo | null;
  verSenha: boolean;
  recusado: boolean;
  expirado: boolean;
  copiado: boolean;
  google: boolean;
  reenviando: boolean;
  cooldown: number;
  hover: Plano | null;
  escolha: Plano | null;
  email: string;
  senha: string;
  nome: string;
  renda: string;
  emailParceiro: string;
  mensagem: string;
}

function base(tela: Tela, plano: Plano): S {
  const logado = !["cadastro", "login", "recuperar"].includes(tela);
  return {
    plano, erros: {}, erroGeral: "", aviso: "", loading: false, sucesso: false, foco: null, verSenha: false,
    recusado: false, expirado: false, copiado: false, google: false, reenviando: false, cooldown: 0, hover: null,
    escolha: tela === "config" || tela === "pronto" ? plano : null,
    email: logado ? V.email : "", senha: "", nome: logado && tela !== "config" ? V.nome : "", renda: "",
    emailParceiro: ["duo-enviado", "duo-pendente"].includes(tela) ? V.emailParceiro : "", mensagem: V.mensagem,
  };
}

// Estados de demonstração do protótipo (?estado=erro etc.).
function preset(tela: Tela, plano: Plano, estado: Estado): S {
  const s = base(tela, plano);
  if (estado === "vazio") return s;
  if (estado === "preenchendo") {
    if (tela === "cadastro" || tela === "login") Object.assign(s, { email: V.email, senha: "mimo2", foco: "senha" });
    if (tela === "recuperar") Object.assign(s, { email: "gustavo@gm", foco: "email" });
    if (tela === "config") Object.assign(s, { nome: V.nome, renda: "6", foco: "renda" });
    if (tela === "duo-convidar") Object.assign(s, { emailParceiro: "suelen@", foco: "emailParceiro" });
    if (tela === "plano") s.escolha = "duo";
    return s;
  }
  Object.assign(s, { email: V.email, senha: V.senha, nome: V.nome, renda: V.renda, emailParceiro: V.emailParceiro });
  if (tela === "plano") s.escolha = "solo";
  if (estado === "loading") {
    if (["recuperar-enviado", "duo-pendente"].includes(tela)) s.reenviando = true; else s.loading = true;
  }
  if (estado === "sucesso") {
    s.sucesso = true;
    const msgs: Partial<Record<Tela, string>> = { cadastro: "Conta criada. Enviando o e-mail de confirmação…", login: "Tudo certo. Abrindo seu painel…", recuperar: "Link enviado. Confira sua caixa de entrada.", "recuperar-enviado": "Enviamos de novo. Confira sua caixa de entrada.", config: "Ajustes salvos.", "duo-convidar": "Convite enviado." };
    s.aviso = msgs[tela] || "";
  }
  if (estado === "erro") {
    const e: Partial<Record<Tela, () => void>> = {
      cadastro: () => Object.assign(s, { email: "gustavo@gmail", senha: "mimo", erros: { email: "Esse e-mail parece incompleto. Confira o final (ex.: .com).", senha: "Use pelo menos 8 caracteres, com um número." } }),
      login: () => Object.assign(s, { erroGeral: "E-mail ou senha não conferem. Confira e tente de novo.", erros: { senha: " " } }),
      recuperar: () => Object.assign(s, { email: "gustavo@", erros: { email: "Digite um e-mail válido para receber o link." } }),
      "recuperar-enviado": () => Object.assign(s, { erroGeral: "Não conseguimos reenviar agora. Tente de novo em alguns segundos." }),
      verificar: () => Object.assign(s, { erroGeral: "Ainda não recebemos a confirmação. Confira a caixa de spam ou reenvie o e-mail." }),
      plano: () => Object.assign(s, { escolha: null, erroGeral: "Escolha um tipo de conta para continuar." }),
      config: () => Object.assign(s, { nome: "", renda: "", erros: { nome: "Como podemos te chamar?", renda: "Informe um valor aproximado. Pode ser redondo." } }),
      "duo-convidar": () => Object.assign(s, { emailParceiro: V.email, erros: { emailParceiro: "Esse é o seu próprio e-mail. Use o e-mail do(a) parceiro(a)." } }),
      "duo-pendente": () => Object.assign(s, { expirado: true }),
      "duo-convite": () => Object.assign(s, { expirado: true }),
    };
    e[tela]?.();
  }
  return s;
}

// ---- estilos repetidos -------------------------------------------------------
const SORA = "'Sora', sans-serif";
const H1: CSSProperties = { margin: 0, fontFamily: SORA, fontSize: 30, fontWeight: 300, letterSpacing: "-.04em", lineHeight: 1.15, color: "var(--ink)" };
const SUB: CSSProperties = { margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" };
const COL8: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const LABEL: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, fontSize: 12, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--faint)" };
const ERRO: CSSProperties = { fontSize: 12.5, lineHeight: 1.45, color: "var(--out-ink)", animation: "mmFade .2s ease both" };
const STRONG: CSSProperties = { color: "var(--ink)", fontWeight: 600 };
const LINK_BTN: CSSProperties = { padding: 0, border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", borderBottom: "1px solid var(--accent-line)" };
const BTN_PRIM: CSSProperties = { width: "100%", height: 50, borderRadius: 16, border: "none", background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 };
const DASH = (cor: string) => <span style={{ color: cor, fontWeight: 700 }}>—</span>;

interface FS { borda: string; sombra: string; erro: string }
const inputSt = (f: FS, extra?: CSSProperties): CSSProperties => ({
  width: "100%", height: 48, padding: "0 15px", borderRadius: 13, border: `1px solid ${f.borda}`, boxShadow: f.sombra,
  background: "var(--field)", color: "var(--ink)", fontSize: 14.5, fontFamily: "inherit", textTransform: "none", letterSpacing: 0,
  outline: "none", transition: "border-color .2s ease, box-shadow .2s ease", ...extra,
});

function Titulo({ titulo, children, balance }: { titulo: string; children?: ReactNode; balance?: boolean }) {
  return (
    <div style={COL8}>
      <h1 style={{ ...H1, textWrap: balance ? "balance" : undefined }}>{titulo}</h1>
      {children != null && <p style={SUB}>{children}</p>}
    </div>
  );
}

export default function FluxoAcesso() {
  const tema = useTemaTela();
  const loc = useLocation();
  const navigate = useNavigate();
  const { later } = useTimers();
  const iv = useRef<number | undefined>(undefined);

  const slug = loc.pathname.replace(/^\/acesso\/?/, "").split("/")[0];
  const alvo = norm(slug);
  const t: Tela = alvo?.tela ?? "cadastro";

  const [s, setS] = useState<S>(() => {
    const q = new URLSearchParams(loc.search).get("estado") as Estado | null;
    return preset(t, alvo?.plano ?? "solo", q && ESTADOS.includes(q) ? q : "vazio");
  });
  const plano: Plano = alvo?.plano ?? s.plano;
  const sRef = useRef(s);
  useLayoutEffect(() => { sRef.current = s; });

  useEffect(() => () => window.clearInterval(iv.current), []);
  // cada troca de tela começa do topo
  useEffect(() => { window.scrollTo({ top: 0 }); }, [t]);

  if (!alvo) return <Navigate to="/acesso/cadastro" replace />;

  const up = (patch: Partial<S> | ((p: S) => Partial<S>)) =>
    setS((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));

  const cooldown = (n: number) => {
    window.clearInterval(iv.current);
    up({ cooldown: n });
    iv.current = window.setInterval(() => setS((p) => {
      if (p.cooldown <= 1) { window.clearInterval(iv.current); return { ...p, cooldown: 0 }; }
      return { ...p, cooldown: p.cooldown - 1 };
    }), 1000);
  };

  const ir = (tela: Tela, extra: Partial<S> = {}) => {
    const novoPlano = extra.plano ?? plano;
    up({ erros: {}, erroGeral: "", aviso: "", loading: false, sucesso: false, foco: null, recusado: false, expirado: false, copiado: false, google: false, reenviando: false, hover: null, ...extra, plano: novoPlano });
    if (extra.cooldown) cooldown(extra.cooldown);
    navigate(`/acesso/${slugDe(tela, novoPlano)}`);
  };

  const carregar = (fn: () => void, ms = 1300) => {
    if (sRef.current.loading) return;
    up({ loading: true, foco: null, erroGeral: "", aviso: "" });
    later(fn, ms);
  };
  const set = (k: Campo, v: string) => setS((p) => ({ ...p, [k]: v, erros: { ...p.erros, [k]: "" }, erroGeral: "", aviso: "" }));

  const enviar = () => {
    const x = sRef.current;
    const erros: Partial<Record<Campo, string>> = {};
    if (t === "cadastro") {
      if (!EMAIL_RE.test(x.email)) erros.email = "Esse e-mail parece incompleto. Confira o final (ex.: .com).";
      if (x.senha.length < 8 || !/\d/.test(x.senha)) erros.senha = "Use pelo menos 8 caracteres, com um número.";
      if (Object.keys(erros).length) return up({ erros });
      return carregar(() => ir("verificar", { cooldown: 30 }));
    }
    if (t === "login") {
      if (!EMAIL_RE.test(x.email)) erros.email = "Digite um e-mail válido.";
      if (!x.senha) erros.senha = "Digite sua senha.";
      if (Object.keys(erros).length) return up({ erros });
      return carregar(() => ir("plano"));
    }
    if (t === "recuperar") {
      if (!EMAIL_RE.test(x.email)) return up({ erros: { email: "Digite um e-mail válido para receber o link." } });
      return carregar(() => ir("recuperar-enviado", { cooldown: 42 }));
    }
    if (t === "recuperar-enviado") return ir("login");
    if (t === "verificar") {
      if (x.sucesso) return ir("plano");
      return carregar(() => up({ loading: false, sucesso: true }), 1100);
    }
    if (t === "config") {
      if (!x.nome.trim()) erros.nome = "Como podemos te chamar?";
      if (num(x.renda) <= 0) erros.renda = "Informe um valor aproximado. Pode ser redondo.";
      if (Object.keys(erros).length) return up({ erros });
      // nome e renda do onboarding viram os ajustes da conta (topo, Finanças, divisão)
      salvarAjustes(plano, { nome: x.nome.trim(), renda: num(x.renda), ...(x.email ? { email: x.email.trim() } : {}) });
      return carregar(() => (plano === "duo" ? ir("duo-escolha") : ir("pronto")), 1000);
    }
    if (t === "duo-convidar") {
      if (!EMAIL_RE.test(x.emailParceiro)) return up({ erros: { emailParceiro: "Confira o e-mail do(a) parceiro(a)." } });
      if (x.emailParceiro.trim().toLowerCase() === x.email.toLowerCase()) return up({ erros: { emailParceiro: "Esse é o seu próprio e-mail. Use o e-mail do(a) parceiro(a)." } });
      return carregar(() => ir("duo-enviado"));
    }
    if (t === "duo-enviado") return ir("duo-pendente");
    if (t === "duo-convite") return carregar(() => ir("pronto", { plano: "duo", nome: V.nome }));
  };

  const reenviar = () => {
    const x = sRef.current;
    if (x.cooldown > 0 || x.reenviando) return;
    up({ reenviando: true, aviso: "", erroGeral: "" });
    const tela = t;
    later(() => {
      setS((p) => ({ ...p, reenviando: false, expirado: false, aviso: tela === "duo-pendente" ? "Convite reenviado para " + p.emailParceiro + "." : "Enviamos de novo. Confira sua caixa de entrada." }));
      cooldown(42);
    }, 1100);
  };

  const copiar = () => {
    up({ copiado: true });
    later(() => up({ copiado: false }), 1800);
  };

  const fs = (k: Campo): FS => {
    const err = s.erros[k];
    const foco = s.foco === k;
    return {
      borda: err ? "var(--out)" : foco ? "var(--accent-line)" : "var(--line2)",
      sombra: err ? "0 0 0 4px var(--out-soft)" : foco ? "0 0 0 4px var(--accent-soft)" : "none",
      erro: err && err.trim() ? err : "",
    };
  };
  const foco = (k: Campo) => () => up({ foco: k });
  const semFoco = () => up({ foco: null });

  // ---- valores derivados (renderVals do protótipo) ---------------------------
  const duo = plano === "duo";
  const temErro = !!s.erroGeral || Object.values(s.erros).some(Boolean) || s.expirado;
  let exp: Expressao = temErro ? "preocupado" : s.loading || s.reenviando ? "atento" : s.sucesso ? "feliz"
    : s.foco === "senha" ? (s.verSenha ? "curioso" : "feliz") : s.foco ? "curioso" : "padrao";
  if (t === "pronto" || t === "duo-enviado") exp = "feliz";
  if (t === "duo-convite" && s.recusado) exp = "preocupado";
  let exp2: Expressao = temErro ? "preocupado" : s.loading ? "atento" : t === "pronto" ? "feliz" : "curioso";
  if (t === "duo-convite" && s.recusado) exp2 = "atento";

  const pad = (n: number) => String(n).padStart(2, "0");
  const cdLabel = s.cooldown > 0 ? "Reenviar em 0:" + pad(s.cooldown) : null;

  const senha = s.senha;
  const score = !senha ? 0 : (senha.length >= 8 ? 1 : 0) + (/\d/.test(senha) ? 1 : 0) + (/[A-Z]|[^a-zA-Z0-9]/.test(senha) || senha.length >= 12 ? 1 : 0);
  const forcaCores = ["var(--line2)", "var(--out)", "var(--warn)", "var(--in)"];
  const sc = Math.max(score, senha ? 1 : 0);
  const forcaBarras = [0, 1, 2].map((i) => (i < sc ? forcaCores[sc] : "var(--line2)"));
  const forcaLabel = !senha ? "8+ caracteres, com um número" : ["", "Fraca", "Boa", "Forte"][sc];

  const renda = num(s.renda);
  // prévia com o limite de gastos padrão da conta (ajustável depois em Finanças)
  const limiteRef = lerAjustes(plano).limite;
  const pct = renda ? Math.min(100, Math.round((limiteRef / renda) * 100)) : 0;

  const topos: Partial<Record<Tela, { texto: string; acao: string; onClick: () => void }>> = {
    cadastro: { texto: "Já tem conta?", acao: "Entrar", onClick: () => ir("login") },
    login: { texto: "Novo por aqui?", acao: "Criar conta", onClick: () => ir("cadastro") },
    recuperar: { texto: "Lembrou?", acao: "Entrar", onClick: () => ir("login") },
    "recuperar-enviado": { texto: "Lembrou?", acao: "Entrar", onClick: () => ir("login") },
    verificar: { texto: s.email, acao: "Sair", onClick: () => ir("login") },
    "duo-pendente": { texto: "Gustavo", acao: "Sair", onClick: () => ir("login") },
  };
  const topo = topos[t];
  const total = duo || s.escolha === "duo" ? 3 : 2;
  const passos: Partial<Record<Tela, number>> = { plano: 1, config: 2, "duo-escolha": 3, "duo-convidar": 3 };
  const passoLabel = passos[t] ? "Passo " + passos[t] + " de " + total : "";

  const btns: Partial<Record<Tela, [string, string]>> = {
    cadastro: ["Criar conta", "Criando sua conta…"], login: ["Entrar", "Entrando…"], recuperar: ["Enviar link", "Enviando…"],
    "recuperar-enviado": ["Voltar para o login", ""], verificar: [s.sucesso ? "Continuar" : "Já confirmei", "Verificando…"],
    config: [duo ? "Continuar" : "Concluir", "Salvando…"], "duo-convidar": ["Enviar convite", "Enviando convite…"],
    "duo-enviado": ["Continuar", ""], "duo-convite": ["Aceitar convite", "Entrando na conta duo…"],
  };
  const conviteNormal = t === "duo-convite" && !s.expirado && !s.recusado;
  const conviteExpirado = t === "duo-convite" && s.expirado;
  const conviteRecusado = t === "duo-convite" && s.recusado && !s.expirado;
  const btnPrimario = !!btns[t] && (t !== "duo-convite" || conviteNormal);
  const b = btns[t] || ["", ""];

  type Sec = { label: string; onClick: () => void; cor: string; linha: string; cursor: string };
  const linkSec = (label: string, onClick: () => void, cor = "var(--accent-ink)", ativo = true): Sec => ({ label, onClick, cor: ativo ? cor : "var(--faint)", linha: ativo ? "var(--accent-line)" : "transparent", cursor: ativo ? "pointer" : "default" });
  let acoesSec: Sec[] | null = null;
  if (t === "recuperar") acoesSec = [linkSec("Voltar para o login", () => ir("login"))];
  if (t === "recuperar-enviado") acoesSec = [linkSec(s.reenviando ? "Reenviando…" : cdLabel || "Reenviar link", reenviar, undefined, !cdLabel && !s.reenviando), linkSec("Usar outro e-mail", () => ir("recuperar", { email: "" }))];
  if (t === "verificar" && !s.sucesso) acoesSec = [linkSec(s.reenviando ? "Reenviando…" : cdLabel || "Reenviar e-mail", reenviar, undefined, !cdLabel && !s.reenviando), linkSec("Trocar e-mail", () => ir("cadastro"))];
  if (t === "duo-escolha") acoesSec = [linkSec("Voltar para a escolha do plano", () => ir("plano", { escolha: "duo" }))];
  if (t === "duo-convidar") acoesSec = [linkSec("Voltar", () => ir("duo-escolha"))];
  if (t === "config") acoesSec = [linkSec("Trocar tipo de conta", () => ir("plano", { escolha: plano }))];

  const notas: Partial<Record<Tela, string>> = {
    cadastro: "Ao criar a conta, você concorda com os Termos de uso e a Política de privacidade.",
    verificar: s.sucesso ? "" : "Não achou? Olhe a caixa de spam ou de promoções.",
    "recuperar-enviado": "Não achou? Olhe a caixa de spam ou de promoções.",
    config: duo ? "Cada pessoa informa a própria renda. O Mimo soma as duas no painel do casal." : "Só você vê esse valor. Dá para mudar depois nas configurações.",
  };
  const nota = notas[t] || "";

  const pillDuo = { texto: "Conta duo", bg: "var(--duo-soft)", cor: "var(--duo-ink)" };
  const pillSolo = { texto: "Conta solo", bg: "var(--solo-soft)", cor: "var(--solo-ink)" };
  const pills: Partial<Record<Tela, { texto: string; bg: string; cor: string }>> = {
    config: duo ? pillDuo : pillSolo,
    "duo-escolha": pillDuo,
    "duo-convidar": pillDuo,
    "duo-enviado": { texto: "Aguardando aceite", bg: "var(--duo-soft)", cor: "var(--duo-ink)" },
    "duo-convite": s.expirado ? { texto: "Convite expirado", bg: "var(--out-soft)", cor: "var(--out-ink)" } : { texto: "Convite para o Mimo Duo", bg: "var(--duo-soft)", cor: "var(--duo-ink)" },
    pronto: duo ? { texto: "Conta duo ativa", bg: "var(--duo-soft)", cor: "var(--duo-ink)" } : pillSolo,
  };
  const pill = pills[t];

  const faixas = ["3.000", "5.000", "8.000", "12.000"].map((v) => {
    const on = s.renda === v;
    return { v, label: "R$ " + v.replace(".000", " mil"), borda: on ? "var(--accent-line)" : "var(--line2)", bg: on ? "var(--accent-soft)" : "transparent", cor: on ? "var(--ink)" : "var(--muted)" };
  });

  const card = (tipo: Plano) => {
    const ativo = s.hover === tipo || s.escolha === tipo;
    const outro = !!(s.hover || s.escolha) && !ativo;
    const cor = tipo === "solo" ? "var(--solo-line)" : "var(--duo-line)";
    const sel = s.escolha === tipo;
    return {
      tr: ativo ? "translateY(-14px) scale(1.035)" : outro ? "scale(.98)" : "none",
      gatoOp: ativo ? 1 : 0,
      extraH: ativo ? "150px" : "0px",
      borda: ativo ? cor : "var(--line)",
      sombra: ativo ? "0 34px 70px -28px var(--shadow-hi)" : outro ? "0 10px 26px -20px var(--shadow)" : "0 18px 44px -30px var(--shadow)",
      pill: sel ? "Selecionado" : tipo === "solo" ? "1 pessoa" : "2 pessoas",
      loading: sel && s.loading,
      exp: (sel && s.loading ? "atento" : sel ? "feliz" : "padrao") as Expressao,
      btn: sel && s.loading ? "Preparando…" : tipo === "solo" ? "Começar sozinho" : "Convidar alguém",
    };
  };
  const solo = card("solo");
  const duoC = card("duo");
  const soloGatoTr = solo.gatoOp ? "translateX(-50%) translateY(0) rotate(-2deg)" : "translateX(-50%) translateY(56px) scale(.9)";
  const duoGatoTr = duoC.gatoOp ? "translateX(-96%) translateY(0) rotate(-6deg)" : "translateX(-70%) translateY(58px) scale(.9)";
  const duoGato2Tr = duoC.gatoOp ? "translateX(-4%) translateY(0) rotate(7deg)" : "translateX(-30%) translateY(60px) scale(.9)";
  const continuar = (tipo: Plano) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (sRef.current.loading) return;
    up({ escolha: tipo, loading: true, erroGeral: "" });
    later(() => ir("config", { plano: tipo, escolha: tipo, nome: "", renda: "" }), 900);
  };

  const pendAceito = t === "duo-pendente" && s.sucesso;
  const pend = s.expirado ? {
    pill: "Conta duo · convite expirado", pillBg: "var(--out-soft)", pillCor: "var(--out-ink)",
    titulo: "O convite para a Suelen expirou", texto: "Convites valem por 7 dias. Envie um novo e ela recebe outro link no mesmo e-mail.",
    exp1: "preocupado", exp2: "atento", gatoOp: 0.4, slotBorda: "var(--out-line)", slotBg: "transparent",
    status: "Expirado", statusBg: "var(--out-soft)", statusCor: "var(--out-ink)", pulse: "none", acoes: false, novo: true,
    rodape: "Enquanto isso, o painel funciona no modo solo. Nada do que você lançou se perde.", btn: "Ir para meu painel", btnBg: "transparent", btnCor: "var(--ink2)", btnBorda: "var(--line2)", href: "/",
  } : pendAceito ? {
    pill: "Conta duo · ativa", pillBg: "var(--solo-soft)", pillCor: "var(--solo-ink)",
    titulo: "A Suelen aceitou o convite", texto: "A carteira da casa está aberta para vocês dois. O que cada um marcar como compartilhado aparece no painel do casal.",
    exp1: "feliz", exp2: "feliz", gatoOp: 1, slotBorda: "var(--duo-line)", slotBg: "var(--surface)",
    status: "Conectada", statusBg: "var(--solo-soft)", statusCor: "var(--solo-ink)", pulse: "none", acoes: false, novo: false,
    rodape: "Os lançamentos que você fez sozinho continuam privados até você decidir compartilhar.", btn: "Abrir o painel do casal", btnBg: "var(--btn-bg)", btnCor: "var(--btn-fg)", btnBorda: "transparent", href: "/duo",
  } : {
    pill: "Conta duo · aguardando aceite", pillBg: "var(--duo-soft)", pillCor: "var(--duo-ink)",
    titulo: "Falta só a Suelen aceitar", texto: "Enviamos o convite para " + s.emailParceiro + " há 2 dias. Ele vale até " + EXPIRA_CONVITE.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) + ".",
    exp1: s.reenviando ? "atento" : "padrao", exp2: "atento", gatoOp: 0.45, slotBorda: "var(--duo-line)", slotBg: "transparent",
    status: "Aguardando", statusBg: "var(--duo-soft)", statusCor: "var(--duo-ink)", pulse: "mmPulse 1.8s ease-out infinite", acoes: true, novo: false,
    rodape: "Enquanto isso, o painel funciona no modo solo. O que você marcar como compartilhado aparece para a Suelen assim que ela entrar.", btn: "Ir para meu painel", btnBg: "var(--btn-bg)", btnCor: "var(--btn-fg)", btnBorda: "transparent", href: "/",
  };

  const gatoDuo = (t === "config" && duo) || ["duo-escolha", "duo-convidar", "duo-enviado", "duo-convite"].includes(t) || (t === "pronto" && duo);
  const campoEmail = ["cadastro", "login", "recuperar"].includes(t);
  const campoSenha = ["cadastro", "login"].includes(t);
  const emailParceiro = s.emailParceiro || V.emailParceiro;
  const reenvioLabel = s.reenviando ? "Reenviando…" : cdLabel || "Reenviar convite";

  const escolhaCard = (tipo: Plano, c: ReturnType<typeof card>) => {
    const ehSolo = tipo === "solo";
    return (
      <div
        onMouseEnter={() => up({ hover: tipo })}
        onMouseLeave={() => up({ hover: null })}
        onClick={() => up({ escolha: tipo, erroGeral: "" })}
        style={{ position: "relative", flex: "1 1 300px", maxWidth: 400, paddingTop: 128, cursor: "pointer", transition: "transform .42s cubic-bezier(.2,.8,.2,1)", transform: c.tr }}
      >
        {ehSolo ? (
          <div style={{ position: "absolute", left: "50%", top: 0, width: 170, pointerEvents: "none", transition: "transform .46s cubic-bezier(.22,1.2,.36,1), opacity .46s ease", transform: soloGatoTr, opacity: c.gatoOp }}>
            <Gato cor="#4e9e79" corpo={false} expressao={c.exp} />
          </div>
        ) : (
          <>
            <div style={{ position: "absolute", left: "50%", top: 4, width: 156, pointerEvents: "none", transition: "transform .46s cubic-bezier(.22,1.2,.36,1), opacity .46s ease", transform: duoGatoTr, opacity: c.gatoOp }}>
              <Gato cor="#4e9e79" corpo={false} expressao={c.exp} />
            </div>
            <div style={{ position: "absolute", left: "50%", top: 0, width: 156, pointerEvents: "none", transition: "transform .46s cubic-bezier(.22,1.2,.36,1) .07s, opacity .46s ease .07s", transform: duoGato2Tr, opacity: c.gatoOp }}>
              <Gato cor="#e2a24f" tabby corpo={false} expressao={c.exp} />
            </div>
          </>
        )}
        <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", gap: 20, padding: "34px 30px 30px", borderRadius: 26, border: `1px solid ${c.borda}`, background: "var(--surface)", boxShadow: c.sombra, transition: "box-shadow .42s ease, border-color .42s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--faint)" }}>{ehSolo ? "Conta solo" : "Conta duo"}</span>
            <span style={{ padding: "5px 11px", borderRadius: 999, background: ehSolo ? "var(--solo-soft)" : "var(--duo-soft)", color: ehSolo ? "var(--solo-ink)" : "var(--duo-ink)", fontSize: 11.5, fontWeight: 700 }}>{c.pill}</span>
          </div>
          <h2 style={{ margin: 0, fontFamily: SORA, fontSize: 27, fontWeight: 400, letterSpacing: "-.035em", lineHeight: 1.2, color: "var(--ink)" }}>
            {ehSolo ? <>Só o seu dinheiro,<br />do seu jeito</> : <>As contas da casa,<br />divididas em dois</>}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
            {(ehSolo
              ? ["Carteiras, limites e metas individuais", "Relatórios mensais privados", "Lançamentos rápidos em um toque"]
              : ["Carteira compartilhada e saldos separados", "Divisão automática das despesas fixas", "Cada um vê quem pagou o quê"]
            ).map((item) => (
              <div key={item} style={{ display: "flex", gap: 10 }}>{DASH(ehSolo ? "var(--solo)" : "var(--duo)")}<span>{item}</span></div>
            ))}
          </div>
          <div style={{ overflow: "hidden", transition: "max-height .42s cubic-bezier(.2,.8,.2,1), opacity .42s ease", maxHeight: c.extraH, opacity: c.gatoOp }}>
            <p style={{ margin: "4px 0 0", paddingTop: 16, borderTop: "1px dashed var(--line2)", fontSize: 13.5, lineHeight: 1.6, color: "var(--muted2)" }}>
              {ehSolo
                ? "O painel abre direto no seu saldo. Nenhuma movimentação é compartilhada com outra pessoa."
                : "Convide a outra pessoa por e-mail. Cada perfil mantém seus lançamentos pessoais fora da carteira comum."}
            </p>
          </div>
          <button type="button" onClick={continuar(tipo)} className={ehSolo ? "mm-h-solo" : "mm-h-duo"} style={{ marginTop: "auto", height: 50, padding: "0 20px", borderRadius: 16, border: "none", background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {c.loading && <Spinner size={16} />}
            {c.btn}
          </button>
        </div>
      </div>
    );
  };

  const campo = (k: Campo, rotulo: string, props: { type?: string; placeholder: string; onChange: (v: string) => void; inputMode?: "numeric" }) => {
    const f = fs(k);
    return (
      <div style={COL8}>
        <label style={LABEL}>{rotulo}
          <input type={props.type} inputMode={props.inputMode} value={s[k]} onChange={(e) => props.onChange(e.target.value)} onFocus={foco(k)} onBlur={semFoco} placeholder={props.placeholder} style={inputSt(f)} />
        </label>
        {f.erro && <span style={ERRO}>{f.erro}</span>}
      </div>
    );
  };

  return (
    <div data-mimo="fluxo" data-tema={tema} style={{ position: "relative", width: "100%", minHeight: "100dvh", overflowX: "hidden", background: "var(--bg)", color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif", animation: "mmPagina .35s ease both" }}>
      <div style={{ pointerEvents: "none", position: "absolute", top: -180, left: "50%", width: 760, height: 420, transform: "translateX(-50%)", borderRadius: "50%", background: "var(--glow-solo)", filter: "blur(10px)" }} />

      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "22px 28px" }}>
        <img src={`${import.meta.env.BASE_URL}assets/mimo-logo.png`} alt="Mimo" style={{ display: "block", height: 34, width: "auto", filter: "var(--logo-filtro)" }} />
        {topo && (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted2)", animation: "mmFade .3s ease both" }}>
            <span>{topo.texto}</span>
            <button type="button" onClick={topo.onClick} style={LINK_BTN}>{topo.acao}</button>
          </div>
        )}
        {passoLabel && <span style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--faint)" }}>{passoLabel}</span>}
      </header>

      <main style={{ position: "relative", display: "flex", justifyContent: "center", padding: "0 16px 64px" }}>
        {CARD.includes(t) && (
          <div key={t} style={{ position: "relative", width: "100%", maxWidth: 440, paddingTop: 118, animation: "mmRiseFx .6s cubic-bezier(.2,.8,.2,1) both" }}>
            {!gatoDuo && (
              <div style={{ position: "absolute", left: "50%", top: 0, width: 150, transform: "translateX(-50%)", pointerEvents: "none" }}>
                <Gato cor="#4e9e79" expressao={exp} />
              </div>
            )}
            {gatoDuo && (
              <>
                <div style={{ position: "absolute", left: "50%", top: 14, width: 132, transform: "translateX(-96%) rotate(-6deg)", pointerEvents: "none" }}>
                  <Gato cor="#4e9e79" expressao={exp} />
                </div>
                <div style={{ position: "absolute", left: "50%", top: 10, width: 132, transform: "translateX(-4%) rotate(7deg)", pointerEvents: "none" }}>
                  <Gato cor="#e2a24f" tabby expressao={exp2} />
                </div>
              </>
            )}

            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 20, padding: "34px 30px 30px", borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)" }}>
              {pill && <span style={{ alignSelf: "flex-start", padding: "5px 11px", borderRadius: 999, background: pill.bg, color: pill.cor, fontSize: 11.5, fontWeight: 700, transition: "background .3s ease, color .3s ease" }}>{pill.texto}</span>}

              {t === "cadastro" && <Titulo titulo="Crie sua conta">Leva menos de um minuto. Depois você escolhe se vai usar o Mimo sozinho ou a dois.</Titulo>}
              {t === "login" && <Titulo titulo="Que bom te ver de novo">Entre para ver como está o mês.</Titulo>}

              {(t === "cadastro" || t === "login") && (
                <>
                  <button
                    type="button"
                    className="mm-h-google"
                    onClick={() => { if (s.google) return; up({ google: true }); later(() => ir("plano"), 1300); }}
                    style={{ width: "100%", height: 50, borderRadius: 16, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink2)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 11 }}
                  >
                    {s.google ? <Spinner size={16} /> : (
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" /></svg>
                    )}
                    {s.google ? "Conectando ao Google…" : "Continuar com Google"}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--faint)" }}>
                    <span style={{ flex: 1, height: 1, background: "var(--line)" }} />ou com e-mail<span style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  </div>
                </>
              )}

              {t === "recuperar" && <Titulo titulo="Esqueceu a senha?">Acontece. Informe seu e-mail e enviamos um link mágico para você entrar e criar uma senha nova.</Titulo>}
              {t === "recuperar-enviado" && (
                <Titulo titulo="Confira seu e-mail">Enviamos um link mágico para <strong style={STRONG}>{s.email}</strong>. Ele vale por 15 minutos e só funciona uma vez.</Titulo>
              )}

              {t === "verificar" && (
                <>
                  <Titulo titulo={s.sucesso ? "E-mail confirmado" : "Confirme seu e-mail"}>
                    {s.sucesso ? "Tudo certo com " : "Enviamos um link de confirmação para "}<strong style={STRONG}>{s.email}</strong>
                    {s.sucesso ? ". Agora vamos escolher como você vai usar o Mimo." : ". Assim que você clicar nele, a gente continua daqui."}
                  </Titulo>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, border: "1px solid var(--line)", background: "var(--field)" }}>
                    <span style={{ width: 9, height: 9, flex: "none", borderRadius: "50%", background: s.sucesso ? "var(--in)" : s.loading ? "var(--accent)" : "var(--duo)", animation: s.sucesso ? "none" : "mmPulse 1.8s ease-out infinite", transition: "background .3s ease" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink2)" }}>{s.sucesso ? "Confirmado agora" : s.loading ? "Verificando…" : "Aguardando confirmação"}</span>
                      <span style={{ fontSize: 12, color: "var(--faint)" }}>{s.sucesso ? "Sua conta está ativa." : "Esta tela atualiza sozinha quando o link for aberto."}</span>
                    </div>
                  </div>
                </>
              )}

              {t === "config" && <Titulo titulo="Primeiros ajustes">{duo ? "Duas informações sobre você. Depois a gente chama seu par." : "Duas informações e seu painel fica pronto."}</Titulo>}

              {t === "duo-escolha" && (
                <>
                  <Titulo titulo="Como vocês vão entrar?">Uma pessoa convida e a outra aceita. Tanto faz quem começa.</Titulo>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      ["Convidar parceiro(a)", "Envio um convite por e-mail agora.", () => ir("duo-convidar", { emailParceiro: "" })],
                      ["Recebi um convite", "Alguém já me chamou para o Mimo Duo.", () => ir("duo-convite")],
                    ].map(([titulo, desc, fn]) => (
                      <button key={titulo as string} type="button" className="mm-h-escolha" onClick={fn as () => void} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 20px", borderRadius: 18, border: "1px solid var(--line2)", background: "var(--field)", color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{titulo as string}</span>
                          <span style={{ fontSize: 13, color: "var(--muted2)" }}>{desc as string}</span>
                        </span>
                        <span style={{ fontFamily: SORA, fontSize: 18, color: "var(--duo-ink)" }}>→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {t === "duo-convidar" && <Titulo titulo="Convidar parceiro(a)">A pessoa recebe um e-mail com o link. Ela pode criar uma conta ou entrar com a que já tem.</Titulo>}

              {t === "duo-enviado" && (
                <>
                  <Titulo titulo="Convite enviado">Mandamos o convite para <strong style={STRONG}>{emailParceiro}</strong>. Quando ele for aceito, a carteira da casa abre para vocês dois.</Titulo>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 8px 8px 16px", borderRadius: 15, border: "1px dashed var(--line2)", background: "var(--field)" }}>
                    <span style={{ fontSize: 13.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>mimo.app/convite/G7K2-QX8M</span>
                    <button type="button" onClick={copiar} style={{ flex: "none", padding: "9px 14px", borderRadius: 11, border: `1px solid ${s.copiado ? "var(--in-line)" : "var(--line2)"}`, background: "var(--surface)", color: s.copiado ? "var(--in-ink)" : "var(--ink2)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{s.copiado ? "Copiado" : "Copiar"}</button>
                  </div>
                </>
              )}

              {conviteNormal && (
                <>
                  <div style={COL8}>
                    <h1 style={{ ...H1, fontSize: 28, lineHeight: 1.18, textWrap: "balance" }}>Gustavo quer dividir as contas da casa com você</h1>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px", borderRadius: 16, border: "1px solid var(--line)", background: "var(--field)" }}>
                    <p style={{ margin: 0, fontFamily: SORA, fontSize: 15, fontWeight: 300, lineHeight: 1.5, color: "var(--ink2)" }}>“Oi, Su! Vamos organizar as contas da casa juntos no Mimo?”</p>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>Gustavo Martins · gustavo.martins@gmail.com</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
                    {["Carteira da casa com saldo consolidado", "Divisão das despesas e quem pagou o quê", "Metas do casal, com a parte de cada um"].map((item) => (
                      <div key={item} style={{ display: "flex", gap: 10 }}>{DASH("var(--duo)")}<span>{item}</span></div>
                    ))}
                  </div>
                  <p style={{ margin: 0, paddingTop: 14, borderTop: "1px dashed var(--line2)", fontSize: 13, lineHeight: 1.6, color: "var(--muted2)" }}>Lançamentos que você marcar como privados continuam só seus.</p>
                </>
              )}
              {conviteExpirado && <Titulo titulo="Esse convite expirou">Convites do Mimo Duo valem por 7 dias. Peça para o Gustavo enviar um novo, ou comece com uma conta solo por enquanto.</Titulo>}
              {conviteRecusado && <Titulo titulo="Convite recusado">Avisamos o Gustavo. Se mudar de ideia, ele pode enviar outro convite quando quiser.</Titulo>}

              {t === "pronto" && (
                <Titulo balance titulo={duo ? "Vocês estão conectados" : "Tudo pronto, " + (s.nome || V.nome)}>
                  {duo ? "Gustavo e Suelen agora dividem a carteira da casa. Cada um continua com seus lançamentos privados." : "Seu painel já está esperando. Comece registrando a primeira movimentação do mês."}
                </Titulo>
              )}

              {s.erroGeral && <div role="alert" style={{ display: "flex", gap: 10, padding: "12px 15px", borderRadius: 12, border: "1px solid var(--out-line)", background: "var(--out-soft)", color: "var(--out-ink)", fontSize: 13, lineHeight: 1.5, animation: "mmFade .25s ease both" }}>{s.erroGeral}</div>}
              {s.aviso && <div role="status" style={{ padding: "12px 15px", borderRadius: 12, border: "1px solid var(--in-line)", background: "var(--in-soft)", color: "var(--in-ink)", fontSize: 13, lineHeight: 1.5, animation: "mmFade .25s ease both" }}>{s.aviso}</div>}

              {t === "config" && campo("nome", "Como podemos te chamar?", { placeholder: "Seu primeiro nome", onChange: (v) => set("nome", v) })}
              {campoEmail && campo("email", "E-mail", { type: "email", placeholder: "voce@email.com", onChange: (v) => set("email", v) })}

              {campoSenha && (() => {
                const f = fs("senha");
                return (
                  <div style={COL8}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 12, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--faint)" }}>Senha</span>
                      {t === "login" && <button type="button" onClick={() => ir("recuperar", { email: s.email })} style={{ padding: 0, border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Esqueci minha senha</button>}
                    </div>
                    <div style={{ position: "relative" }}>
                      <input aria-label="Senha" type={s.verSenha ? "text" : "password"} value={s.senha} onChange={(e) => set("senha", e.target.value)} onFocus={foco("senha")} onBlur={semFoco} placeholder={t === "cadastro" ? "Crie uma senha" : "Sua senha"} style={inputSt(f, { padding: "0 50px 0 15px" })} />
                      <button type="button" className="mm-h-olho" title={s.verSenha ? "Ocultar senha" : "Mostrar senha"} aria-label={s.verSenha ? "Ocultar senha" : "Mostrar senha"} onMouseDown={(e) => e.preventDefault()} onClick={() => up({ verSenha: !s.verSenha })} style={{ position: "absolute", right: 6, top: 6, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", color: "var(--muted)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /><path d="M4 20 20 4" style={{ opacity: s.verSenha ? 1 : 0, transition: "opacity .2s ease" }} /></svg>
                      </button>
                    </div>
                    {t === "cadastro" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, display: "flex", gap: 5 }}>
                          {forcaBarras.map((cor, i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: cor, transition: "background .25s ease" }} />)}
                        </div>
                        <span style={{ fontSize: 12, color: senha ? forcaCores[sc] : "var(--faint)", whiteSpace: "nowrap", fontWeight: 600, transition: "color .25s ease" }}>{forcaLabel}</span>
                      </div>
                    )}
                    {f.erro && <span style={ERRO}>{f.erro}</span>}
                  </div>
                );
              })()}

              {t === "config" && (() => {
                const f = fs("renda");
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={LABEL}>Renda mensal aproximada
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 15, top: 0, height: 48, display: "flex", alignItems: "center", fontFamily: SORA, fontSize: 14.5, color: "var(--muted)", textTransform: "none", letterSpacing: 0 }}>R$</span>
                        <input inputMode="numeric" value={s.renda} onChange={(e) => { const n = num(e.target.value); set("renda", n ? fmtMil(n) : ""); }} onFocus={foco("renda")} onBlur={semFoco} placeholder="0" style={inputSt(f, { padding: "0 15px 0 44px", fontFamily: SORA })} />
                      </div>
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {faixas.map((c) => (
                        <button key={c.v} type="button" onClick={() => set("renda", c.v)} style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${c.borda}`, background: c.bg, color: c.cor, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{c.label}</button>
                      ))}
                    </div>
                    {f.erro && <span style={ERRO}>{f.erro}</span>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4, padding: "14px 16px", borderRadius: 16, background: "var(--field)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 11.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--faint)" }}>Renda comprometida</span>
                        <span style={{ fontFamily: SORA, fontSize: 15, color: "var(--ink)" }}>{renda ? pct + "%" : "—"}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 999, background: "var(--accent)", transition: "width .6s cubic-bezier(.22,.9,.18,1)", width: pct + "%" }} />
                      </div>
                      <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted2)", textWrap: "pretty" }}>
                        {renda ? "Com o limite de gastos de R$ " + fmtMil(limiteRef) + " (dá para mudar depois), " + pct + "% da sua renda fica comprometida." : "Com a renda informada, o Mimo mostra quanto dela os gastos do mês já ocupam."}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {t === "duo-convidar" && (
                <>
                  {campo("emailParceiro", "E-mail do(a) parceiro(a)", { type: "email", placeholder: "nome@email.com", onChange: (v) => set("emailParceiro", v) })}
                  <label style={LABEL}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>Mensagem · opcional</span><span style={{ letterSpacing: 0, textTransform: "none" }}>{s.mensagem.length}/160</span></span>
                    <textarea value={s.mensagem} onChange={(e) => set("mensagem", e.target.value.slice(0, 160))} onFocus={foco("mensagem")} onBlur={semFoco} rows={3} maxLength={160} style={{ width: "100%", padding: "13px 15px", borderRadius: 13, border: `1px solid ${fs("mensagem").borda}`, boxShadow: fs("mensagem").sombra, background: "var(--field)", color: "var(--ink)", fontSize: 14.5, lineHeight: 1.5, fontFamily: "inherit", textTransform: "none", letterSpacing: 0, outline: "none", resize: "none", transition: "border-color .2s ease, box-shadow .2s ease" }} />
                  </label>
                </>
              )}

              {btnPrimario && (
                <button type="button" onClick={enviar} className="mm-h-primario" style={{ ...BTN_PRIM, marginTop: 2, cursor: s.loading ? "progress" : "pointer", opacity: s.loading ? 0.82 : 1 }}>
                  {s.loading && <Spinner size={16} />}
                  {s.loading && b[1] ? b[1] : b[0]}
                </button>
              )}
              {t === "pronto" && (
                <Link to={duo ? "/duo" : "/"} onClick={() => salvarPlano(plano)} className="mm-h-link-primario" style={{ width: "100%", height: 50, borderRadius: 16, background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {duo ? "Abrir o painel do casal" : "Abrir meu painel"}
                </Link>
              )}

              {conviteNormal && (
                <>
                  <button type="button" className="mm-h-recusar" onClick={() => up({ recusado: true })} style={{ width: "100%", height: 50, marginTop: -8, borderRadius: 16, border: "1px solid var(--line2)", background: "transparent", color: "var(--ink2)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Recusar</button>
                  <span style={{ fontSize: 12.5, textAlign: "center", color: "var(--faint)" }}>Você vai entrar como suelen@gmail.com</span>
                </>
              )}
              {conviteExpirado && (
                <button type="button" className="mm-h-primario" onClick={() => ir("plano", { escolha: "solo" })} style={BTN_PRIM}>Começar com conta solo</button>
              )}
              {conviteRecusado && (
                <button type="button" onClick={() => up({ recusado: false })} style={{ ...LINK_BTN, alignSelf: "flex-start" }}>Mudei de ideia</button>
              )}

              {acoesSec && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "10px 22px", fontSize: 13 }}>
                  {acoesSec.map((a) => (
                    <button key={a.label} type="button" onClick={a.onClick} style={{ padding: 0, border: "none", background: "transparent", color: a.cor, fontSize: 13, fontWeight: 600, cursor: a.cursor, borderBottom: `1px solid ${a.linha}` }}>{a.label}</button>
                  ))}
                </div>
              )}

              {nota && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, textAlign: "center", color: "var(--faint)", textWrap: "pretty" }}>{nota}</p>}
            </div>
          </div>
        )}

        {t === "plano" && (
          <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, width: "100%", maxWidth: 860, paddingTop: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", maxWidth: 620, animation: "mmRiseFx .7s cubic-bezier(.2,.8,.2,1) both" }}>
              <h1 style={{ margin: 0, fontFamily: SORA, fontSize: 40, fontWeight: 300, letterSpacing: "-.04em", lineHeight: 1.15, textWrap: "balance", color: "var(--ink)" }}>Como você quer usar o Mimo?</h1>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "var(--muted2)", textWrap: "balance" }}>Escolha o tipo de conta agora. Dá para mudar depois nas configurações.</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", justifyContent: "center", gap: "12px 30px", width: "100%", animation: "mmRiseFx .8s .08s cubic-bezier(.2,.8,.2,1) both" }}>
              {escolhaCard("solo", solo)}
              {escolhaCard("duo", duoC)}
            </div>
            {s.erroGeral && <div role="alert" style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid var(--out-line)", background: "var(--out-soft)", color: "var(--out-ink)", fontSize: 13, animation: "mmFade .25s ease both" }}>{s.erroGeral}</div>}
            <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>Selecionado: <strong style={STRONG}>{s.escolha === "solo" ? "Conta solo" : s.escolha === "duo" ? "Conta duo" : "nenhuma ainda"}</strong></p>
          </div>
        )}

        {t === "duo-pendente" && (
          <div key={t} style={{ display: "flex", flexDirection: "column", gap: 30, width: "100%", maxWidth: 860, paddingTop: 20, animation: "mmRiseFx .6s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
              <span style={{ alignSelf: "flex-start", padding: "5px 11px", borderRadius: 999, background: pend.pillBg, color: pend.pillCor, fontSize: 11.5, fontWeight: 700 }}>{pend.pill}</span>
              <h1 style={{ margin: 0, fontFamily: SORA, fontSize: 38, fontWeight: 300, letterSpacing: "-.04em", lineHeight: 1.15, color: "var(--ink)", textWrap: "balance" }}>{pend.titulo}</h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--muted2)", textWrap: "pretty" }}>{pend.texto}</p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
              <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 18, padding: "20px 22px", borderRadius: 24, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -30px var(--shadow)" }}>
                <div style={{ width: 88, flex: "none" }}><Gato cor="#4e9e79" corpo={false} expressao={pend.exp1 as Expressao} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <span style={{ fontFamily: SORA, fontSize: 20, fontWeight: 400, letterSpacing: "-.02em" }}>Gustavo</span>
                  <span style={{ fontSize: 12.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Você · gustavo@gmail.com</span>
                  <span style={{ alignSelf: "flex-start", marginTop: 2, padding: "4px 10px", borderRadius: 999, background: "var(--solo-soft)", color: "var(--solo-ink)", fontSize: 11.5, fontWeight: 700 }}>Pronto</span>
                </div>
              </div>
              <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 18, padding: "20px 22px", borderRadius: 24, border: `1px dashed ${pend.slotBorda}`, background: pend.slotBg, transition: "background .3s ease, border-color .3s ease" }}>
                <div style={{ width: 88, flex: "none", transition: "opacity .3s ease", opacity: pend.gatoOp }}><Gato cor="#e2a24f" tabby corpo={false} expressao={pend.exp2 as Expressao} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <span style={{ fontFamily: SORA, fontSize: 20, fontWeight: 400, letterSpacing: "-.02em" }}>Suelen</span>
                  <span style={{ fontSize: 12.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emailParceiro}</span>
                  <span style={{ alignSelf: "flex-start", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: 999, background: pend.statusBg, color: pend.statusCor, fontSize: 11.5, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: pend.pulse }} />{pend.status}
                  </span>
                </div>
              </div>
            </div>

            {s.aviso && <div role="status" style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--in-line)", background: "var(--in-soft)", color: "var(--in-ink)", fontSize: 13, animation: "mmFade .25s ease both" }}>{s.aviso}</div>}

            {pend.acoes && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <button type="button" className="mm-h-borda-duo" onClick={reenviar} style={{ height: 46, padding: "0 18px", borderRadius: 14, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 9, opacity: cdLabel ? 0.6 : 1 }}>
                  {s.reenviando && <Spinner size={14} />}
                  {reenvioLabel}
                </button>
                <button type="button" className="mm-h-borda-duo" onClick={copiar} style={{ height: 46, padding: "0 18px", borderRadius: 14, border: `1px solid ${s.copiado ? "var(--in-line)" : "var(--line2)"}`, background: "var(--surface)", color: s.copiado ? "var(--in-ink)" : "var(--ink2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{s.copiado ? "Link copiado" : "Copiar link"}</button>
                <button type="button" onClick={() => ir("duo-escolha")} style={{ height: 46, padding: "0 14px", border: "none", background: "transparent", color: "var(--out-ink)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Cancelar convite</button>
              </div>
            )}
            {pend.novo && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="mm-h-duo" onClick={reenviar} style={{ height: 50, padding: "0 24px", borderRadius: 16, border: "none", background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 14.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  {s.reenviando && <Spinner size={16} />}
                  Enviar novo convite
                </button>
                <button type="button" onClick={() => ir("duo-convidar", { emailParceiro: "" })} style={{ height: 50, padding: "0 20px", borderRadius: 16, border: "1px solid var(--line2)", background: "transparent", color: "var(--ink2)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Convidar outro e-mail</button>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 18, paddingTop: 26, borderTop: "1px solid var(--line)" }}>
              <p style={{ margin: 0, flex: "1 1 320px", fontSize: 14, lineHeight: 1.65, color: "var(--muted2)", textWrap: "pretty" }}>{pend.rodape}</p>
              <Link to={pend.href} onClick={() => salvarPlano(pendAceito ? "duo" : "solo")} style={{ flex: "none", height: 48, padding: "0 22px", borderRadius: 15, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 600, background: pend.btnBg, color: pend.btnCor, border: `1px solid ${pend.btnBorda}` }}>{pend.btn}</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
