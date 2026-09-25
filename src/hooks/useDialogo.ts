import { useEffect, useRef } from "react";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo acessível: ao abrir, foca o primeiro campo; Tab e Shift+Tab ficam
// presos dentro dele; ao fechar, o foco volta para quem abriu.
export function useDialogo<T extends HTMLElement>(aberto: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const caixa = ref.current;
    const focaveis = () => (caixa ? [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null) : []);

    // depois da animação de entrada começar, para o foco não "pular" a tela
    const id = window.setTimeout(() => {
      const lista = focaveis();
      const campo = lista.find((el) => el.matches("input, select, textarea")) ?? lista[0];
      campo?.focus({ preventScroll: true });
    }, 30);

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const lista = focaveis();
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      else if (!caixa?.contains(document.activeElement)) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", aoTeclar);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", aoTeclar);
      if (anterior && document.contains(anterior)) anterior.focus({ preventScroll: true });
    };
  }, [aberto]);

  return ref;
}
