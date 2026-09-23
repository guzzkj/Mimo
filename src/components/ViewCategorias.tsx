import type { CSSProperties } from "react";
import { MESES_LONGOS } from "../lib/helpers";
import type { Derivado } from "../types";
import { MonthNav } from "./MonthNav";

interface Props {
  mesRef: string;
  derivado: Derivado;
  fmt: (v: number) => string;
  limites: { primeiro: string; ultimo: string };
  onAnteriorMes: () => void;
  onProximoMes: () => void;
  onHojeMes: () => void;
}

export function ViewCategorias({ mesRef, derivado: d, fmt, limites, onAnteriorMes, onProximoMes, onHojeMes }: Props) {
  const taxa = d.entradas ? Math.round((d.resultado / d.entradas) * 100) : 0;
  const [anoRef, mesNumero] = mesRef.split("-").map(Number);
  const rotuloMes = `${MESES_LONGOS[mesNumero - 1]} de ${anoRef}`;

  const indicadores = [
    { label: "Gasto médio", valor: fmt(d.gastoMedio), cor: "#ffffff", nota: "por lançamento de saída" },
    { label: "Maior saída", valor: fmt(d.maiorSaida ? d.maiorSaida.valor : 0), cor: "#ffb3c2", nota: d.maiorSaida ? d.maiorSaida.descricao : "sem saídas no mês" },
    { label: "Taxa de sobra", valor: `${taxa}%`, cor: "#8ce6cf", nota: "do total que entrou" },
    { label: "Total a pagar", valor: fmt(d.aPagar), cor: "#f4d79a", nota: `${d.pendentes.length} em aberto` },
  ];

  return (
    <section className="view view--categories" aria-label="Categorias">
      <div className="kpis">
        <div className="mascote mascote--categorias">
          <svg viewBox="0 0 320 300" aria-hidden="true"><use href="#mimo-gato-curioso" /></svg>
          <span className="mascote__pergunta" aria-hidden="true">?</span>
        </div>
        <div className="kpis__inner">
          {indicadores.map(({ label, valor, cor, nota }) => (
            <div className="kpi" key={label}>
              <span className="kpi__label">{label}</span>
              <span className="kpi__value" style={{ color: cor }}>{valor}</span>
              <span className="kpi__note">{nota}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="section__title" style={{ margin: "34px 0 14px" }}>Saídas por categoria</h2>

      <MonthNav
        label={rotuloMes}
        desabilitarAnterior={mesRef <= limites.primeiro}
        desabilitarProximo={mesRef >= limites.ultimo}
        mostrarHoje={!d.ehMesAtual}
        onAnterior={onAnteriorMes}
        onProximo={onProximoMes}
        onHoje={onHojeMes}
      />

      <div>
        {d.categorias.map(({ nome, valor, cor }, indice) => {
          const n = d.mes.filter((i) => i.tipo === "saida" && i.categoria === nome).length;
          const p = Math.round((valor / d.totalCategorias) * 100);
          return (
            <div className="cat-row" style={{ "--i": indice } as CSSProperties} key={nome}>
              <div className="cat-row__main">
                <span className="cat-row__name"><i style={{ background: cor }} />{nome}</span>
                <span className="cat-row__detail">{`${n} ${n === 1 ? "lançamento neste mês" : "lançamentos neste mês"}`}</span>
                <div className="cat-row__track"><div className="cat__fill" style={{ width: `${p}%`, background: cor }} /></div>
              </div>
              <span className="cat-row__value">{fmt(valor)}</span>
              <span className="cat-row__pct">{`${p}%`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
