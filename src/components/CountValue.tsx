import { useRef } from "react";
import { useCountUp } from "../hooks/useCountUp";

interface Props {
  id?: string;
  className?: string;
  valor: number;
  fmt: (v: number) => string;
  privado: boolean;
  /** Algumas regras do CSS legado miram a tag (ex: `.stat strong`), não uma
   * classe — por isso é possível escolher o elemento renderizado. */
  as?: "span" | "strong" | "b";
}

// Elemento cujo conteúdo textual conta do valor anterior até o novo (paridade
// com escreverValor() do app.js), em vez de trocar de golpe a cada render.
export function CountValue({ id, className, valor, fmt, privado, as: Tag = "span" }: Props) {
  const ref = useRef<HTMLElement>(null);
  useCountUp(ref, valor, fmt, privado);
  return (
    <Tag id={id} className={className} ref={ref as never}>{fmt(valor)}</Tag>
  );
}
