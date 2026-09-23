import { useEffect } from "react";
import { Dock } from "./components/Dock";
import { Drawer } from "./components/Drawer";
import { MascotDefs } from "./components/MascotDefs";
import { ModalExcluir } from "./components/ModalExcluir";
import { ModalForm } from "./components/ModalForm";
import { Preloader } from "./components/Preloader";
import { Toasts } from "./components/Toasts";
import { Topbar } from "./components/Topbar";
import { ViewCategorias } from "./components/ViewCategorias";
import { ViewGeral } from "./components/ViewGeral";
import { ViewLista } from "./components/ViewLista";
import { useMimoApp } from "./hooks/useMimoApp";
import { aplicarChartDefaults } from "./lib/chartDefaults";
import { MESES_LONGOS } from "./lib/helpers";

export default function App() {
  const { state, derivado, limites, fmt, toasts, ronronando, coracoes, actions } = useMimoApp();

  // Fontes/cor padrão dos gráficos; reaplicado quando o tema muda porque os
  // tokens de cor do CSS mudam de valor (equivalente ao trocarTema() original).
  useEffect(() => { aplicarChartDefaults(); }, [state.tema]);

  const [ano, mes] = state.mesRef.split("-");
  const periodo = `${MESES_LONGOS[Number(mes) - 1]} de ${ano}`;

  return (
    <>
      <MascotDefs />
      <Preloader />

      <div className="app">
        <Topbar
          periodo={periodo}
          limitePct={derivado.limitePct}
          drawerOn={state.drawer}
          onToggleDrawer={actions.alternarPainel}
          tema={state.tema}
          onToggleTheme={actions.alternarTema}
        />

        <div className="shell">
          <Drawer
            aberto={state.drawer}
            leaving={state.drawerLeaving}
            derivado={derivado}
            fmt={fmt}
            privado={state.privado}
            onEditar={actions.abrirEdicao}
          />

          <main className="main">
            {state.view === "geral" && (
              <ViewGeral
                mesRef={state.mesRef}
                derivado={derivado}
                fmt={fmt}
                privado={state.privado}
                tema={state.tema}
                limites={limites}
                flip={state.flip}
                ronronando={ronronando}
                coracoes={coracoes}
                onAnteriorMes={() => actions.andarMes(-1)}
                onProximoMes={() => actions.andarMes(1)}
                onHojeMes={actions.irParaHoje}
                onVerarCartao={actions.virarCartao}
                onRonronar={actions.ronronar}
                onVerTodas={() => actions.irPara("lista")}
              />
            )}

            {state.view === "lista" && (
              <ViewLista
                derivado={derivado}
                itensTotal={state.itens.length}
                tipoFiltro={state.tipoFiltro}
                statusFiltro={state.statusFiltro}
                query={state.query}
                fmt={fmt}
                onQuery={actions.setBusca}
                onFiltroTipo={(tipoFiltro) => actions.setFiltro({ tipoFiltro })}
                onFiltroStatus={(statusFiltro) => actions.setFiltro({ statusFiltro })}
                onEditar={actions.abrirEdicao}
                onExcluir={actions.pedirExclusao}
                onPaginaAnterior={actions.paginaAnterior}
                onPaginaProxima={actions.paginaProxima}
              />
            )}

            {state.view === "categorias" && (
              <ViewCategorias
                mesRef={state.mesRef}
                derivado={derivado}
                fmt={fmt}
                limites={limites}
                onAnteriorMes={() => actions.andarMes(-1)}
                onProximoMes={() => actions.andarMes(1)}
                onHojeMes={actions.irParaHoje}
              />
            )}
          </main>
        </div>

        <Dock
          view={state.view}
          drawerOn={state.drawer}
          privado={state.privado}
          onIr={actions.irPara}
          onTogglePainel={actions.alternarPainel}
          onTogglePrivacidade={actions.alternarPrivacidade}
          onExportarCsv={actions.exportarCsv}
          onNova={actions.abrirNova}
        />

        <Toasts toasts={toasts} />

        <ModalForm
          aberto={state.modal}
          editando={Boolean(state.editando)}
          form={state.form}
          erro={state.erro}
          fmt={fmt}
          onFechar={actions.fecharModal}
          onSalvar={actions.salvar}
          onSetForm={actions.setForm}
        />

        <ModalExcluir
          item={state.excluir}
          fmt={fmt}
          onManter={actions.cancelarExclusao}
          onConfirmar={actions.confirmarExclusao}
        />
      </div>
    </>
  );
}
