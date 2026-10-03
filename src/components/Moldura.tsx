import {
  ArrowLeftRight, LayoutDashboard, PieChart, Scale, Settings, Target, TrendingUp, User, Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { MimoApp } from "../hooks/useMimoApp";
import { MESES_LONGOS } from "../lib/helpers";
import { useNaoLidas, type ContaAtiva } from "../lib/notificacoes";
import { usePlano } from "../lib/plano";
import { maiuscula, nomesDuo } from "../lib/nomes";
import { aplicarEscolhaTema, useTemaTela } from "../lib/tema";
import { categoriasDe } from "../lib/ajustes";
import { grupoDe } from "../lib/derive";
import type { Autor } from "../types";
import { Dock, type DockNavItem } from "./Dock";
import { Drawer } from "./Drawer";
import { MascotDefs } from "./MascotDefs";
import { ModalExcluir } from "./ModalExcluir";
import { ModalForm } from "./ModalForm";
import { PainelNotificacoes } from "./PainelNotificacoes";
import { Toasts } from "./Toasts";
import { Topbar } from "./Topbar";

// Moldura comum das telas logadas fora do painel Solo (Duo, Metas,
// Configurações, Investimentos): a mesma Topbar do Solo em cima, o painel
// lateral de resumo e o dock embaixo, alimentados pelo motor da conta ativa.

export type DestinoDock =
  | "geral" | "lista" | "categorias"
  | "duo-geral" | "duo-movs" | "duo-divisao"
  | "metas" | "investimentos" | "config" | "nenhum";

// Iniciais e rótulo seguem os nomes da conta (quem está logado e o par).
function AvatarDuo({ eu, par, iniEu, iniPar }: { eu: string; par: string; iniEu: string; iniPar: string }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" role="img" aria-label={`${eu} e ${par}`}>
      <rect width="23" height="46" fill="#4e9e79" />
      <rect x="23" width="23" height="46" fill="#e2a24f" />
      <text x="12.5" y="27.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="Manrope, sans-serif">{iniEu}</text>
      <text x="33.5" y="27.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="Manrope, sans-serif">{iniPar}</text>
    </svg>
  );
}

interface Props {
  conta: ContaAtiva;
  app: MimoApp;
  ativo: DestinoDock;
  /** Trata a navegação de um destino na própria tela; devolve true se tratou. */
  onNavegar?: (destino: DestinoDock) => boolean;
  /** Chamado junto com o "ocultar valores" do motor, para a tela sincronizar o seu. */
  onPrivacidade?: () => void;
  autores?: { valor: Autor; label: string }[];
  /** Controle externo do painel de notificações (ex.: rota /notificacoes). */
  notif?: {
    aberto: boolean;
    onAberto: (aberto: boolean) => void;
    carregando?: boolean;
    gato?: { cor: string; tabby: boolean };
    onPreferencias?: () => void;
    onAceitarConvite?: () => void;
  };
  children: ReactNode;
}

export function Moldura({ conta, app, ativo, onNavegar, onPrivacidade, autores, notif, children }: Props) {
  const navigate = useNavigate();
  const plano = usePlano();
  const tema = useTemaTela();
  const naoLidas = useNaoLidas(conta);
  const [notifLocal, setNotifLocal] = useState(false);
  const notifAberto = notif ? notif.aberto : notifLocal;
  const setNotif = notif ? notif.onAberto : setNotifLocal;
  const duo = conta === "duo";

  const ir = (destino: DestinoDock, rota: string, state?: unknown) => {
    setNotif(false);
    if (onNavegar?.(destino)) return;
    navigate(rota, state ? { state } : undefined);
  };
  const item = (id: DestinoDock, label: string, icon: ReactNode, rota: string, extra: boolean, state?: unknown): DockNavItem => ({
    id, label, icon, on: ativo === id && !notifAberto, extra, onClick: () => ir(id, rota, state),
  });
  const soloView = (view: "geral" | "lista" | "categorias") => ({ view });

  const nav: DockNavItem[] = duo
    ? [
      item("duo-geral", "Visão geral", <LayoutDashboard />, "/duo", false),
      item("duo-movs", "Movimentações", <ArrowLeftRight />, "/duo/movimentacoes", false),
      item("duo-divisao", "Divisão", <Scale />, "/duo/divisao", false),
      // espelha o "Visão do casal" do dock Solo: volta para a visão Solo sem mexer na conta Duo
      { id: "solo", label: "Visão Solo", icon: <User />, on: false, extra: true, onClick: () => { setNotif(false); navigate("/", { state: soloView("geral") }); } },
      item("metas", "Metas", <Target />, "/metas", true),
      item("investimentos", "Investimentos", <TrendingUp />, "/investimentos", true),
      item("config", "Configurações", <Settings />, "/ajustes", true),
    ]
    : [
      item("geral", "Visão geral", <LayoutDashboard />, "/", false, soloView("geral")),
      item("lista", "Movimentações", <ArrowLeftRight />, "/", false, soloView("lista")),
      item("categorias", "Categorias", <PieChart />, "/", false, soloView("categorias")),
      ...(plano === "duo" ? [{ id: "casal", label: "Visão do casal", icon: <Users />, on: false, extra: true, onClick: () => { setNotif(false); navigate("/duo"); } }] : []),
      item("metas", "Metas", <Target />, "/metas", true),
      item("investimentos", "Investimentos", <TrendingUp />, "/investimentos", true),
      item("config", "Configurações", <Settings />, "/ajustes", true),
    ];

  const [ano, mes] = app.state.mesRef.split("-");
  const periodo = `${MESES_LONGOS[Number(mes) - 1]} de ${ano}`;
  const nd = nomesDuo();
  const identidade = duo ? { nome: nd.par === "seu par" ? nd.eu : `${nd.eu} e ${maiuscula(nd.par)}`, conta: "Conta Duo", avatar: <AvatarDuo eu={nd.eu} par={maiuscula(nd.par)} iniEu={nd.iniEu} iniPar={nd.iniPar} /> } : { nome: app.ajustes.nome };
  const alternarTema = (botao: HTMLElement) => aplicarEscolhaTema(tema === "escuro" ? "claro" : "escuro", botao);
  const alternarPrivacidade = () => { app.actions.alternarPrivacidade(); onPrivacidade?.(); };

  return (
    <>
      <MascotDefs />
      <div className="app">
        <Topbar
          periodo={periodo}
          limitePct={app.derivado.limitePct}
          drawerOn={app.state.drawer}
          onToggleDrawer={app.actions.alternarPainel}
          tema={tema}
          onToggleTheme={alternarTema}
          perfilHref="/ajustes/perfil"
          {...identidade}
          notificacoes={{ novas: naoLidas, aberto: notifAberto, onToggle: () => setNotif(!notifAberto) }}
        />

        <div className="shell">
          <Drawer
            aberto={app.state.drawer}
            leaving={app.state.drawerLeaving}
            derivado={app.derivado}
            fmt={app.fmt}
            privado={app.state.privado}
            onEditar={app.actions.abrirEdicao}
            onPagar={(id) => { app.actions.marcarPaga(id); app.avisar("Conta marcada como paga"); }}
          />
          <main className="main">{children}</main>
        </div>

        <Dock
          nav={nav}
          drawerOn={app.state.drawer}
          privado={app.state.privado}
          onTogglePainel={app.actions.alternarPainel}
          onTogglePrivacidade={alternarPrivacidade}
          onExportarCsv={app.actions.exportarCsv}
          onNova={app.actions.abrirNova}
          menu={{
            conta: "Conta pessoal",
            ...identidade,
            perfilHref: "/ajustes/perfil",
            periodo,
            limitePct: app.derivado.limitePct,
            notificacoes: { novas: naoLidas, onAbrir: () => setNotif(true) },
          }}
        />

        <Toasts toasts={app.toasts} />

        <ModalForm
          aberto={app.state.modal}
          editando={Boolean(app.state.editando)}
          grupo={grupoDe(app.state.itens, app.state.editando)}
          form={app.state.form}
          erro={app.state.erro}
          fmt={app.fmt}
          onFechar={app.actions.fecharModal}
          onSalvar={app.actions.salvar}
          onSetForm={app.actions.setForm}
          autores={autores}
          categorias={categoriasDe(app.ajustes)}
        />

        <ModalExcluir
          item={app.state.excluir}
          fmt={app.fmt}
          onManter={app.actions.cancelarExclusao}
          onConfirmar={app.actions.confirmarExclusao}
        />
      </div>

      <PainelNotificacoes
        conta={conta}
        aberto={notifAberto}
        onFechar={() => setNotif(false)}
        avisar={app.avisar}
        carregando={notif?.carregando}
        gato={notif?.gato}
        onPreferencias={notif?.onPreferencias}
        onAceitarConvite={notif?.onAceitarConvite}
        onPagar={app.actions.marcarPaga}
      />
    </>
  );
}
