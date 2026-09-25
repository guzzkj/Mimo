import type { CSSProperties } from "react";

export const SORA = "'Sora', sans-serif";

export const brl = (v: number, dec = true) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }).format(v || 0);

// "6.800,50" -> 6800.5; vazio -> NaN (igual ao num() dos protótipos)
export const numBR = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  return Number(s.replace(/\./g, "").replace(",", "."));
};

// Estilos repetidos dos cartões e formulários dos protótipos "app".
export const CARTAO: CSSProperties = { padding: 22, borderRadius: 24, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 18px 44px -32px var(--shadow)" };
export const OLHO: CSSProperties = { fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--faint)" };
export const ROTULO: CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" };
export const OPCIONAL: CSSProperties = { fontWeight: 500, color: "var(--faint)" };
export const ERRO_CAMPO: CSSProperties = { fontSize: 12, color: "var(--out-ink)", animation: "mmFade .2s ease both" };
export const LINK_TEXTO: CSSProperties = { padding: 0, border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
export const campoSt = (borda: string, extra?: CSSProperties): CSSProperties => ({
  width: "100%", height: 48, padding: "0 14px", borderRadius: 14, border: `1px solid ${borda}`, background: "var(--field)", color: "var(--ink)", fontSize: 14.5, outline: "none", transition: "border-color .2s ease", ...extra,
});
export const btnPrim = (extra?: CSSProperties): CSSProperties => ({
  height: 48, padding: "0 20px", borderRadius: 15, border: "none", background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, ...extra,
});
export const btnSec = (extra?: CSSProperties): CSSProperties => ({
  height: 48, padding: "0 18px", borderRadius: 15, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--ink)", fontSize: 14, fontWeight: 700, cursor: "pointer", ...extra,
});
// opção selecionável (opt() dos protótipos)
export const opcao = (on: boolean) => ({ bg: on ? "var(--accent-soft)" : "var(--surface)", borda: on ? "var(--accent-line)" : "var(--line2)", cor: on ? "var(--ink)" : "var(--muted)" });
// segmento de controle (seg() dos protótipos)
export const segmento = (on: boolean): CSSProperties => ({ background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--muted)", boxShadow: on ? "0 4px 12px -6px var(--shadow)" : "none" });
