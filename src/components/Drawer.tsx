import type { Derivado } from "../types";
import { CountValue } from "./CountValue";

interface Props {
  aberto: boolean;
  leaving: boolean;
  derivado: Derivado;
  fmt: (v: number) => string;
  privado: boolean;
  onEditar: (id: number) => void;
}

export function Drawer({ aberto, leaving, derivado: d, fmt, privado, onEditar }: Props) {
  if (!aberto) return null;

  const sobra = Math.max(0, d.limite - d.saidas);

  return (
    <aside className={`drawer${leaving ? " is-leaving" : ""}`} id="painel">
      <div className="drawer__label">Limite mensal</div>
      <CountValue className="drawer__value" valor={d.saidas} fmt={fmt} privado={privado} />
      <div className="drawer__hint">de <span>{fmt(d.limite)}</span> planejados</div>
      <div className="meter"><div className="meter__fill" style={{ width: `${Math.min(100, d.limitePct)}%` }} /></div>

      <div className="drawer__split">
        <div className="drawer__split-item">
          <span className="eyebrow">Sobra</span>
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
        {d.regra.map(({ nome, valor, cor }) => {
          const p = Math.round((valor / (d.baseRegra || 1)) * 100);
          return (
            <div className="rule" key={nome}>
              <div className="rule__head"><span>{nome}</span><span>{fmt(valor)} · {p}%</span></div>
              <div className="rule__track"><div className="rule__fill" style={{ width: `${p}%`, background: cor }} /></div>
            </div>
          );
        })}
      </div>

      <div className="drawer__section">Contas em aberto</div>
      <div className="pending-list">
        {d.pendentes.length
          ? d.pendentes.map((p) => (
            <button className="pending" type="button" key={p.id} onClick={() => onEditar(p.id)}>
              <span className="pending__text">
                <strong>{p.descricao}</strong>
                <span>{p.dataLabel}</span>
              </span>
              <span className="pending__value">{p.valorSimples}</span>
            </button>
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
