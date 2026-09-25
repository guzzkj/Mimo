import { useCallback, useEffect, useRef } from "react";

// Timeouts que morrem junto com a tela (equivalente ao this.later do protótipo).
export function useTimers() {
  const lista = useRef<number[]>([]);
  useEffect(() => () => { lista.current.forEach((id) => window.clearTimeout(id)); }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    lista.current.push(window.setTimeout(fn, ms));
  }, []);
  const limpar = useCallback(() => {
    lista.current.forEach((id) => window.clearTimeout(id));
    lista.current = [];
  }, []);
  return { later, limpar };
}
