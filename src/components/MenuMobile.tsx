import { Bell, ChevronRight, Download, Eye, EyeOff, Moon, PanelLeft, Sun, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDialogo } from "../hooks/useDialogo";
import type { Tema } from "../types";
import type { DockNavItem } from "./Dock";
import { AvatarPadrao } from "./Topbar";

/** O que a Topbar mostra; no celular ela some e isso passa a viver no menu. */
export interface MenuConta {
  nome: string;
  conta: string;
  avatar?: ReactNode;
  perfilHref: string;
  periodo: string;
  limitePct: number;
  tema: Tema;
  onToggleTheme: (botao: HTMLElement) => void;
  notificacoes: { novas: number; onAbrir: () => void };
}

interface Props {
  destinos: DockNavItem[];
  conta?: MenuConta;
  drawerOn: boolean;
  privado: boolean;
  csv: boolean;
  onFechar: () => void;
  onTogglePainel?: () => void;
  onTogglePrivacidade?: () => void;
  onExportarCsv?: () => void;
}

// Menu de tela cheia do celular: substitui a Topbar (conta, tema, sino) e a
// antiga folha "Mais", reunindo todos os destinos e ações num lugar só.
export function MenuMobile({ destinos, conta, drawerOn, privado, csv, onFechar, onTogglePainel, onTogglePrivacidade, onExportarCsv }: Props) {
  const caixaRef = useDialogo<HTMLDivElement>(true);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", fechar);
    // a página por trás não rola enquanto o menu cobre a tela
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fechar);
      document.body.style.overflow = antes;
    };
  }, [onFechar]);

  const acao = (fn?: () => void) => () => { onFechar(); fn?.(); };
  const escuro = conta?.tema === "escuro";

  return (
    <div className="menu-m" ref={caixaRef} role="dialog" aria-modal="true" aria-label="Menu">
      <div className="menu-m__topo">
        <img className="menu-m__logo" src="/assets/mimo-logo.png" alt="Mimo" />
        <button type="button" className="menu-m__fechar" aria-label="Fechar menu" onClick={onFechar}><X /></button>
      </div>

      <div className="menu-m__corpo">
        {conta && (
          <>
            <Link className="menu-m__conta" to={conta.perfilHref} onClick={onFechar}>
              <span className="menu-m__avatar">{conta.avatar ?? <AvatarPadrao />}</span>
              <span className="menu-m__nome">
                <strong>{conta.nome}</strong>
                <span>{conta.conta} · {conta.periodo} · limite {conta.limitePct}%</span>
              </span>
              <ChevronRight className="menu-m__seta" />
            </Link>

            <div className="menu-m__atalhos">
              <button type="button" className="menu-m__atalho" aria-label={conta.notificacoes.novas ? `Notificações, ${conta.notificacoes.novas} novas` : undefined} onClick={acao(conta.notificacoes.onAbrir)}>
                <span className="menu-m__icone">
                  <Bell />
                  {conta.notificacoes.novas > 0 && <b className="menu-m__badge" aria-hidden="true">{conta.notificacoes.novas}</b>}
                </span>
                Notificações
              </button>
              <button type="button" className="menu-m__atalho" aria-pressed={escuro} onClick={(e) => conta.onToggleTheme(e.currentTarget)}>
                <span className="menu-m__icone">{escuro ? <Moon /> : <Sun />}</span>
                {escuro ? "Tema escuro" : "Tema claro"}
              </button>
            </div>
          </>
        )}

        <div className="menu-m__secao">Navegar</div>
        <nav className="menu-m__lista" aria-label="Destinos">
          {destinos.map((d) => (
            <button key={d.id} type="button" className={`menu-m__item${d.on ? " is-on" : ""}`} aria-current={d.on ? "page" : undefined} onClick={acao(d.onClick)}>
              <span className="menu-m__icone">{d.icon}</span>
              <span className="menu-m__rotulo">{d.label}</span>
              <ChevronRight className="menu-m__seta" />
            </button>
          ))}
        </nav>

        <div className="menu-m__secao">Ferramentas</div>
        <div className="menu-m__lista">
          {onTogglePainel && (
            <button type="button" className={`menu-m__item${drawerOn ? " is-on" : ""}`} aria-pressed={drawerOn} onClick={acao(onTogglePainel)}>
              <span className="menu-m__icone"><PanelLeft /></span>
              <span className="menu-m__rotulo">{drawerOn ? "Fechar resumo do mês" : "Resumo do mês"}</span>
            </button>
          )}
          {onTogglePrivacidade && (
            <button type="button" className={`menu-m__item${privado ? " is-on" : ""}`} aria-pressed={privado} onClick={onTogglePrivacidade}>
              <span className="menu-m__icone">{privado ? <EyeOff /> : <Eye />}</span>
              <span className="menu-m__rotulo">{privado ? "Mostrar valores" : "Ocultar valores"}</span>
            </button>
          )}
          {csv && (
            <button type="button" className="menu-m__item" onClick={acao(onExportarCsv)}>
              <span className="menu-m__icone"><Download /></span>
              <span className="menu-m__rotulo">Exportar CSV</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
