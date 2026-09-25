import { useSyncExternalStore } from "react";
import { TEMA_KEY } from "./constants";

// Tema das telas portadas (Acesso, Duo e Metas, Configurações). Elas não
// guardam estado de tema próprio: leem o mesmo `data-theme` do <html> que o
// painel principal usa, então trocar em um lugar vale para todos.

export type TemaTela = "claro" | "escuro";
export type EscolhaTema = "claro" | "escuro" | "auto";

const temaAtual = (): TemaTela =>
  document.documentElement.dataset.theme === "dark" ? "escuro" : "claro";

const assinarTema = (avisar: () => void) => {
  const obs = new MutationObserver(avisar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};

export const useTemaTela = () => useSyncExternalStore(assinarTema, temaAtual, () => "claro" as TemaTela);

// "auto" quando não existe escolha salva: o app segue o sistema.
export const escolhaTemaSalva = (): EscolhaTema => {
  try {
    const v = localStorage.getItem(TEMA_KEY);
    return v === "claro" || v === "escuro" ? v : "auto";
  } catch {
    return "auto";
  }
};

const sistemaEscuro = () => {
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

// Aplica a escolha e, se houver botão de origem, abre o tema novo num círculo
// a partir dele (mesma transição do painel principal, via legacy-desktop.css).
export function aplicarEscolhaTema(escolha: EscolhaTema, origem?: HTMLElement | null) {
  try {
    if (escolha === "auto") localStorage.removeItem(TEMA_KEY);
    else localStorage.setItem(TEMA_KEY, escolha);
  } catch {
    // sem armazenamento a escolha vale só nesta sessão
  }
  const escuro = escolha === "auto" ? sistemaEscuro() : escolha === "escuro";
  const trocar = () => {
    if (escuro) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
  };
  if ((temaAtual() === "escuro") === escuro) return;

  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!origem || reduzir || !document.startViewTransition) {
    trocar();
    return;
  }
  const r = origem.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const raiz = document.documentElement.style;
  raiz.setProperty("--tema-x", `${x}px`);
  raiz.setProperty("--tema-y", `${y}px`);
  raiz.setProperty("--tema-r", `${Math.ceil(raio)}px`);
  document.startViewTransition(trocar);
}

// Layout compacto (mobile) das telas portadas: o protótipo usa um prop
// `compacto`; aqui ele vem da largura da janela.
const MQ = "(max-width: 760px)";
const compactoAgora = () => matchMedia(MQ).matches;
const assinarCompacto = (avisar: () => void) => {
  const mq = matchMedia(MQ);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
};

export const useCompacto = () => useSyncExternalStore(assinarCompacto, compactoAgora, () => false);
