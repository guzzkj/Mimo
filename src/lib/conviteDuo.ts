import { useEffect, useState } from "react";
import { api } from "./api";
import { MODO_API } from "./modo";
import type { ConviteApi } from "./remoto/tipos";
import { contaDoTipo, useSessao } from "./sessao";

/**
 * Convite Duo que a pessoa enviou e o par ainda não aceitou. Enquanto ele
 * estiver pendente, a pessoa segue no Solo (o plano só vira Duo no aceite).
 */
export function useConviteDuoPendente(): ConviteApi | null {
  const sessao = useSessao();
  const duo = contaDoTipo("duo", sessao);
  const id = duo && duo.members.length < 2 ? duo.id : null;
  const [convite, setConvite] = useState<{ conta: string; convite: ConviteApi } | null>(null);

  useEffect(() => {
    if (!MODO_API || !id) return;
    let vivo = true;
    api.get<{ invites: ConviteApi[] }>(`/accounts/${id}/invites`)
      .then(({ invites }) => {
        if (!vivo) return;
        const pend = invites.find((i) => i.status === "pending") ?? null;
        setConvite(pend ? { conta: id, convite: pend } : null);
      })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [id]);

  // a conta pode ter mudado (aceite, desvínculo) antes da resposta chegar
  return convite && convite.conta === id ? convite.convite : null;
}
