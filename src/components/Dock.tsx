import {
  ArrowLeftRight, Download, Eye, EyeOff, LayoutDashboard, PanelLeft, PieChart, Plus,
} from "lucide-react";
import type { View } from "../types";

interface Props {
  view: View;
  drawerOn: boolean;
  privado: boolean;
  onIr: (view: View) => void;
  onTogglePainel: () => void;
  onTogglePrivacidade: () => void;
  onExportarCsv: () => void;
  onNova: () => void;
}

export function Dock({ view, drawerOn, privado, onIr, onTogglePainel, onTogglePrivacidade, onExportarCsv, onNova }: Props) {
  return (
    <div className="dock-wrap">
      <nav className="dock" aria-label="Navegação principal">
        <div className="dock__slot">
          <span className="dock__tip">Visão geral</span>
          <button className={`dock__button${view === "geral" ? " is-on" : ""}`} type="button" title="Visão geral" aria-label="Visão geral" onClick={() => onIr("geral")}>
            <LayoutDashboard />
          </button>
        </div>
        <div className="dock__slot">
          <span className="dock__tip">Movimentações</span>
          <button className={`dock__button${view === "lista" ? " is-on" : ""}`} type="button" title="Movimentações" aria-label="Movimentações" onClick={() => onIr("lista")}>
            <ArrowLeftRight />
          </button>
        </div>
        <div className="dock__slot">
          <span className="dock__tip">Categorias</span>
          <button className={`dock__button${view === "categorias" ? " is-on" : ""}`} type="button" title="Categorias" aria-label="Categorias" onClick={() => onIr("categorias")}>
            <PieChart />
          </button>
        </div>

        <span className="dock__sep" />

        <div className="dock__slot">
          <span className="dock__tip">{drawerOn ? "Recolher painel" : "Expandir painel"}</span>
          <button className={`dock__button${drawerOn ? " is-on" : ""}`} type="button" title="Painel lateral" aria-label="Painel lateral" onClick={onTogglePainel}>
            <PanelLeft />
          </button>
        </div>
        <div className="dock__slot">
          <span className="dock__tip">{privado ? "Mostrar valores" : "Ocultar valores"}</span>
          <button className={`dock__button${privado ? " is-on" : ""}`} type="button" title="Ocultar valores" aria-label="Ocultar valores" onClick={onTogglePrivacidade}>
            <Eye className="icone-visivel" />
            <EyeOff className="icone-oculto" />
          </button>
        </div>
        <div className="dock__slot">
          <span className="dock__tip">Exportar CSV</span>
          <button className="dock__button" type="button" title="Exportar CSV" aria-label="Exportar CSV" onClick={onExportarCsv}>
            <Download />
          </button>
        </div>
        <div className="dock__slot">
          <span className="dock__tip">Nova movimentação</span>
          <button className="dock__button dock__button--primary" type="button" title="Nova movimentação" aria-label="Nova movimentação" onClick={onNova}>
            <Plus />
          </button>
        </div>
      </nav>
    </div>
  );
}
