import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  className?: string;
  label: string;
  desabilitarAnterior: boolean;
  desabilitarProximo: boolean;
  mostrarHoje: boolean;
  onAnterior: () => void;
  onProximo: () => void;
  onHoje: () => void;
}

// Seletor de mês: existe duas vezes na página (visão geral e categorias),
// controlando o mesmo state.mesRef — igual ao original via data-mes.
export function MonthNav({
  className = "", label, desabilitarAnterior, desabilitarProximo, mostrarHoje, onAnterior, onProximo, onHoje,
}: Props) {
  return (
    <div className={`mes-nav ${className}`.trim()}>
      <button
        className="mes-nav__seta"
        type="button"
        title="Mês anterior"
        aria-label="Mês anterior"
        disabled={desabilitarAnterior}
        onClick={onAnterior}
      >
        <ChevronLeft />
      </button>
      <span className="mes-nav__label">{label}</span>
      <button
        className="mes-nav__seta"
        type="button"
        title="Próximo mês"
        aria-label="Próximo mês"
        disabled={desabilitarProximo}
        onClick={onProximo}
      >
        <ChevronRight />
      </button>
      {mostrarHoje && (
        <button className="mes-nav__hoje" type="button" onClick={onHoje}>Hoje</button>
      )}
    </div>
  );
}
