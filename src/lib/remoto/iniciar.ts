import { hidratarAjustes } from "../ajustes";
import { hidratarAcertos } from "../contaDuo";
import { MODO_API } from "../modo";
import { hidratarNotificacoes } from "../notificacoes";
import { assinarSessao, lerSessao, recarregarSessao } from "../sessao";

// Liga o app ao backend: carrega a sessão e, sempre que as contas mudam
// (login, onboarding, convite aceito, Duo desfeito), recarrega ajustes,
// acertos e avisos. Movimentações e metas são carregadas pelas próprias telas.
export function iniciarBackend() {
  if (!MODO_API) return;
  let chave = "";
  assinarSessao(() => {
    const s = lerSessao();
    if (s.status !== "ok" || !s.user.emailVerified) return;
    const nova = s.accounts.map((a) => `${a.id}:${a.closed}:${a.members.length}`).join("|");
    if (nova === chave) return;
    chave = nova;
    void hidratarAjustes();
    void hidratarAcertos();
    void hidratarNotificacoes();
  });
  void recarregarSessao();
}
