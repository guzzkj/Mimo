import { useSyncExternalStore } from "react";
import { api } from "./api";
import { MODO_API } from "./modo";
import type { ContaApi, UsuarioApi } from "./remoto/tipos";
import { definirSessao, lerSessao, useSessao } from "./sessao";

// Tipo de conta em uso (solo ou duo), compartilhado entre Acesso, Duo e Metas
// e Configurações. Backend real: é o `plan` da pessoa no servidor.
// Protótipo: fica no navegador.

export type Plano = "solo" | "duo";

const PLANO_KEY = "mimo.plano";
const ouvintes = new Set<() => void>();

const planoDaSessao = (): Plano => {
  const s = lerSessao();
  return s.status === "ok" && s.user.plan === "duo" ? "duo" : "solo";
};

export const lerPlano = (): Plano => {
  if (MODO_API) return planoDaSessao();
  try {
    return localStorage.getItem(PLANO_KEY) === "solo" ? "solo" : "duo";
  } catch {
    return "duo";
  }
};

export function salvarPlano(plano: Plano) {
  if (MODO_API) {
    const s = lerSessao();
    if (s.status !== "ok" || s.user.plan === plano) return;
    // otimista: a tela troca na hora; o servidor confirma (e cria a conta Duo se faltar)
    definirSessao({ ...s, user: { ...s.user, plan: plano } });
    api.post<{ user: UsuarioApi; accounts: ContaApi[] }>("/me/plan", { plan: plano })
      .then(({ user, accounts }) => {
        const atual = lerSessao();
        if (atual.status === "ok") definirSessao({ ...atual, user, accounts });
      })
      .catch((e) => {
        console.warn("[plano] não foi possível trocar", e);
        const atual = lerSessao();
        if (atual.status === "ok") definirSessao({ ...atual, user: { ...atual.user, plan: s.user.plan } });
      });
    return;
  }
  try {
    localStorage.setItem(PLANO_KEY, plano);
  } catch {
    // segue só em memória
  }
  ouvintes.forEach((avisar) => avisar());
}

const assinar = (avisar: () => void) => {
  ouvintes.add(avisar);
  const naOutraAba = (e: StorageEvent) => { if (e.key === PLANO_KEY) avisar(); };
  addEventListener("storage", naOutraAba);
  return () => {
    ouvintes.delete(avisar);
    removeEventListener("storage", naOutraAba);
  };
};

const usePlanoLocal = () => useSyncExternalStore(assinar, lerPlano, () => "duo" as Plano);
const usePlanoApi = (): Plano => {
  const s = useSessao();
  return s.status === "ok" && s.user.plan === "duo" ? "duo" : "solo";
};

// MODO_API é constante de build: o mesmo hook é usado em toda renderização.
export const usePlano = MODO_API ? usePlanoApi : usePlanoLocal;
