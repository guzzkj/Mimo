import { useState } from "react";
import { categoriasDe, corDaCategoria, salvarAjustes, type Ajustes, type ContaAjustes } from "../lib/ajustes";
import { mascaraMoeda, moedaTexto, parseNum } from "../lib/helpers";
import { btnPrim, CARTAO, OLHO, ROTULO, campoSt } from "./mimo/estilos";

interface Props {
  conta: ContaAjustes;
  ajustes: Ajustes;
  /** Gasto do mês atual por categoria, para comparar com o orçamento. */
  gastos: Record<string, number>;
  fmt: (v: number) => string;
  onSalvo: () => void;
}

// Categorias de entrada não têm orçamento.
const ENTRADAS = ["Salário", "Freelance", "Investimentos"];

// Orçamento mensal por categoria, editável também em Configurações > Finanças
// (o mesmo valor que Categorias mostra e edita inline).
export function OrcamentosConfig({ conta, ajustes, gastos, fmt, onSalvo }: Props) {
  const cats = categoriasDe(ajustes).filter((c) => !ENTRADAS.includes(c));
  const [rascunho, setRascunho] = useState<Record<string, string>>(() => Object.fromEntries(
    cats.map((c) => [c, ajustes.orcamentos[c] ? moedaTexto(ajustes.orcamentos[c]) : ""]),
  ));
  const total = cats.reduce((t, c) => t + (parseNum(rascunho[c] || "") || 0), 0);

  const salvar = () => {
    const orcamentos = Object.fromEntries(
      cats.map((c) => [c, parseNum(rascunho[c] || "") || 0]).filter(([, v]) => (v as number) > 0),
    ) as Record<string, number>;
    salvarAjustes(conta, { orcamentos });
    onSalvo();
  };

  return (
    <div style={{ ...CARTAO, padding: 24, display: "flex", flexDirection: "column", gap: 14, gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={OLHO}>Orçamento por categoria</span>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Total orçado <strong style={{ color: "var(--ink)" }}>{fmt(total)}</strong></span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--muted2)" }}>
        {conta === "duo" ? "O orçamento de Lazer é o limite de lazer do casal. " : ""}Deixe em branco para não acompanhar a categoria.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
        {cats.map((c) => {
          const orc = parseNum(rascunho[c] || "") || 0;
          const gasto = gastos[c] || 0;
          const passou = orc > 0 && gasto > orc;
          return (
            <label key={c} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ ...ROTULO, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: corDaCategoria(ajustes, c) }} />{c}
              </span>
              <input
                inputMode="numeric"
                placeholder="Sem orçamento"
                value={rascunho[c] ?? ""}
                onChange={(e) => setRascunho((r) => ({ ...r, [c]: mascaraMoeda(e.target.value) }))}
                style={campoSt(passou ? "var(--out-line)" : "var(--line2)", { height: 42 })}
              />
              <span style={{ fontSize: 11.5, color: passou ? "var(--out-ink)" : "var(--faint)" }}>
                {gasto ? `Gasto no mês: ${fmt(gasto)}` : "Sem gastos no mês"}
              </span>
            </label>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={salvar} style={btnPrim({ minWidth: 170 })}>Salvar orçamentos</button>
      </div>
    </div>
  );
}
