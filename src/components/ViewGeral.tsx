import type { CSSProperties } from "react";
import { useMemo } from "react";
import { decorar } from "../lib/derive";
import { mesAnterior, MESES, MESES_LONGOS } from "../lib/helpers";
import { token } from "../lib/storage";
import type { Derivado, ItemDecorado, Tema } from "../types";
import { CountValue } from "./CountValue";
import { DonutChart } from "./charts/DonutChart";
import { FlowChart } from "./charts/FlowChart";
import { ProjecaoChart } from "./charts/ProjecaoChart";
import { MonthNav } from "./MonthNav";
import { TagsMovimentacao } from "./TagsMovimentacao";
import { Vencimentos } from "./Vencimentos";

interface Props {
  mesRef: string;
  derivado: Derivado;
  fmt: (v: number) => string;
  privado: boolean;
  tema: Tema;
  limites: { primeiro: string; ultimo: string };
  flip: boolean;
  ronronando: boolean;
  coracoes: { id: number; left: number; width: number; delay: number; dx: number; giro: number }[];
  onAnteriorMes: () => void;
  onProximoMes: () => void;
  onHojeMes: () => void;
  onVerarCartao: () => void;
  onRonronar: () => void;
  onVerTodas: () => void;
  /** Abre a edição de uma movimentação (recentes e calendário). */
  onEditar: (id: number) => void;
}

const linhaRecente = (onEditar: (id: number) => void) => (it: ItemDecorado, indice: number) => (
  <button type="button" className="recent recent--botao" style={{ "--i": indice } as CSSProperties} key={it.id} onClick={() => onEditar(it.id)} title="Editar movimentação">
    <div className={`badge ${it.classeCor}`} style={{ background: it.iconBg }}>{it.sinal}</div>
    <div className="recent__text">
      <strong>{it.descricao}</strong>
      <span>{it.categoria}</span>
      <TagsMovimentacao item={it} />
    </div>
    <span className="recent__date">{it.dataLabel}</span>
    <span className={`recent__status ${it.statusClasse}`}>{it.statusLabel}</span>
    <span className={`recent__value ${it.classeCor}`}>{it.valorFmt}</span>
  </button>
);

export function ViewGeral({
  mesRef, derivado: d, fmt, privado, tema, limites, flip, ronronando, coracoes,
  onAnteriorMes, onProximoMes, onHojeMes, onVerarCartao, onRonronar, onVerTodas, onEditar,
}: Props) {
  const vazio = d.mes.length === 0;
  const mesNumero = mesRef.slice(5);
  const rotuloMes = `${MESES_LONGOS[Number(mesRef.slice(5, 7)) - 1]} de ${mesRef.slice(0, 4)}`;

  // "Livre após contas": o saldo depois de pagar o que está em aberto.
  const livre = d.livre;
  const livrePct = d.saldo > 0 ? Math.max(2, Math.min(100, Math.round((Math.max(0, livre) / d.saldo) * 100))) : 0;

  // A sparkline mostra só as saídas: o salário não achata os outros dias.
  const maxDia = useMemo(() => Object.values(d.dias).reduce((max, { saidas }) => Math.max(max, saidas), 1), [d.dias]);

  const [primeiroSerie] = d.serie;
  const ultimoSerie = d.serie[d.serie.length - 1];

  // Cartão Mimo = fatura do cartão de crédito no mês em foco.
  const nomeMes = MESES_LONGOS[Number(mesNumero) - 1].toLowerCase();
  const parceladas = d.faturaItens.filter((i) => i.parcela).length;
  const detalheFatura = d.faturaItens.length
    ? `${d.faturaItens.length} ${d.faturaItens.length === 1 ? "compra" : "compras"} no crédito${parceladas ? ` · ${parceladas} ${parceladas === 1 ? "parcelada" : "parceladas"}` : ""}`
    : "Nenhuma compra no crédito";
  const venceFatura = `Vence ${d.faturaVence.slice(8)}/${d.faturaVence.slice(5, 7)}`;
  const categoriasComGasto = useMemo(() => d.categorias.filter((c) => c.valor > 0), [d.categorias]);
  // A rosca soma 100% das saídas: além das 5 maiores, o resto vira "Demais".
  const fatiasRosca = useMemo(() => {
    const resto = categoriasComGasto.slice(5).reduce((t, c) => t + c.valor, 0);
    return resto ? [...categoriasComGasto.slice(0, 5), { nome: "Demais", valor: resto, cor: "#8790a6", orcamento: 0, anterior: 0 }] : categoriasComGasto;
  }, [categoriasComGasto]);

  const recentes = useMemo(() => d.ordenados.slice(0, 6).map((i) => decorar(i, fmt)), [d.ordenados, fmt]);

  return (
    <section className="view view--overview" aria-label="Visão geral">
      {vazio && (
        <div className="empty-month">
          <div className="mascote mascote--mes">
            <svg viewBox="0 0 320 300" aria-hidden="true"><use href="#mimo-gato-feliz" /></svg>
          </div>
          <p>{`${MESES_LONGOS[Number(mesNumero) - 1]} ainda está em silêncio. Registre a primeira movimentação do mês.`}</p>
        </div>
      )}

      <div>
        <MonthNav
          className="mes-nav--geral"
          label={rotuloMes}
          desabilitarAnterior={mesRef <= limites.primeiro}
          desabilitarProximo={mesRef >= limites.ultimo}
          mostrarHoje={!d.ehMesAtual}
          onAnterior={onAnteriorMes}
          onProximo={onProximoMes}
          onHoje={onHojeMes}
        />

        <div className="hero">
          <div className="hero__left">
            <span className="hero__label">Saldo disponível</span>
            <div className="hero__balance" style={{ "--projected": `${livrePct}%` } as CSSProperties}>
              <div className="hero__amounts">
                <CountValue className="hero__value" valor={d.saldo} fmt={fmt} privado={privado} />
                <span className={`hero__delta${d.variacao < 0 ? " is-negative" : ""}`}>
                  {`${d.variacao >= 0 ? "+" : ""}${d.variacao}% vs ${MESES[Number(mesAnterior(mesRef).slice(5)) - 1]}`}
                </span>
                <span className="hero__projected" title="Saldo menos as contas em aberto, mais o que ainda vai entrar">{fmt(livre)}</span>
              </div>
              <div className="hero__projected-row">
                <div className="hero__projected-track"><div className="hero__projected-fill" /></div>
                <span>Livre após contas</span>
              </div>
              {!vazio && (
                <p className="hero__phrase">
                  {`Você registrou ${d.mes.length} movimentações em ${MESES_LONGOS[Number(mesNumero) - 1].toLowerCase()}.`}
                  {` Resultado do mês: ${d.resultado >= 0 ? "+" : "−"} ${fmt(Math.abs(d.resultado))}.`}
                </p>
              )}

              <div className="sparkline">
                <div className="sparkline__bars">
                  {Array.from({ length: d.diasDoMes }, (_, i) => i + 1).map((dia) => {
                    const total = d.dias[dia]?.saidas ?? 0;
                    const altura = total ? `${Math.max(14, Math.round((total / maxDia) * 100))}%` : "3px";
                    const cor = total ? token("--out") : `rgba(${token("--ink-rgb")}, 0.14)`;
                    const dica = `Dia ${dia}${total ? `: ${fmt(total)} em saídas` : ": sem saídas"}`;
                    return (
                      <div className={`sparkline__day${dia === d.diaDeHoje ? " is-today" : ""}`} title={dica} key={dia}>
                        <i style={{ height: altura, background: cor }} />
                      </div>
                    );
                  })}
                </div>
                <div className="sparkline__axis">
                  <span>1</span>
                  <b>{d.diaDeHoje ? `hoje ${d.diaDeHoje}` : ""}</b>
                  <span>{d.diasDoMes}</span>
                </div>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="eyebrow">Entradas</span>
                <CountValue as="strong" className="is-in" valor={d.entradas} fmt={fmt} privado={privado} />
              </div>
              <div className="stat">
                <span className="eyebrow">Saídas</span>
                <CountValue as="strong" className="is-out" valor={d.saidas} fmt={fmt} privado={privado} />
              </div>
              <div className="stat" title={`${d.pendentes.length} ${d.pendentes.length === 1 ? "conta pendente" : "contas pendentes"}`}>
                <span className="eyebrow">A pagar</span>
                <CountValue as="strong" valor={d.aPagar} fmt={fmt} privado={privado} />
              </div>
            </div>
          </div>

          <div className="hero__right">
            <div className="card-stage">
              <div className="coracoes" aria-hidden="true">
                {coracoes.map((c) => (
                  <span
                    className="coracao"
                    key={c.id}
                    style={{
                      left: `${c.left}px`,
                      width: `${c.width}px`,
                      animationDelay: `${c.delay}ms`,
                      "--dx": `${c.dx}px`,
                      "--giro": `${c.giro}deg`,
                    } as CSSProperties}
                  >
                    <svg viewBox="0 0 32 30" aria-hidden="true"><use href="#mimo-coracao" /></svg>
                  </span>
                ))}
              </div>

              <div className={`mascot${ronronando ? " is-ronronando" : ""}`} title="Faça carinho no Mimo" onClick={onRonronar}>
                <svg viewBox="0 0 320 300" width="100%" aria-hidden="true">
                  <use href={ronronando ? "#mimo-gato-feliz" : (d.resultado < 0 ? "#mimo-gato-preocupado" : "#mimo-gato")} />
                </svg>
              </div>

              <button className={`card${flip ? " is-flipped" : ""}`} type="button" title="Clique para ver o verso" aria-label="Virar cartão" onClick={onVerarCartao}>
                <span className="card__face">
                  <span className="card__head">
                    <span className="card__title">
                      <strong>Cartão Mimo</strong>
                      <span>{`Fatura de ${nomeMes}`}</span>
                    </span>
                    <img className="card__mark" src={`${import.meta.env.BASE_URL}assets/mimo-simbolo.png`} alt="" />
                  </span>
                  <CountValue className="card__value" valor={d.fatura} fmt={fmt} privado={privado} />
                  <span className="card__detail">{detalheFatura}</span>
                  <span className="card__foot">
                    <span className="card__vence">{d.fatura ? venceFatura : "Fatura zerada"}</span>
                    <b>MIMO</b>
                  </span>
                </span>

                <span className="card__face card__face--back">
                  <span className="card__back-head">
                    <span>Compras na fatura</span>
                    <span>{venceFatura}</span>
                  </span>
                  <span className="card__list">
                    {d.faturaItens.length ? (
                      <>
                        {d.faturaItens.slice(0, 3).map((p) => (
                          <span className="card__row" key={p.id}>
                            <span><strong>{p.descricao}</strong><small>{p.parcela ? `${p.dataLabel} · ${p.parcela.n}/${p.parcela.total}` : p.dataLabel}</small></span>
                            <span>{p.valorSimples}</span>
                          </span>
                        ))}
                        {d.faturaItens.length > 3 && (
                          <span className="card__rest">{`+ ${d.faturaItens.length - 3} em Movimentações`}</span>
                        )}
                      </>
                    ) : <span className="card__rest">Nenhuma compra no cartão neste mês.</span>}
                  </span>
                  <span className="card__foot">
                    <span><span>{fmt(d.fatura)}</span> no total</span>
                    <b>MIMO</b>
                  </span>
                </span>
              </button>

              <div className="mascot-tail">
                <svg viewBox="0 0 200 150" width="100%" aria-hidden="true" style={{ overflow: "visible" }}><use href="#mimo-rabo" /></svg>
              </div>
            </div>
          </div>
        </div>

        <section className="section">
          <div className="section__head">
            <div>
              <h2 className="section__title">{d.ehMesAtual ? "Saldo até o fim do mês" : "Saldo no mês"}</h2>
              <span className="section__sub">
                {d.ehMesAtual
                  ? `Hoje ${fmt(d.projecao[d.diaDeHoje - 1]?.real ?? d.saldo)} · previsto para o dia ${d.diasDoMes}: ${fmt(livre)}`
                  : d.projecao[d.projecao.length - 1]?.real == null
                    ? `Previsto para o dia ${d.diasDoMes}: ${fmt(livre)}`
                    : `Terminou em ${fmt(d.projecao[d.projecao.length - 1].real ?? 0)}`}
              </span>
            </div>
            <div className="legend">
              <span><i className="legend__linha" />Realizado</span>
              {d.projecao.some((p) => p.previsto != null) &&<span><i className="legend__linha legend__linha--prev" />Previsto</span>}
            </div>
          </div>
          <ProjecaoChart pontos={d.projecao} diaDeHoje={d.diaDeHoje} fmt={fmt} mesCurto={MESES[Number(mesNumero) - 1]} />
        </section>

        <Vencimentos mesRef={mesRef} derivado={d} fmt={fmt} onEditar={onEditar} />

        <section className="section">
          <div className="section__head">
            <div>
              <h2 className="section__title">Fluxo dos últimos meses</h2>
              <span className="section__sub">{`${primeiroSerie.label} de ${primeiroSerie.chave.slice(0, 4)} até ${ultimoSerie.label} de ${ultimoSerie.chave.slice(0, 4)}`}</span>
            </div>
            <div className="legend">
              <span><i className="is-in" />Entrada</span>
              <span><i className="is-out" />Saída</span>
            </div>
          </div>
          <div className="chart">
            <FlowChart serie={d.serie} fmt={fmt} privado={privado} tema={tema} />
          </div>
        </section>

        <section className="band">
          <h2 className="band__title">Para onde o dinheiro vai</h2>
          <div className="band__body">
            <div className="donut">
              <div className="mascote mascote--faixa">
                <svg viewBox="0 0 200 150" aria-hidden="true"><use href="#mimo-rabo" /></svg>
              </div>
              <DonutChart categorias={fatiasRosca} fmt={fmt} tema={tema} />
              <div className="donut__hole">
                <div>
                  <small>Saídas</small>
                  <CountValue as="strong" valor={d.saidas} fmt={fmt} privado={privado} />
                </div>
              </div>
            </div>
            <div className="cat-legend">
              {categoriasComGasto.slice(0, 5).map(({ nome, valor, cor, orcamento }) => {
                const ultimos = d.mes
                  .filter((i) => i.tipo === "saida" && i.categoria === nome)
                  .slice(0, 3)
                  .map((i) => `${i.data.slice(8)}/${i.data.slice(5, 7)} ${i.descricao}`)
                  .join("  ·  ");
                const p = Math.round((valor / d.totalCategorias) * 100);
                return (
                  <div className="cat" key={nome}>
                    <div className="cat__head">
                      <span className="cat__name">
                        <i style={{ background: cor }} />
                        <span className="cat__label">{nome}</span>
                        <span className="cat__detail">{ultimos || nome}</span>
                      </span>
                      <span className="cat__value" title={orcamento ? `Orçamento: ${fmt(orcamento)}` : undefined} style={orcamento && valor > orcamento ? { color: "var(--out)" } : undefined}>{fmt(valor)}</span>
                    </div>
                    <div className="cat__track"><div className="cat__fill" style={{ width: `${p}%`, background: cor }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section__head" style={{ marginBottom: 12 }}>
            <h2 className="section__title">Movimentações recentes</h2>
            <button className="link-button" type="button" onClick={onVerTodas}>Ver todas</button>
          </div>
          <div>{recentes.map(linhaRecente(onEditar))}</div>
        </section>
      </div>
    </section>
  );
}
