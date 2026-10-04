import { useEffect, useState } from "react";
import { api, mensagemDeErro } from "../lib/api";
import { exportarCsv } from "../lib/csv";
import { MODO_API } from "../lib/modo";
import { paraItem } from "../lib/remoto/mapear";
import type { MovimentacaoApi } from "../lib/remoto/tipos";
import { lerSessao } from "../lib/sessao";
import { btnPrim, btnSec, CARTAO } from "./mimo/estilos";
import { Spinner } from "./mimo/ui";

interface Situacao { soloAccountId: string; total: number; pending: number }

// Configurações › Duo: o que foi lançado no Solo antes do casal. A conta Solo
// fica guardada como estava (volta se a Duo for desfeita); aqui a pessoa
// baixa esse histórico ou o traz para a Duo como lançamentos privados dela.
export function HistoricoSolo({ nomePar, onAviso }: { nomePar: string; onAviso: (msg: string) => void }) {
  const [sit, setSit] = useState<Situacao | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState<"csv" | "trazer" | null>(null);

  useEffect(() => {
    if (!MODO_API) return;
    let vivo = true;
    api.get<Situacao>("/me/solo-history").then((r) => { if (vivo) setSit(r); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  if (!sit || !sit.total) return null;

  const baixar = () => {
    setOcupado("csv");
    api.get<{ transactions: MovimentacaoApi[] }>(`/accounts/${sit.soloAccountId}/transactions`)
      .then(({ transactions }) => {
        const s = lerSessao();
        const meId = s.status === "ok" ? s.user.id : "";
        exportarCsv(transactions.map((t) => paraItem(t, { duo: false, meId, parId: null })), "mimo-historico-solo.csv");
      })
      .catch((e) => onAviso(mensagemDeErro(e)))
      .finally(() => setOcupado(null));
  };

  const trazer = () => {
    setOcupado("trazer");
    api.post<Situacao & { imported: number }>("/me/solo-history/import")
      .then((r) => {
        setSit(r);
        setConfirmar(false);
        onAviso(r.imported === 1 ? "1 movimentação do Solo agora está na Duo, como privada." : `${r.imported} movimentações do Solo agora estão na Duo, como privadas.`);
      })
      .catch((e) => onAviso(mensagemDeErro(e)))
      .finally(() => setOcupado(null));
  };

  const qtd = (n: number) => (n === 1 ? "1 movimentação" : `${n} movimentações`);
  const tudoNaDuo = sit.pending === 0;

  return (
    <div style={{ ...CARTAO, display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Seu histórico do Solo</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted2)" }}>
          {qtd(sit.total)} de antes da conta Duo. Ficam guardadas como estavam e voltam a aparecer se a Duo for desfeita.
          {tudoNaDuo ? " Tudo já está na Duo como privado." : ""}
        </span>
      </span>
      {confirmar && !tudoNaDuo && (
        <span role="status" style={{ padding: "12px 14px", borderRadius: 14, background: "var(--duo-soft)", color: "var(--ink2)", fontSize: 12.5, lineHeight: 1.5 }}>
          {qtd(sit.pending)} entram na Duo como lançamentos privados seus. {nomePar.charAt(0).toUpperCase() + nomePar.slice(1)} vê só os valores somados nos totais, sem descrição nem categoria. Não entram na divisão.
        </span>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={baixar} disabled={ocupado !== null} className="mm-h-sec" style={btnSec({ height: 42, padding: "0 16px", borderRadius: 13, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 })}>
          {ocupado === "csv" && <Spinner size={14} />}Baixar CSV
        </button>
        {!tudoNaDuo && (confirmar ? (
          <>
            <button type="button" onClick={trazer} disabled={ocupado !== null} className="mm-h-primario" style={btnPrim({ height: 42, padding: "0 16px", borderRadius: 13, fontSize: 13 })}>
              {ocupado === "trazer" && <Spinner size={14} />}Trazer {qtd(sit.pending)}
            </button>
            <button type="button" onClick={() => setConfirmar(false)} disabled={ocupado !== null} style={{ height: 42, padding: "0 12px", border: "none", background: "transparent", color: "var(--muted2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmar(true)} className="mm-h-sec" style={btnSec({ height: 42, padding: "0 16px", borderRadius: 13, fontSize: 13 })}>Trazer para a Duo</button>
        ))}
      </div>
    </div>
  );
}
