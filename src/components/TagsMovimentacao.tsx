import { CreditCard, Repeat } from "lucide-react";
import type { Item } from "../types";

// Marcadores ao lado da descrição: parcela (3/10), compra no cartão e conta
// recorrente. Só aparece o que se aplica; sem nenhum, não renderiza nada.
export function TagsMovimentacao({ item }: { item: Item }) {
  const { parcela, meio, recorrente } = item;
  if (!parcela && meio !== "cartao" && !recorrente) return null;
  return (
    <span className="tags-mini">
      {parcela && <span className="tag-mini" title={`Parcela ${parcela.n} de ${parcela.total}`}>{`${parcela.n}/${parcela.total}`}</span>}
      {meio === "cartao" && <span className="tag-mini tag-mini--cartao" title="Pago no cartão de crédito"><CreditCard aria-hidden="true" />Cartão</span>}
      {recorrente && <span className="tag-mini" title="Repete todo mês"><Repeat aria-hidden="true" />Mensal</span>}
    </span>
  );
}
