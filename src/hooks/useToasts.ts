import { useCallback, useRef, useState } from "react";
import { TOASTS_NA_TELA } from "../lib/constants";

/** Ação opcional do aviso (ex.: "Desfazer"). */
export interface AcaoToast {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  texto: string;
  rosto: string;
  saindo: boolean;
  acao?: AcaoToast;
}

// Réplica de avisar()/toasts em app.js: fila limitada a três, cada aviso some
// sozinho depois de ~2.6s (mais uma pequena animação de saída). Aviso com ação
// fica ~5s na tela, para dar tempo de clicar.
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(1);

  const remover = useCallback((id: number) => {
    setToasts((atual) => atual.map((t) => (t.id === id ? { ...t, saindo: true } : t)));
    setTimeout(() => {
      setToasts((atual) => atual.filter((t) => t.id !== id));
    }, 320);
  }, []);

  const avisar = useCallback((texto: string, rosto = "#mimo-gato-feliz", acao?: AcaoToast) => {
    const id = proximoId.current++;
    const comAcao = acao ? { ...acao, onClick: () => { acao.onClick(); remover(id); } } : undefined;
    setToasts((atual) => {
      const restante = atual.length >= TOASTS_NA_TELA ? atual.slice(atual.length - TOASTS_NA_TELA + 1) : atual;
      return [...restante, { id, texto, rosto, saindo: false, acao: comAcao }];
    });
    setTimeout(() => remover(id), acao ? 5000 : 2600);
  }, [remover]);

  return { toasts, avisar };
}
