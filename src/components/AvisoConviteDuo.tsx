import { Link } from "react-router-dom";
import { useConviteDuoPendente } from "../lib/conviteDuo";

// Faixa da visão geral Solo: lembra que há um convite Duo esperando o par.
// Até o aceite a pessoa segue no Solo; depois o painel passa a ser o do casal.
export function AvisoConviteDuo() {
  const convite = useConviteDuoPendente();
  if (!convite) return null;
  return (
    <div className="aviso-duo" role="status">
      <span className="aviso-duo__ponto" aria-hidden="true" />
      <span className="aviso-duo__texto">
        <strong>{convite.expired ? "Seu convite Duo expirou" : "Convite Duo pendente"}</strong>
        <small>
          {convite.expired
            ? `${convite.email} não aceitou a tempo. Envie um novo convite para começar a conta do casal.`
            : `Esperando ${convite.email} aceitar. Até lá, você segue no Solo; depois, o painel passa a ser o do casal.`}
        </small>
      </span>
      <Link className="aviso-duo__acao" to="/ajustes/duo">{convite.expired ? "Reenviar" : "Ver convite"}</Link>
    </div>
  );
}
