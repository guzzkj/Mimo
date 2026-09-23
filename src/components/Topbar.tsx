import { Moon, PanelLeftOpen, Sun } from "lucide-react";
import type { Tema } from "../types";

interface Props {
  periodo: string;
  limitePct: number;
  drawerOn: boolean;
  onToggleDrawer: () => void;
  tema: Tema;
  onToggleTheme: (botao: HTMLElement) => void;
}

export function Topbar({ periodo, limitePct, drawerOn, onToggleDrawer, tema, onToggleTheme }: Props) {
  const rotuloTema = tema === "escuro" ? "Usar tema claro" : "Usar tema escuro";

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img className="topbar__logo" src="/assets/mimo-logo.png" alt="Mimo" />
        <button
          className={`drawer-toggle${drawerOn ? " is-on" : ""}`}
          type="button"
          title="Expandir painel lateral"
          aria-expanded={drawerOn}
          aria-controls="painel"
          onClick={onToggleDrawer}
        >
          <PanelLeftOpen />
          <span>{drawerOn ? "Recolher painel" : "Expandir painel"}</span>
        </button>
      </div>

      <div className="topbar__meta">
        <span className="topbar__period">{periodo}</span>
        <div className="topbar__limit">
          <span className="eyebrow">Limite</span>
          <b>{limitePct}%</b>
        </div>
        <button
          className="theme-toggle"
          type="button"
          title={rotuloTema}
          aria-label={rotuloTema}
          onClick={(e) => onToggleTheme(e.currentTarget)}
        >
          <Sun className="icone-sol" />
          <Moon className="icone-lua" />
        </button>

        <div className="topbar__user">
          <div className="topbar__name">
            <strong>Vitor Gomes</strong>
            <span>Conta pessoal</span>
          </div>
          <span className="topbar__avatar">
            <svg width="46" height="46" viewBox="0 0 46 46" role="img" aria-label="Foto de perfil">
              <rect width="46" height="46" fill="#cfd6ea" />
              <circle cx="23" cy="18" r="7.6" fill="#8e99bd" />
              <path d="M6.5 46c1.6-9.4 8.6-14.4 16.5-14.4S38 36.6 39.5 46z" fill="#8e99bd" />
            </svg>
          </span>
        </div>
      </div>
    </header>
  );
}
