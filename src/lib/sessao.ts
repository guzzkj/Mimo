import { useSyncExternalStore } from "react";
import { api, ErroApi } from "./api";
import type { ContaApi, MeApi } from "./remoto/tipos";

// Sessão do backend real: quem está logado, as contas (Solo e Duo) e os
// convites recebidos. Fonte única para guarda de rotas, plano e motores.

export type Sessao =
  | { status: "carregando" }
  | { status: "anonimo" }
  | { status: "erro"; mensagem: string }
  | ({ status: "ok" } & MeApi);

let atual: Sessao = { status: "carregando" };
let pedido: Promise<Sessao> | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export const lerSessao = () => atual;

export function definirSessao(nova: Sessao) {
  atual = nova;
  avisar();
}

/** Busca /api/me. Chamadas simultâneas compartilham a mesma requisição. */
export function recarregarSessao(): Promise<Sessao> {
  if (pedido) return pedido;
  pedido = api.get<MeApi>("/me")
    .then((me) => ({ status: "ok", ...me }) as Sessao)
    .catch((e: unknown) => (e instanceof ErroApi && e.status === 401
      ? { status: "anonimo" } as Sessao
      : { status: "erro", mensagem: e instanceof Error ? e.message : "Erro ao carregar a sessão." } as Sessao))
    .then((s) => { pedido = null; definirSessao(s); return s; });
  return pedido;
}

export async function sair() {
  try { await api.post("/auth/logout"); } finally {
    definirSessao({ status: "anonimo" });
    // limpa caches de dados da pessoa (motores, ajustes, metas) recarregando o app
    location.assign("/acesso/login");
  }
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
};

export const useSessao = () => useSyncExternalStore(assinar, lerSessao, lerSessao);
export const assinarSessao = assinar;

/** Conta aberta do tipo pedido (a Duo encerrada não conta). */
export function contaDoTipo(kind: "solo" | "duo", s: Sessao = atual): ContaApi | null {
  if (s.status !== "ok") return null;
  return s.accounts.find((a) => a.kind === kind && !a.closed) ?? null;
}

/** Ids de quem está logado e do par (Duo) na conta. */
export function pessoasDaConta(conta: ContaApi | null, s: Sessao = atual) {
  const meId = s.status === "ok" ? s.user.id : "";
  const par = conta?.members.find((m) => !m.isMe) ?? null;
  return { meId, parId: par?.userId ?? null, parNome: par?.name ?? null };
}

/** Para onde mandar a pessoa depois de entrar, conforme o ponto em que ela parou. */
export function destinoAposLogin(s: Sessao): string {
  if (s.status !== "ok") return "/acesso/login";
  if (!s.user.emailVerified) return "/acesso/verificar";
  if (!s.user.onboarded) return "/acesso/plano";
  return s.user.plan === "duo" ? "/duo" : "/";
}
