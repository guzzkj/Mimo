import { Check, CreditCard } from "lucide-react";
import { DESEJOS, ESSENCIAIS } from "../lib/constants";
import { dataFmt, prazoDe } from "../lib/helpers";
import type { Derivado } from "../types";
import { CountValue } from "./CountValue";

interface Props {
  aberto: boolean;
  leaving: boolean;
  derivado: Derivado;
  fmt: (v: number) => string;
  privado: boolean;
  onEditar: (id: number) => void;
  /** Marca a conta como paga direto da linha. */
  onPagar?: (id: number) => void;
}

// O que entra em cada balde da regra 50/30/20 (mostrado ao passar o mouse).
const BALDES = [
  `Essenciais: ${ESSENCIAIS.join(", ")}.`,
  `Desejos: ${DESEJOS.join(", ")}.`,
  "Futuro: o que sobrou no mês mais saídas fora dos outros dois baldes (ex.: Educação, Investimentos).",
];

export function Drawer({ aberto, leaving, derivado: d, fmt, privado, onEditar, onPagar }: Props) {
  if (!aberto) return null;

  const sobra = Math.max(0, d.limite - d.saidas);
  const faturaPrazo = d.fatura ? prazoDe(d.faturaVence) : null;

  return (
    <aside className={`drawer${leaving ? " is-leaving" : ""}`} id="painel">
      <div className="drawer__label">Limite mensal</div>
      <CountValue className="drawer__value" valor={d.saidas} fmt={fmt} privado={privado} />
      <div className="drawer__hint">de <span>{fmt(d.limite)}</span> planejados</div>
      <div className="meter"><div className="meter__fill" style={{ width: `${Math.min(100, d.limitePct)}%` }} /></div>

      <div className="drawer__split">
        <div className="drawer__split-item">
          <span className="eyebrow">Sobra no limite</span>
          <strong className="is-positive">{fmt(sobra)}</strong>
        </div>
        <div className="drawer__divider" />
        <div className="drawer__split-item">
          <span className="eyebrow">Média/dia</span>
          <strong>{fmt(d.saidas / d.diasCorridos)}</strong>
        </div>
      </div>

      <div className="drawer__section">Regra 50 / 30 / 20</div>
      <div className="rule-list">
        {d.regra.map(({ nome, valor, cor }, i) => {
          const p = Math.round((valor / (d.baseRegra || 1)) * 100);
          const alvo = [50, 30, 20][i];
          return (
            <div className="rule" key={nome} title={BALDES[i]}>
              <div className="rule__head"><span>{nome} <small className="rule__info" aria-label={BALDES[i]}>ⓘ</small></span><span>{fmt(valor)} · {p}% <small style={{ opacity: 0.6 }}>{`/ ${alvo}%`}</small></span></div>
              <div className="rule__track" title={`${BALDES[i]} Referência: ${alvo}%`}>
                <div className="rule__fill" style={{ width: `${Math.min(100, p)}%`, background: cor }} />
                <span className="rule__alvo" style={{ left: `${alvo}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="drawer__section">Contas em aberto</div>
      <div className="pending-list">
        {d.fatura > 0 && faturaPrazo && (
          <div className="pending pending--fatura">
            <span className="pending__text">
              <strong><CreditCard aria-hidden="true" className="pending__icone" />Fatura do cartão</strong>
              <span>
                {`${dataFmt(d.faturaVence)} · ${d.faturaItens.length} ${d.faturaItens.length === 1 ? "compra" : "compras"}`}
                <b className={`prazo prazo--${faturaPrazo.tom}`}>{` · ${faturaPrazo.texto}`}</b>
              </span>
            </span>
            <span className="pending__value">{fmt(d.fatura)}</span>
          </div>
        )}
        {d.pendentes.length
          ? d.pendentes.map((p) => (
            <div className="pending" key={p.id}>
              <button className="pending__abrir" type="button" onClick={() => onEditar(p.id)} title="Editar conta">
                <span className="pending__text">
                  <strong>{p.descricao}</strong>
                  <span>
                    {p.dataLabel}
                    {p.prazo && <b className={`prazo prazo--${p.prazo.tom}`}>{` · ${p.prazo.texto}`}</b>}
                  </span>
                </span>
                <span className="pending__value">{p.valorSimples}</span>
              </button>
              {onPagar && (
                <button className="pending__pagar" type="button" title="Marcar como paga" aria-label={`Marcar ${p.descricao} como paga`} onClick={() => onPagar(p.id)}>
                  <Check />
                </button>
              )}
            </div>
          ))
          : <div className="empty-line">Nenhuma conta pendente neste mês.</div>}
      </div>

      <p className="drawer__note">
        {d.limitePct > 100
          ? `As saídas passaram o limite planejado em ${d.limitePct - 100}%. Reveja as categorias com maior peso antes do fechamento.`
          : `Ainda restam ${fmt(Math.max(0, d.limite - d.saidas))} dentro do limite planejado, com ${d.pendentes.length} conta(s) em aberto para quitar.`}
      </p>
    </aside>
  );
}
