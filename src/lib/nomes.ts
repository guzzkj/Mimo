import { MODO_API } from "./modo";
import { contaDoTipo, lerSessao } from "./sessao";

// Nomes mostrados nas telas Duo. O protótipo usa a dupla de exemplo
// (Gustavo e Suelen); o backend real usa quem está logado e o par da conta.
// No Duo, o slot "gustavo" é sempre quem está logado e "suelen" é o par.

export interface NomesDuo {
  eu: string;
  /** Nome do par, ou "seu par" enquanto ninguém aceitou o convite. */
  par: string;
  iniEu: string;
  iniPar: string;
}

const inicial = (nome: string) => (nome.trim()[0] ?? "?").toUpperCase();

export function nomesDuo(): NomesDuo {
  if (!MODO_API) return { eu: "Gustavo", par: "Suelen", iniEu: "G", iniPar: "S" };
  const s = lerSessao();
  const eu = s.status === "ok" ? s.user.name.trim().split(/\s+/)[0] || "Você" : "Você";
  const par = contaDoTipo("duo", s)?.members.find((m) => !m.isMe)?.name.trim().split(/\s+/)[0] || "seu par";
  return { eu, par, iniEu: inicial(eu), iniPar: par === "seu par" ? "?" : inicial(par) };
}

/** Primeira letra maiúscula (para começo de frase: "Seu par recebeu..."). */
export const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
