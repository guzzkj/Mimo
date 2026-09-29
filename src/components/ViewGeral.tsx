import type { CSSProperties } from "react";
import { useMemo } from "react";
import { decorar } from "../lib/derive";
import { mesAnterior, MESES, MESES_LONGOS } from "../lib/helpers";
import type { Derivado, ItemDecorado, Tema } from "../types";
import { CountValue } from "./CountValue";
import { ProjecaoChart } from "./charts/ProjecaoChart";
import { MonthNav } from "./MonthNav";

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
  onEscolherMes?: (mesRef: string) => void;
  onVerarCartao: () => void;
  onRonronar: () => void;
  onVerTodas: () => void;
  /** Abre a edição de uma movimentação (recentes e calendário). */
  onEditar: (id: number) => void;
}

const ESTADO_CONTA = { pago: "paga", pendente: "a vencer", atrasado: "atrasada" } as const;

// Linha compacta dos cartões da visão geral: marcador, texto, valor.
const linhaRecente = (onEditar: (id: number) => void) => (it: ItemDecorado, indice: number) => (
  <button type="button" className="sg-linha" style={{ "--i": indice } as CSSProperties} key={it.id} onClick={() => onEditar(it.id)} title="Editar movimentação">
    <span className={`badge sg-linha__badge ${it.classeCor}`} style={{ background: it.iconBg }}>{it.sinal}</span>
    <span className="sg-linha__texto"><strong>{it.descricao}</strong><small>{`${it.dataLabel} · ${it.categoria}`}</small></span>
    <span className={`sg-linha__valor ${it.classeCor}`}>{it.valorFmt}</span>
  </button>
);

export function ViewGeral({
  mesRef, derivado: d, fmt, privado, limites, flip, ronronando, coracoes,
  onAnteriorMes, onProximoMes, onHojeMes, onEscolherMes, onVerarCartao, onRonronar, onVerTodas, onEditar,
}: Props) {
  const vazio = d.mes.length === 0;
  const mesNumero = mesRef.slice(5);
  const rotuloMes = `${MESES_LONGOS[Number(mesRef.slice(5, 7)) - 1]} de ${mesRef.slice(0, 4)}`;

  // "Livre após contas": o saldo depois de pagar o que está em aberto.
  const livre = d.livre;
  const livrePct = d.saldo > 0 ? Math.max(2, Math.min(100, Math.round((Math.max(0, livre) / d.saldo) * 100))) : 0;

  // Cartão Mimo = fatura do cartão de crédito no mês em foco.
  const nomeMes = MESES_LONGOS[Number(mesNumero) - 1].toLowerCase();
  const parceladas = d.faturaItens.filter((i) => i.parcela).length;
  const detalheFatura = d.faturaItens.length
    ? `${d.faturaItens.length} ${d.faturaItens.length === 1 ? "compra" : "compras"} no crédito${parceladas ? ` · ${parceladas} ${parceladas === 1 ? "parcelada" : "parceladas"}` : ""}`
    : "Nenhuma compra no crédito";
  const venceFatura = `Vence ${d.faturaVence.slice(8)}/${d.faturaVence.slice(5, 7)}`;
  const categoriasComGasto = useMemo(() => d.categorias.filter((c) => c.valor > 0), [d.categorias]);
  const recentes = useMemo(() => d.ordenados.slice(0, 3).map((i) => decorar(i, fmt)), [d.ordenados, fmt]);

  // Contas do mês: as que ainda vão sair primeiro, depois as pagas, por dia.
  const contas = useMemo(() => Object.entries(d.vencimentos)
    .flatMap(([dia, l]) => l.map((v) => ({ ...v, dia: Number(dia) })))
    .sort((a, b) => Number(a.estado === "pago") - Number(b.estado === "pago") || a.dia - b.dia), [d.vencimentos]);
  const contasPagas = contas.filter((c) => c.estado === "pago").length;
  const contasAbertas = contas.filter((c) => c.estado !== "pago");
  const totalAberto = contasAbertas.reduce((t, c) => t + c.valor, 0);

  const [maiorCat] = categoriasComGasto;
  const leituraCat = maiorCat && d.totalCategorias
    ? `${maiorCat.nome} leva ${Math.round((maiorCat.valor / d.totalCategorias) * 100)}% das saídas do mês.`
    : "";

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
          mesRef={mesRef}
          limites={limites}
          onEscolher={onEscolherMes}
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
                    <img className="card__mark" src="/assets/mimo-simbolo.png" alt="" />
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

        {/* Os quatro cartões do mês em 2x2, todos com a mesma altura:
            o que vem pela frente (saldo previsto, contas) em cima,
            o que já aconteceu (movimentações, categorias) embaixo. */}
        <div className="mm-geral-cq sg-grade-wrap">
          <section aria-label="Resumo do mês" className="mm-geral-grade">
            <div className="sg-card">
              <div className="sg-card__head">
                <span className="sg-card__olho">{d.ehMesAtual ? "Saldo até o fim do mês" : "Saldo no mês"}</span>
                <div className="legend sg-card__legenda">
                  <span><i className="legend__linha" />Realizado</span>
                  {d.projecao.some((p) => p.previsto != null) && <span><i className="legend__linha legend__linha--prev" />Previsto</span>}
                </div>
              </div>
              <div className="sg-card__grafico">
                <ProjecaoChart pontos={d.projecao} diaDeHoje={d.diaDeHoje} fmt={fmt} mesCurto={MESES[Number(mesNumero) - 1]} />
              </div>
              <span className="sg-card__rodape">
                {d.ehMesAtual
                  ? `Hoje ${fmt(d.projecao[d.diaDeHoje - 1]?.real ?? d.saldo)} · previsto para o dia ${d.diasDoMes}: ${fmt(livre)}.`
                  : d.projecao[d.projecao.length - 1]?.real == null
                    ? `Previsto para o dia ${d.diasDoMes}: ${fmt(livre)}.`
                    : `Terminou em ${fmt(d.projecao[d.projecao.length - 1].real ?? 0)}.`}
              </span>
            </div>

            <div className="sg-card">
              <div className="sg-card__head">
                <span className="sg-card__olho">Contas do mês</span>
                {contas.length > 0 && <span className="sg-card__lado">{`${contasPagas} de ${contas.length} pagas`}</span>}
              </div>
              {contas.length ? (
                <ul className="sg-contas">
                  {contas.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <button type="button" className="sg-linha" onClick={() => onEditar(c.id)} title={`${c.descricao}: ${ESTADO_CONTA[c.estado]}`}>
                        <i className={`venc__pt venc__pt--${c.estado}`} />
                        <span className="sg-linha__texto"><strong>{c.descricao}</strong><small>{`dia ${String(c.dia).padStart(2, "0")} · ${ESTADO_CONTA[c.estado]}`}</small></span>
                        <span className="sg-linha__valor">{fmt(c.valor)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <span className="sg-card__vazio">Nenhuma conta recorrente ou em aberto neste mês.</span>}
              {contas.length > 0 && (
                <span className="sg-card__rodape">
                  {contasAbertas.length ? `Falta pagar ${fmt(totalAberto)} em ${contasAbertas.length} ${contasAbertas.length === 1 ? "conta" : "contas"}.` : "Tudo pago neste mês."}
                </span>
              )}
            </div>

            <div className="sg-card">
              <div className="sg-card__head">
                <span className="sg-card__olho">Movimentações recentes</span>
                <button className="sg-card__link" type="button" onClick={onVerTodas}>Ver todas</button>
              </div>
              {recentes.length ? <div>{recentes.map(linhaRecente(onEditar))}</div> : <span className="sg-card__vazio">Nada registrado neste mês ainda.</span>}
            </div>

            <div className="sg-card">
              <div className="sg-card__head">
                <span className="sg-card__olho">Para onde o dinheiro vai</span>
                {d.saidas > 0 && <span className="sg-card__lado">{`${fmt(d.saidas)} em saídas`}</span>}
              </div>
              {categoriasComGasto.length ? (
                <div className="sg-cats">
                  {categoriasComGasto.slice(0, 3).map(({ nome, valor, cor, orcamento }) => {
                    const acima = orcamento > 0 && valor > orcamento;
                    return (
                      <div className="sg-cat" key={nome} title={orcamento ? `Orçamento: ${fmt(orcamento)}` : undefined}>
                        <div className="sg-cat__head">
                          <span className="sg-cat__nome"><i style={{ background: cor }} />{nome}</span>
                          <span className={`sg-cat__valor${acima ? " is-acima" : ""}`}>{fmt(valor)}</span>
                        </div>
                        <div className="sg-cat__trilho"><div style={{ width: `${Math.round((valor / d.totalCategorias) * 100)}%`, background: cor }} /></div>
                      </div>
                    );
                  })}
                </div>
              ) : <span className="sg-card__vazio">Nenhuma saída neste mês.</span>}
              {leituraCat && <span className="sg-card__rodape">{leituraCat}</span>}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
