import { useSyncExternalStore } from "react";

// Tipo de conta escolhido no onboarding (solo ou duo). Sem backend: fica no
// navegador e é compartilhado entre Acesso, Duo e Metas e Configurações.

export type Plano = "solo" | "duo";

const PLANO_KEY = "mimo.plano";
const ouvintes = new Set<() => void>();

export const lerPlano = (): Plano => {
  try {
    return localStorage.getItem(PLANO_KEY) === "solo" ? "solo" : "duo";
  } catch {
    return "duo";
  }
};

export function salvarPlano(plano: Plano) {
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

export const usePlano = () => useSyncExternalStore(assinar, lerPlano, () => "duo" as Plano);
