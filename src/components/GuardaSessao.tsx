import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MODO_API } from "../lib/modo";
import { usePlano } from "../lib/plano";
import { destinoAposLogin, recarregarSessao, useSessao } from "../lib/sessao";

// Telas do app só abrem com sessão válida, e-mail confirmado e onboarding
// feito; senão vão para o passo certo do /acesso. No protótipo (modo local)
// não há login: tudo abre direto.
// `soloSo`: o painel Solo é só de quem está no Solo; no Duo, o dinheiro é
// administrado no painel do casal (gasto pessoal = lançamento privado na Duo).
export function GuardaSessao({ children, soloSo = false }: { children: ReactNode; soloSo?: boolean }) {
  const sessao = useSessao();
  const plano = usePlano();
  const loc = useLocation();
  if (!MODO_API) return soloSo && plano === "duo" ? <Navigate to="/duo" replace /> : children;
  if (sessao.status === "carregando") return null;
  if (sessao.status === "erro") {
    return (
      <div role="alert" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)", color: "var(--ink)", fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 380, display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
          <strong style={{ fontSize: 18 }}>Não conseguimos falar com o Mimo</strong>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted2)" }}>{sessao.mensagem}</span>
          <button type="button" onClick={() => void recarregarSessao()} style={{ height: 46, borderRadius: 14, border: "none", background: "var(--btn-bg)", color: "var(--btn-fg)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Tentar de novo</button>
        </div>
      </div>
    );
  }
  if (sessao.status === "anonimo") return <Navigate to="/acesso/login" replace state={{ de: loc.pathname }} />;
  const destino = destinoAposLogin(sessao);
  if (destino.startsWith("/acesso")) return <Navigate to={destino} replace />;
  if (soloSo && plano === "duo") return <Navigate to="/duo" replace />;
  return children;
}
