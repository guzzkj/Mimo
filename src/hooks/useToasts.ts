import { useCallback, useRef, useState } from "react";
import { TOASTS_NA_TELA } from "../lib/constants";

export interface Toast {
  id: number;
  texto: string;
  rosto: string;
  saindo: boolean;
}

// Réplica de avisar()/toasts em app.js: fila limitada a três, cada aviso some
// sozinho depois de ~2.6s (mais uma pequena animação de saída).
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(1);

  const avisar = useCallback((texto: string, rosto = "#mimo-gato-feliz") => {
    const id = proximoId.current++;
    setToasts((atual) => {
      const restante = atual.length >= TOASTS_NA_TELA ? atual.slice(atual.length - TOASTS_NA_TELA + 1) : atual;
      return [...restante, { id, texto, rosto, saindo: false }];
    });

    setTimeout(() => {
      setToasts((atual) => atual.map((t) => (t.id === id ? { ...t, saindo: true } : t)));
      setTimeout(() => {
        setToasts((atual) => atual.filter((t) => t.id !== id));
      }, 320);
    }, 2600);
  }, []);

  return { toasts, avisar };
}
