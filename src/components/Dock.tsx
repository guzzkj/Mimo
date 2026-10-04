import {
  ArrowLeftRight, Eye, EyeOff, LayoutDashboard, Menu, PanelLeft, PieChart, Plus, Settings, Target, TrendingUp,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { View } from "../types";
import { MenuMobile, type MenuConta } from "./MenuMobile";

/** Destino de navegação do dock; `extra` sai do dock no mobile e fica só no menu. */
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
  /** Substitui as ações à direita do separador (painel, privacidade, nova). */
  ferramentas?: DockNavItem[];
  drawerOn?: boolean;
  privado?: boolean;
  onIr?: (view: View) => void;
  onTogglePainel?: () => void;
  onTogglePrivacidade?: () => void;
  onNova?: () => void;
  /** Conta e sino: no celular a Topbar some e eles vão para o menu. */
  menu?: MenuConta;
}

export function Dock({
  view, nav, ferramentas, drawerOn = false, privado = false, onIr, onTogglePainel, onTogglePrivacidade, onNova, menu,
}: Props) {
  const navigate = useNavigate();
  const [mais, setMais] = useState(false);
  const fecharMenu = useCallback(() => setMais(false), []);

  // Painel Solo: os mesmos destinos, montados aqui quando a tela não passa `nav`.
  const destinos: DockNavItem[] = nav ?? [
    { id: "geral", label: "Visão geral", icon: <LayoutDashboard />, on: view === "geral", onClick: () => onIr?.("geral") },
    { id: "lista", label: "Movimentações", icon: <ArrowLeftRight />, on: view === "lista", onClick: () => onIr?.("lista") },
    { id: "categorias", label: "Categorias", icon: <PieChart />, on: view === "categorias", onClick: () => onIr?.("categorias") },
    { id: "metas", label: "Metas", icon: <Target />, on: false, extra: true, onClick: () => navigate("/metas") },
    { id: "investimentos", label: "Investimentos", icon: <TrendingUp />, on: false, extra: true, onClick: () => navigate("/investimentos") },
    { id: "config", label: "Configurações", icon: <Settings />, on: false, extra: true, onClick: () => navigate("/ajustes") },
  ];

  // No celular, o que é "extra" sai do dock e fica no menu.
  const maisAtivo = destinos.some((d) => d.extra && d.on);
  const novas = menu?.notificacoes.novas ?? 0;

  return (
    <>
      <div className="dock-wrap">
        <nav className="dock" aria-label="Navegação principal">
          {destinos.map(slot)}
          <div className="dock__slot dock__slot--mais">
            <span className="dock__tip">Menu</span>
            <button className={`dock__button${mais || maisAtivo ? " is-on" : ""}`} type="button" title="Menu" aria-label={novas ? `Menu, ${novas} notificações novas` : "Menu"} aria-expanded={mais} aria-haspopup="dialog" onClick={() => setMais((m) => !m)}>
              <Menu />
              {novas > 0 && <span className="dock__badge" aria-hidden="true" />}
            </button>
          </div>

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
        <MenuMobile
          destinos={destinos}
          conta={menu}
          drawerOn={drawerOn}
          privado={privado}
          onFechar={fecharMenu}
          onTogglePainel={ferramentas ? undefined : onTogglePainel}
          onTogglePrivacidade={ferramentas ? undefined : onTogglePrivacidade}
        />
      )}
    </>
  );
}
