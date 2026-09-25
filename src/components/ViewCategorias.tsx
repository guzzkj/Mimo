import { useState, type CSSProperties } from "react";
import { MESES, MESES_LONGOS, mesAnterior } from "../lib/helpers";
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
  /** Define (ou remove, com 0) o orçamento mensal de uma categoria. */
  onOrcamento?: (categoria: string, valor: number) => void;
  /** Abre Movimentações filtrada pela categoria. */
  onVerCategoria?: (categoria: string) => void;
}

const numero = (texto: string) => Number(texto.replace(/\./g, "").replace(",", ".")) || 0;

// Variação contra o mês anterior: ▲ gastou mais, ▼ gastou menos.
const delta = (atual: number, anterior: number) => {
  if (!anterior && !atual) return null;
  if (!anterior) return { texto: "novo", tom: "sobe" as const };
  const p = Math.round(((atual - anterior) / anterior) * 100);
  if (p === 0) return { texto: "igual", tom: "igual" as const };
  return { texto: `${p > 0 ? "▲" : "▼"} ${Math.abs(p)}%`, tom: p > 0 ? "sobe" as const : "desce" as const };
};

export function ViewCategorias({ mesRef, derivado: d, fmt, limites, onAnteriorMes, onProximoMes, onHojeMes, onOrcamento, onVerCategoria }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const salvarOrc = (nome: string) => { onOrcamento?.(nome, numero(rascunho)); setEditando(null); };
  const comOrc = d.categorias.filter((c) => c.orcamento > 0);
  const orcado = comOrc.reduce((t, c) => t + c.orcamento, 0);
  const gastoOrcado = comOrc.reduce((t, c) => t + c.valor, 0);
  const taxa = d.entradas ? Math.round((d.resultado / d.entradas) * 100) : 0;
  const [anoRef, mesNumero] = mesRef.split("-").map(Number);
  const rotuloMes = `${MESES_LONGOS[mesNumero - 1]} de ${anoRef}`;
  const mesAntCurto = MESES[Number(mesAnterior(mesRef).slice(5)) - 1];
  const maiorAumento = [...d.categorias].sort((a, b) => (b.valor - b.anterior) - (a.valor - a.anterior))[0];
  const subiu = maiorAumento && maiorAumento.valor - maiorAumento.anterior > 0 ? maiorAumento : null;

  const indicadores = [
    { label: "Maior aumento", valor: subiu ? `+ ${fmt(subiu.valor - subiu.anterior)}` : "—", cor: "#ffffff", nota: subiu ? `${subiu.nome} vs ${mesAntCurto}` : `nenhuma categoria subiu vs ${mesAntCurto}` },
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
      <p className="section__sub" style={{ margin: "-8px 0 14px" }}>{`Comparado com ${MESES_LONGOS[Number(mesAnterior(mesRef).slice(5)) - 1].toLowerCase()}. Clique numa categoria para ver os lançamentos.`}</p>

      <MonthNav
        label={rotuloMes}
        desabilitarAnterior={mesRef <= limites.primeiro}
        desabilitarProximo={mesRef >= limites.ultimo}
        mostrarHoje={!d.ehMesAtual}
        onAnterior={onAnteriorMes}
        onProximo={onProximoMes}
        onHoje={onHojeMes}
      />

      {comOrc.length > 0 && (
        <div className="orc-resumo">
          <span>Orçado <strong>{fmt(orcado)}</strong></span>
          <span>Gasto nessas categorias <strong className={gastoOrcado > orcado ? "is-over" : undefined}>{fmt(gastoOrcado)}</strong></span>
          <span>{d.estourados.length ? <b className="is-over">{`${d.estourados.length} acima do orçamento`}</b> : "Tudo dentro do planejado"}</span>
        </div>
      )}

      {!d.categorias.length && (
        <div className="cat-vazio">
          <div className="mascote mascote--mes">
            <svg viewBox="0 0 320 300" aria-hidden="true"><use href="#mimo-gato-curioso" /></svg>
          </div>
          <p>{`Nenhuma saída em ${MESES_LONGOS[mesNumero - 1].toLowerCase()} ainda. Quando você registrar gastos, eles aparecem aqui separados por categoria, com o orçamento de cada uma.`}</p>
        </div>
      )}

      <div>
        {d.categorias.map(({ nome, valor, cor, orcamento, anterior }, indice) => {
          const comparado = delta(valor, anterior);
          const n = d.mes.filter((i) => i.tipo === "saida" && i.categoria === nome).length;
          const p = Math.round((valor / d.totalCategorias) * 100);
          // Com orçamento, a barra mede o gasto contra ele (a marca é o 100%);
          // sem, mostra o peso da categoria nas saídas do mês.
          const uso = orcamento ? Math.round((valor / orcamento) * 100) : 0;
          const largura = orcamento ? Math.min(100, (valor / Math.max(valor, orcamento)) * 100) : p;
          const marca = orcamento && valor > orcamento ? (orcamento / valor) * 100 : null;
          const tom = !orcamento ? "" : uso > 100 ? " is-over" : uso >= 80 ? " is-perto" : "";
          return (
            <div className="cat-row" style={{ "--i": indice } as CSSProperties} key={nome}>
              <div className="cat-row__main">
                {onVerCategoria
                  ? <button type="button" className="cat-row__name cat-row__link" onClick={() => onVerCategoria(nome)} title={`Ver lançamentos de ${nome}`}><i style={{ background: cor }} />{nome}</button>
                  : <span className="cat-row__name"><i style={{ background: cor }} />{nome}</span>}
                <span className="cat-row__detail">{`${n} ${n === 1 ? "lançamento neste mês" : "lançamentos neste mês"}`}</span>
                <div className="cat-row__track">
                  <div className="cat__fill" style={{ width: `${largura}%`, background: uso > 100 ? "var(--out)" : cor }} />
                  {marca != null && <span className="cat-row__limite" style={{ left: `${marca}%` }} title="Orçamento" />}
                </div>
                <span className={`cat-row__orc${tom}`}>
                  {editando === nome ? (
                    <>
                      <input
                        className="orc-campo"
                        inputMode="decimal"
                        autoFocus
                        aria-label={`Orçamento de ${nome}`}
                        placeholder="0,00"
                        value={rascunho}
                        onChange={(e) => setRascunho(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); salvarOrc(nome); } if (e.key === "Escape") { e.stopPropagation(); setEditando(null); } }}
                      />
                      <button className="orc-editar" type="button" onClick={() => salvarOrc(nome)}>Salvar</button>
                    </>
                  ) : (
                    <>
                      {orcamento ? <span><b>{`${uso}%`}</b>{` de ${fmt(orcamento)}`}</span> : <span>Sem orçamento</span>}
                      {onOrcamento && (
                        <button className="orc-editar" type="button" onClick={() => { setEditando(nome); setRascunho(orcamento ? String(orcamento).replace(".", ",") : ""); }}>
                          {orcamento ? "Ajustar" : "Definir"}
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
              <span className="cat-row__value">
                {fmt(valor)}
                {comparado && <small className={`cat-row__delta is-${comparado.tom}`} title={`${mesAntCurto}: ${fmt(anterior)}`}>{comparado.texto}</small>}
              </span>
              <span className="cat-row__pct">{`${p}%`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
