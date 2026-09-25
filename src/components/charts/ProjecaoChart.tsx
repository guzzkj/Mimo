import { useState, type PointerEvent } from "react";
import type { PontoSaldo } from "../../types";

interface Props {
  pontos: PontoSaldo[];
  diaDeHoje: number;
  fmt: (v: number) => string;
  /** "set": rótulo curto do mês para o eixo. */
  mesCurto: string;
}

// Saldo dia a dia: linha cheia até hoje (realizado) e tracejada até o fim do
// mês (previsto, com as contas em aberto e as recorrentes). O SVG estica na
// largura; textos ficam em HTML para não crescerem com a tela.
export function ProjecaoChart({ pontos, diaDeHoje, fmt, mesCurto }: Props) {
  const [foco, setFoco] = useState<number | null>(null);
  const valores = pontos.flatMap((p) => [p.real, p.previsto]).filter((v): v is number => v != null);
  if (!valores.length) return null;

  // A escala segue a faixa do mês (não começa em zero), para a variação aparecer.
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const folga = Math.max((max - min) * 0.25, Math.abs(max) * 0.02, 1);
  const topo = max + folga;
  const base = min - folga;
  const n = pontos.length;
  const X = (dia: number) => ((dia - 1) / Math.max(1, n - 1)) * 100;
  const Y = (v: number) => 100 - ((v - base) / (topo - base)) * 100;

  const caminho = (chave: "real" | "previsto") => pontos
    .filter((p) => p[chave] != null)
    .map((p, i) => `${i ? "L" : "M"}${X(p.dia).toFixed(2)} ${Y(p[chave]!).toFixed(2)}`)
    .join(" ");
  const real = caminho("real");
  const previsto = caminho("previsto");
  const reais = pontos.filter((p) => p.real != null);
  const area = reais.length ? `${real} L${X(reais[reais.length - 1].dia).toFixed(2)} 100 L${X(reais[0].dia).toFixed(2)} 100 Z` : "";
  const zeroY = min < 0 ? Y(0) : null;

  const hoje = diaDeHoje ? pontos[diaDeHoje - 1] : null;
  const pf = foco != null ? pontos[foco] : null;
  const valorFoco = pf ? (pf.real ?? pf.previsto) : null;

  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setFoco(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="projecao">
      <div
        className="projecao__area"
        onPointerMove={aoMover}
        onPointerLeave={() => setFoco(null)}
        role="img"
        aria-label={`Saldo do mês: ${fmt(valores[valores.length - 1])} previsto no dia ${n}.`}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {zeroY != null && <line x1="0" x2="100" y1={zeroY} y2={zeroY} className="projecao__zero" vectorEffect="non-scaling-stroke" />}
          {area && <path d={area} className="projecao__preench" />}
          {real && <path d={real} className="projecao__real" vectorEffect="non-scaling-stroke" />}
          {previsto && <path d={previsto} className="projecao__prev" vectorEffect="non-scaling-stroke" />}
          {pf && <line x1={X(pf.dia)} x2={X(pf.dia)} y1="0" y2="100" className="projecao__guia" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hoje && hoje.real != null && <span className="projecao__ponto" style={{ left: `${X(hoje.dia)}%`, top: `${Y(hoje.real)}%` }} />}
        {pf && valorFoco != null && (
          <span className="projecao__dica" style={{ left: `${Math.min(88, Math.max(12, X(pf.dia)))}%` }}>
            <b>{`${pf.dia} ${mesCurto}`}</b>{` ${fmt(valorFoco)}${pf.real == null ? " previsto" : ""}`}
          </span>
        )}
      </div>
      <div className="projecao__eixo">
        <span>{`1 ${mesCurto}`}</span>
        {diaDeHoje > 0 && diaDeHoje < n && <b style={{ left: `${X(diaDeHoje)}%` }}>hoje</b>}
        <span>{`${n} ${mesCurto}`}</span>
      </div>
    </div>
  );
}
