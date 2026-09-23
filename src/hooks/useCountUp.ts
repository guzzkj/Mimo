import { useEffect, useRef, type RefObject } from "react";
import { DURACAO_CONTAGEM } from "../lib/constants";

interface Estado {
  valor: number;
  id: number;
}

/**
 * Anima a troca de um valor em dinheiro, contando do anterior até o novo,
 * escrevendo direto em el.textContent (fora do ciclo de render do React,
 * como no escreverValor() original) para não perder performance a cada frame.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  valor: number,
  fmt: (v: number) => string,
  privado: boolean,
) {
  const anterior = useRef<Estado | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prev = anterior.current;
    if (prev && prev.id) cancelAnimationFrame(prev.id);

    const de = prev ? prev.valor : valor;
    const direto = privado || de === valor;

    if (direto) {
      anterior.current = { valor, id: 0 };
      el.textContent = fmt(valor);
      return;
    }

    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / DURACAO_CONTAGEM);
      const suave = 1 - (1 - t) ** 3;
      el.textContent = fmt(de + (valor - de) * suave);
      anterior.current = { valor, id: t < 1 ? requestAnimationFrame(passo) : 0 };
    };
    anterior.current = { valor, id: requestAnimationFrame(passo) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, privado]);
}
