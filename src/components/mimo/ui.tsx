import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// Peças pequenas repetidas nas telas portadas (Duo e Metas, Configurações,
// Acesso). Os estilos são os mesmos dos protótipos em docs/ref.

export function Spinner({ size = 15, anim = "mmSpin" }: { size?: number; anim?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ flex: "none", width: size, height: size, borderRadius: "50%", border: "2px solid currentColor", borderRightColor: "transparent", animation: `${anim} .7s linear infinite` }}
    />
  );
}

// Interruptor 44×26 usado em preferências e toggles.
export function Chave({ on }: { on: boolean }) {
  return (
    <span style={{ flex: "none", position: "relative", width: 44, height: 26, borderRadius: 99, background: on ? "var(--accent)" : "var(--line2)", transition: "background .2s ease" }}>
      <span style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: "50%", background: "#ffffff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform .25s cubic-bezier(.2,.8,.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,.18)" }} />
    </span>
  );
}

export function Skel({ h, r = 22 }: { h: number; r?: number }) {
  return (
    <div style={{ height: h, borderRadius: r, background: "linear-gradient(90deg, var(--sk) 0%, var(--sk2) 50%, var(--sk) 100%)", backgroundSize: "200% 100%", animation: "mmShim 1.4s linear infinite" }} />
  );
}

export function Ic({ d, size = 17, sw = 1.8, style }: { d: string; size?: number; sw?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Avatar({ av, ini, size = 28, fs = 11, style }: { av: string; ini: string; size?: number; fs?: number; style?: CSSProperties }) {
  return (
    <span style={{ flex: "none", width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: av, color: "#ffffff", fontSize: fs, fontWeight: 700, ...style }}>{ini}</span>
  );
}

// Mantém o último conteúdo na tela por alguns ms depois de fechado, para que
// modal, painel e toast saiam com animação em vez de sumir de uma vez.
// Os filhos diretos recebem mmSaiFade; quem tiver .mm-sai-card/.mm-sai-drop
// ganha a saída própria (ver mimo-telas.css).
export function Presenca({ aberto, ms = 220, children }: { aberto: boolean; ms?: number; children: ReactNode }) {
  const [ultimo, setUltimo] = useState<ReactNode>(aberto ? children : null);
  const [saindo, setSaindo] = useState(false);
  const [antes, setAntes] = useState(aberto);

  // guarda o último conteúdo aberto (padrão "ajustar estado durante o render")
  if (aberto && ultimo !== children) setUltimo(children);
  if (aberto !== antes) {
    setAntes(aberto);
    setSaindo(!aberto);
  }

  useEffect(() => {
    if (!saindo) return;
    const id = window.setTimeout(() => setSaindo(false), ms);
    return () => window.clearTimeout(id);
  }, [saindo, ms]);

  if (!aberto && !saindo) return null;
  return (
    <div className={saindo ? "mm-saindo" : undefined} style={{ display: "contents" }}>
      {aberto ? children : ultimo}
    </div>
  );
}

export function Toast({ msg, bottom, anim = "mmRise", z = 40 }: { msg: string | null; bottom: string; anim?: string; z?: number }) {
  return (
    <Presenca aberto={!!msg}>
      <div
        role="status"
        key={msg ?? ""}
        style={{ position: "absolute", left: "50%", bottom, zIndex: z, transform: "translateX(-50%)", maxWidth: "calc(100% - 32px)", padding: "12px 18px", borderRadius: 14, background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 13, fontWeight: 600, boxShadow: "0 20px 40px -20px rgba(0,0,0,.5)", animation: `${anim} .3s ease both`, textAlign: "center" }}
      >
        {msg}
      </div>
    </Presenca>
  );
}
