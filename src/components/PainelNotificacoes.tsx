import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDialogo } from "../hooks/useDialogo";
import { atualizarNotifs, EMAIL_SUELEN, useNotificacoes, type AcaoNotif, type ContaAtiva, type Notif, type TipoNotif } from "../lib/notificacoes";
import { salvarPlano } from "../lib/plano";
import { useCompacto, useTemaTela } from "../lib/tema";
import { SORA } from "./mimo/estilos";
import { Gato } from "./mimo/Gato";
import { Ic, Presenca, Skel } from "./mimo/ui";

// Centro de notificações (6a de docs/ref/AppConfig.dc.html), aberto pelo sino
// da Topbar em qualquer tela. Fica numa camada fixa acima do topo e do dock.

const IC: Record<TipoNotif, string> = {
  conta: "M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4",
  limite: "M12 4 21 19.5H3z M12 10v4.5 M12 17.2v.1",
  meta: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z",
  convite: "M3.5 6.5h17v11h-17z M3.5 7l8.5 6.5L20.5 7",
};
const TINT: Record<TipoNotif, [string, string]> = { conta: ["var(--accent-soft)", "var(--accent-ink)"], limite: ["var(--out-soft)", "var(--out-ink)"], meta: ["var(--duo-soft)", "var(--duo-ink)"], convite: ["var(--solo-soft)", "var(--solo-ink)"] };

interface Props {
  conta: ContaAtiva;
  aberto: boolean;
  onFechar: () => void;
  avisar: (msg: string) => void;
  carregando?: boolean;
  gato?: { cor: string; tabby: boolean };
  onPreferencias?: () => void;
  onAceitarConvite?: () => void;
  /** Marca como paga a movimentação ligada ao aviso. */
  onPagar?: (itemId: number) => void;
}

export function PainelNotificacoes({ conta, aberto, onFechar, avisar, carregando = false, gato, onPreferencias, onAceitarConvite, onPagar }: Props) {
  const navigate = useNavigate();
  const cp = useCompacto();
  const tema = useTemaTela();
  const notifs = useNotificacoes(conta);
  const caixaRef = useDialogo<HTMLDivElement>(aberto);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [aberto, onFechar]);
  const duo = conta === "duo";
  const nl = notifs.filter((n) => !n.lido).length;
  const novas = notifs.filter((n) => !n.lido);
  const lidas = notifs.filter((n) => n.lido);

  const tira = (id: string, msg?: string) => { atualizarNotifs(conta, (l) => l.filter((n) => n.id !== id)); if (msg) avisar(msg); };
  const ler = (id: string) => atualizarNotifs(conta, (l) => l.map((m) => (m.id === id ? { ...m, lido: true } : m)));
  const ir = (rota: string) => { onFechar(); navigate(rota); };
  const prim = { borda: "var(--btn-bg)", bg: "var(--btn-bg)", cor: "var(--btn-fg)" };
  const sec = { borda: "var(--line2)", bg: "var(--surface)", cor: "var(--ink)" };
  const ACAO: Record<AcaoNotif, (n: Notif) => { label: string; borda: string; bg: string; cor: string; onClick: () => void }> = {
    pagar: (n) => ({
      label: "Marcar como paga", ...prim,
      onClick: () => {
        if (n.itemId != null) onPagar?.(n.itemId);
        tira(n.id, (n.itemId != null ? n.titulo.replace(/ (vence|venceu).*$/, "") : "Conta de luz") + " marcada como paga.");
      },
    }),
    gastos: () => ({ label: "Ver gastos", ...sec, onClick: () => (duo ? ir("/duo/movimentacoes") : ir("/")) }),
    meta: () => ({ label: "Ajustar aporte", ...sec, onClick: () => ir("/metas") }),
    reenviar: () => ({ label: "Reenviar convite", ...sec, onClick: () => avisar("Convite reenviado para " + EMAIL_SUELEN + ".") }),
    aceitar: (n) => ({
      label: "Aceitar", ...prim,
      onClick: () => { tira(n.id); salvarPlano("duo"); onAceitarConvite?.(); avisar("Pronto! Você e Suelen agora têm uma conta Duo."); },
    }),
    recusar: (n) => ({ label: "Recusar", ...sec, onClick: () => tira(n.id, "Convite recusado.") }),
  };

  const painel = (
    <>
      <div onClick={onFechar} style={{ position: "absolute", inset: 0, pointerEvents: "auto", background: cp ? "var(--bg)" : "transparent" }} />
      <div role="dialog" aria-modal="true" aria-label="Notificações" ref={caixaRef} className="mm-sai-drop" style={{ position: "absolute", pointerEvents: "auto", top: cp ? 0 : 84, right: cp ? 0 : 24, bottom: cp ? 0 : "auto", left: cp ? 0 : "auto", width: cp ? "auto" : 420, maxHeight: cp ? "none" : "calc(100% - 210px)", display: "flex", flexDirection: "column", borderRadius: cp ? 0 : 22, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 30px 70px -30px rgba(0,0,0,.5)", overflow: "hidden", animation: "mmDrop .25s ease both" }}>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {cp && <button type="button" title="Fechar" aria-label="Fechar" onClick={onFechar} style={{ width: 36, height: 36, borderRadius: 11, border: "1px solid var(--line2)", background: "var(--surface)", color: "var(--muted)", display: "grid", placeItems: "center", cursor: "pointer" }}><Ic d="m15 6-6 6 6 6" size={16} sw={2} /></button>}
            <span style={{ fontFamily: SORA, fontSize: 18, letterSpacing: "-.02em" }}>Notificações</span>
            {nl > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--out-soft)", color: "var(--out-ink)", fontSize: 11.5, fontWeight: 700 }}>{nl} novas</span>}
          </div>
          {nl > 0 && <button type="button" onClick={() => atualizarNotifs(conta, (l) => l.map((n) => ({ ...n, lido: true })))} style={{ padding: 0, border: "none", background: "transparent", color: "var(--accent-ink)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Marcar todas como lidas</button>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {carregando && <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px" }}>{[1, 2, 3].map((k) => <Skel key={k} h={76} r={16} />)}</div>}
          {!carregando && !notifs.length && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 24px", textAlign: "center", animation: "mmFade .3s ease both" }}>
              <div style={{ width: 110 }}><Gato cor={gato?.cor ?? "#4e9e79"} tabby={gato?.tabby ?? false} expressao="feliz" /></div>
              <span style={{ fontFamily: SORA, fontSize: 18 }}>Tudo em dia por aqui</span>
              <span style={{ maxWidth: 280, fontSize: 13, lineHeight: 1.55, color: "var(--muted2)" }}>Nenhuma conta vencendo, limite estourado ou meta atrasada. O Mimo avisa quando algo precisar de você.</span>
            </div>
          )}
          {!carregando && [...(novas.length ? [{ label: "Novas", itens: novas }] : []), ...(lidas.length ? [{ label: "Anteriores", itens: lidas }] : [])].map((g) => (
            <div key={g.label} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ padding: "14px 18px 6px", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--faint)" }}>{g.label}</span>
              {g.itens.map((n, i) => (
                <div key={n.id} onClick={() => ler(n.id)} style={{ position: "relative", display: "flex", gap: 12, padding: "14px 18px", background: n.lido ? "transparent" : "var(--accent-soft)", borderBottom: "1px solid var(--line-soft)", cursor: "pointer", transition: "background .3s ease", animation: `mmFade .3s ${i * 0.04}s ease both` }}>
                  <span style={{ flex: "none", width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: n.lido ? "var(--line-soft)" : TINT[n.tipo][0], color: n.lido ? "var(--faint)" : TINT[n.tipo][1], transition: "background .3s ease, color .3s ease" }}><Ic d={IC[n.tipo]} size={17} /></span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13.5, fontWeight: n.lido ? 600 : 700, lineHeight: 1.35, color: "var(--ink)" }}>{n.titulo}</span>
                      <span style={{ flex: "none", fontSize: 11, color: "var(--faint)" }}>{n.quando}</span>
                    </div>
                    <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted2)", textWrap: "pretty" }}>{n.texto}</span>
                    {n.acoes.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {n.acoes.map((k) => {
                          const a = ACAO[k](n);
                          return <button key={k} type="button" onClick={(e) => { e.stopPropagation(); a.onClick(); }} style={{ height: 32, padding: "0 12px", borderRadius: 10, border: `1px solid ${a.borda}`, background: a.bg, color: a.cor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{a.label}</button>;
                        })}
                      </div>
                    )}
                  </div>
                  {!n.lido && <span style={{ position: "absolute", left: 7, top: 29, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => (onPreferencias ? onPreferencias() : ir("/ajustes/notificacoes"))} className="mm-h-linha" style={{ flex: "none", height: 50, border: "none", borderTop: "1px solid var(--line)", background: "transparent", color: "var(--accent-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Preferências de notificação</button>
      </div>
    </>
  );

  return (
    <div data-mimo="app" data-tema={tema} style={{ position: "fixed", inset: 0, zIndex: 58, pointerEvents: "none", color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <Presenca aberto={aberto}>{painel}</Presenca>
    </div>
  );
}
