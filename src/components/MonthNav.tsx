import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useDialogo } from "../hooks/useDialogo";
import { MESES } from "../lib/constants";

interface Props {
  className?: string;
  label: string;
  desabilitarAnterior: boolean;
  desabilitarProximo: boolean;
  mostrarHoje: boolean;
  onAnterior: () => void;
  onProximo: () => void;
  onHoje: () => void;
  /** Com os três, tocar no mês abre o calendário de mês e ano. */
  mesRef?: string;
  limites?: { primeiro: string; ultimo: string };
  onEscolher?: (mesRef: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Seletor de mês: existe duas vezes na página (visão geral e categorias),
// controlando o mesmo state.mesRef — igual ao original via data-mes.
export function MonthNav({
  className = "", label, desabilitarAnterior, desabilitarProximo, mostrarHoje, onAnterior, onProximo, onHoje,
  mesRef, limites, onEscolher,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const escolhe = mesRef && limites && onEscolher;

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
      {escolhe ? (
        <button
          className={`mes-nav__label mes-nav__label--botao${aberto ? " is-on" : ""}`}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-label={`${label}. Escolher mês e ano`}
          onClick={() => setAberto((a) => !a)}
        >
          {label}
          <ChevronDown aria-hidden="true" />
        </button>
      ) : (
        <span className="mes-nav__label">{label}</span>
      )}
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

      {escolhe && aberto && (
        <Calendario
          mesRef={mesRef}
          limites={limites}
          onEscolher={(alvo) => { setAberto(false); onEscolher(alvo); }}
          onFechar={() => setAberto(false)}
        />
      )}
    </div>
  );
}

interface CalendarioProps {
  mesRef: string;
  limites: { primeiro: string; ultimo: string };
  onEscolher: (mesRef: string) => void;
  onFechar: () => void;
}

// Grade de 12 meses com o ano em cima; meses fora do período com dados
// ficam desabilitados, como as setas.
function Calendario({ mesRef, limites, onEscolher, onFechar }: CalendarioProps) {
  const caixaRef = useDialogo<HTMLDivElement>(true);
  const anoMin = Number(limites.primeiro.slice(0, 4));
  const anoMax = Number(limites.ultimo.slice(0, 4));
  const [ano, setAno] = useState(() => Number(mesRef.slice(0, 4)));

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    // fecha ao tocar fora (o próprio botão do mês alterna, então fica de fora)
    const aoTocar = (e: PointerEvent) => {
      const alvo = e.target as Node;
      const nav = caixaRef.current?.parentElement;
      if (nav && !nav.contains(alvo)) onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoTocar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoTocar);
    };
  }, [caixaRef, onFechar]);

  return (
    <div className="mes-cal" ref={caixaRef} role="dialog" aria-label="Escolher mês e ano">
      <div className="mes-cal__topo">
        <button type="button" className="mes-cal__ano-seta" aria-label="Ano anterior" disabled={ano <= anoMin} onClick={() => setAno((a) => a - 1)}>
          <ChevronLeft />
        </button>
        <strong aria-live="polite">{ano}</strong>
        <button type="button" className="mes-cal__ano-seta" aria-label="Próximo ano" disabled={ano >= anoMax} onClick={() => setAno((a) => a + 1)}>
          <ChevronRight />
        </button>
      </div>
      <div className="mes-cal__grade">
        {MESES.map((nome, i) => {
          const alvo = `${ano}-${pad(i + 1)}`;
          const fora = alvo < limites.primeiro || alvo > limites.ultimo;
          const atual = alvo === mesRef;
          return (
            <button
              key={alvo}
              type="button"
              className={`mes-cal__mes${atual ? " is-on" : ""}`}
              aria-current={atual ? "date" : undefined}
              disabled={fora}
              onClick={() => onEscolher(alvo)}
            >
              {nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
