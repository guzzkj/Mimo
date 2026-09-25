import type { Derivado } from "../types";

interface Props {
  mesRef: string;
  derivado: Derivado;
  fmt: (v: number) => string;
  onEditar: (id: number) => void;
}

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const ESTADO = { pago: "paga", pendente: "a vencer", atrasado: "atrasada" } as const;

// Calendário das contas do mês (pontos por estado) e as próximas faturas do
// cartão, com parcelas e recorrências já lançadas.
export function Vencimentos({ mesRef, derivado: d, fmt, onEditar }: Props) {
  const [ano, mes] = mesRef.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1).getDay();
  const celulas = [...Array.from({ length: inicio }, () => 0), ...Array.from({ length: d.diasDoMes }, (_, i) => i + 1)];
  const diaFatura = Number(d.faturaVence.slice(8));
  const contas = Object.entries(d.vencimentos).flatMap(([dia, l]) => l.map((v) => ({ ...v, dia: Number(dia) }))).sort((a, b) => a.dia - b.dia);
  const maxFatura = Math.max(...d.faturas.map((f) => f.valor), 1);

  return (
    <section className="section venc">
      <div className="venc__cal">
        <div className="section__head" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="section__title">Contas do mês</h2>
            <span className="section__sub">{contas.length ? `${contas.length} ${contas.length === 1 ? "conta" : "contas"} com vencimento` : "Nenhuma conta recorrente ou em aberto"}</span>
          </div>
          <div className="legend legend--venc">
            <span><i className="venc__pt venc__pt--pago" />Paga</span>
            <span><i className="venc__pt venc__pt--pendente" />A vencer</span>
            <span><i className="venc__pt venc__pt--atrasado" />Atrasada</span>
          </div>
        </div>
        <div className="venc__grade" role="grid" aria-label="Calendário de vencimentos">
          {SEMANA.map((s, i) => <span key={`s${i}`} className="venc__sem">{s}</span>)}
          {celulas.map((dia, i) => {
            if (!dia) return <span key={`v${i}`} />;
            const l = d.vencimentos[dia] ?? [];
            const titulo = l.map((v) => `${v.descricao}: ${fmt(v.valor)} (${ESTADO[v.estado]})`).join("\n");
            return (
              <button
                key={dia}
                type="button"
                className={`venc__dia${dia === d.diaDeHoje ? " is-hoje" : ""}${l.length ? " tem" : ""}`}
                title={titulo || undefined}
                disabled={!l.length}
                onClick={() => l[0] && onEditar(l[0].id)}
                aria-label={l.length ? `Dia ${dia}: ${titulo.replace(/\n/g, "; ")}` : `Dia ${dia}`}
              >
                <span>{dia}</span>
                <span className="venc__pts">{l.slice(0, 3).map((v) => <i key={v.id} className={`venc__pt venc__pt--${v.estado}`} />)}</span>
              </button>
            );
          })}
        </div>
        {contas.length > 0 && (
          <ul className="venc__lista">
            {contas.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onEditar(c.id)}>
                  <i className={`venc__pt venc__pt--${c.estado}`} />
                  <span>{`${String(c.dia).padStart(2, "0")} · ${c.descricao}`}</span>
                  <b>{fmt(c.valor)}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="venc__faturas">
        <h2 className="section__title">Próximas faturas</h2>
        <span className="section__sub">{`Cartão · vence todo dia ${diaFatura}`}</span>
        <div className="venc__barras">
          {d.faturas.map((f, i) => (
            <div key={f.chave} className={`venc__barra${i === 0 ? " is-atual" : ""}`} title={`Fatura de ${f.label}: ${fmt(f.valor)}`}>
              <small>{f.valor ? fmt(f.valor).replace(/,\d{2}$/, "") : "—"}</small>
              <i style={{ height: `${Math.max(3, (f.valor / maxFatura) * 100)}%` }} />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
        <p className="venc__nota">Parcelas e contas recorrentes no cartão já entram nas faturas futuras.</p>
      </div>
    </section>
  );
}
