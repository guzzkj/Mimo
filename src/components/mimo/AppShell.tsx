import { Ic } from "./ui";

// Barra inferior (layout compacto) e navegação de topo compartilhadas por
// Duo e Metas e Configurações, exatamente como nos dois protótipos.

export interface NavItem {
  id: string;
  label: string;
  curto: string;
  ic: string;
  on: boolean;
  onClick: () => void;
}

export function NavTopo({ itens }: { itens: NavItem[] }) {
  return (
    <nav aria-label="Navegação principal" style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {itens.map((n) => (
        <button
          key={n.id}
          type="button"
          aria-current={n.on ? "page" : undefined}
          onClick={n.onClick}
          className={n.on ? undefined : "mm-h-linha"}
          style={{ height: 38, padding: "0 14px", borderRadius: 12, border: "none", background: n.on ? "var(--accent-soft)" : "transparent", color: n.on ? "var(--ink)" : "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {n.label}
        </button>
      ))}
    </nav>
  );
}

export function NavInferior({ itens }: { itens: NavItem[] }) {
  return (
    <nav aria-label="Navegação principal" style={{ flex: "none", display: "flex", justifyContent: "space-around", padding: "8px 6px 16px", borderTop: "1px solid var(--line)", background: "var(--glass)", backdropFilter: "blur(18px)" }}>
      {itens.map((n) => (
        <button
          key={n.id}
          type="button"
          aria-current={n.on ? "page" : undefined}
          onClick={n.onClick}
          style={{ minWidth: 64, minHeight: 48, padding: "4px 6px", border: "none", background: "transparent", color: n.on ? "var(--accent-ink)" : "var(--faint)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          <Ic d={n.ic} size={21} sw={1.7} style={{ transition: "transform .25s cubic-bezier(.2,.8,.2,1)", transform: n.on ? "translateY(-1px)" : "none" }} />
          {n.curto}
        </button>
      ))}
    </nav>
  );
}
