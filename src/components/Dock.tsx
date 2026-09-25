import {
  ArrowLeftRight, Download, Eye, EyeOff, LayoutDashboard, MoreHorizontal, PanelLeft, PieChart, Plus, Settings, Target, TrendingUp, Users, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { usePlano } from "../lib/plano";
import type { View } from "../types";

/** Destino de navegação do dock; `extra` sai do dock no mobile e vai para "Mais". */
export interface DockNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  on: boolean;
  onClick: () => void;
  extra?: boolean;
  primary?: boolean;
}

const slot = (n: DockNavItem) => (
  <div key={n.id} className={`dock__slot${n.extra ? " dock__slot--extra" : ""}`}>
    <span className="dock__tip">{n.label}</span>
    <button className={`dock__button${n.primary ? " dock__button--primary" : ""}${n.on ? " is-on" : ""}`} type="button" title={n.label} aria-label={n.label} aria-current={n.on ? "page" : undefined} onClick={n.onClick}>
      {n.icon}
    </button>
  </div>
);

interface Props {
  view?: View;
  /** Substitui os destinos do painel Solo (usado pela conta Duo). */
  nav?: DockNavItem[];
  /** Substitui as ações à direita do separador (painel, privacidade, CSV, nova). */
  ferramentas?: DockNavItem[];
  /** Leva o "Exportar CSV" para "Mais" no mobile (padrão), para o dock caber. */
  csvSoDesktop?: boolean;
  drawerOn?: boolean;
  privado?: boolean;
  onIr?: (view: View) => void;
  onTogglePainel?: () => void;
  onTogglePrivacidade?: () => void;
  onExportarCsv?: () => void;
  onNova?: () => void;
}

export function Dock({
  view, nav, ferramentas, csvSoDesktop = true, drawerOn = false, privado = false, onIr, onTogglePainel, onTogglePrivacidade, onExportarCsv, onNova,
}: Props) {
  const navigate = useNavigate();
  const plano = usePlano();
  const [mais, setMais] = useState(false);

  useEffect(() => {
    if (!mais) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") setMais(false); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [mais]);

  // Painel Solo: os mesmos destinos, montados aqui quando a tela não passa `nav`.
  const destinos: DockNavItem[] = nav ?? [
    { id: "geral", label: "Visão geral", icon: <LayoutDashboard />, on: view === "geral", onClick: () => onIr?.("geral") },
    { id: "lista", label: "Movimentações", icon: <ArrowLeftRight />, on: view === "lista", onClick: () => onIr?.("lista") },
    { id: "categorias", label: "Categorias", icon: <PieChart />, on: view === "categorias", onClick: () => onIr?.("categorias") },
    ...(plano === "duo" ? [{ id: "casal", label: "Visão do casal", icon: <Users />, on: false, extra: true, onClick: () => navigate("/duo") }] : []),
    { id: "metas", label: "Metas", icon: <Target />, on: false, extra: true, onClick: () => navigate("/metas") },
    { id: "investimentos", label: "Investimentos", icon: <TrendingUp />, on: false, extra: true, onClick: () => navigate("/investimentos") },
    { id: "config", label: "Configurações", icon: <Settings />, on: false, extra: true, onClick: () => navigate("/ajustes") },
  ];

  // No celular, o que é "extra" (e o CSV, quando pedido) vai para a folha "Mais".
  const extras = destinos.filter((d) => d.extra);
  const csvNoMais = !ferramentas && csvSoDesktop;
  const maisAtivo = extras.some((d) => d.on);

  return (
    <>
      <div className="dock-wrap">
        <nav className="dock" aria-label="Navegação principal">
          {destinos.map(slot)}
          {extras.length > 0 && (
            <div className="dock__slot dock__slot--mais">
              <span className="dock__tip">Mais</span>
              <button className={`dock__button${mais || maisAtivo ? " is-on" : ""}`} type="button" title="Mais" aria-label="Mais opções" aria-expanded={mais} aria-haspopup="dialog" onClick={() => setMais((m) => !m)}>
                <MoreHorizontal />
              </button>
            </div>
          )}

          <span className="dock__sep" />

          {ferramentas ? ferramentas.map(slot) : (
            <>
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
              <div className={`dock__slot${csvSoDesktop ? " dock__slot--extra" : ""}`}>
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
            </>
          )}
        </nav>
      </div>

      {mais && (
        <div className="dock-mais" onClick={(e) => { if (e.target === e.currentTarget) setMais(false); }}>
          <div className="dock-mais__folha" role="dialog" aria-modal="true" aria-label="Mais opções">
            <div className="dock-mais__topo">
              <strong>Mais</strong>
              <button type="button" className="dock-mais__fechar" aria-label="Fechar" onClick={() => setMais(false)}><X /></button>
            </div>
            <div className="dock-mais__grade">
              {extras.map((d) => (
                <button key={d.id} type="button" className={`dock-mais__item${d.on ? " is-on" : ""}`} aria-current={d.on ? "page" : undefined} onClick={() => { setMais(false); d.onClick(); }}>
                  <span>{d.icon}</span>{d.label}
                </button>
              ))}
              {csvNoMais && (
                <button type="button" className="dock-mais__item" onClick={() => { setMais(false); onExportarCsv?.(); }}>
                  <span><Download /></span>Exportar CSV
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
