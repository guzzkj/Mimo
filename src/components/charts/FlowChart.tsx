import { Chart } from "chart.js/auto";
import { useEffect, useRef } from "react";
import { token } from "../../lib/storage";
import type { MesSerie, Tema } from "../../types";

interface Props {
  serie: MesSerie[];
  fmt: (v: number) => string;
  privado: boolean;
  tema: Tema;
}

// Gráfico de barras dos últimos 12 meses. Criado uma vez por tema (a troca de
// tema recria as cores lidas dos tokens do CSS) e depois só atualizado com
// dados novos via chart.update("none"), igual ao original.
export function FlowChart({ serie, fmt, privado, tema }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const fmtRef = useRef(fmt);
  const privadoRef = useRef(privado);
  fmtRef.current = fmt;
  privadoRef.current = privado;

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const estiloTooltip = () => ({
      backgroundColor: token("--surface"),
      titleColor: token("--ink"),
      bodyColor: token("--muted"),
      borderColor: `rgba(${token("--ink-rgb")}, 0.14)`,
      borderWidth: 1,
      padding: 11,
      cornerRadius: 10,
      boxPadding: 5,
      titleFont: { weight: 700 as const },
      displayColors: true,
    });

    const rotulos = serie.map((m) => m.label);
    const entradas = serie.map((m) => m.entradas);
    const saidas = serie.map((m) => m.saidas);

    const chart = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: rotulos,
        datasets: [
          { label: "Entradas", data: entradas, backgroundColor: token("--in"), borderRadius: 6, maxBarThickness: 15 },
          { label: "Saídas", data: saidas, backgroundColor: token("--out"), borderRadius: 6, maxBarThickness: 15 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...estiloTooltip(),
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtRef.current(ctx.parsed.y ?? 0)}` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: token("--faint") },
          },
          y: {
            beginAtZero: true,
            grid: { color: `rgba(${token("--ink-rgb")}, 0.08)` },
            border: { display: false },
            ticks: {
              color: token("--faint-2"),
              maxTicksLimit: 5,
              callback: (valor) => {
                if (privadoRef.current) return "";
                const n = Number(valor);
                return n >= 1000 ? `${String(n / 1000).replace(".", ",")} mil` : n;
              },
            },
          },
        },
      },
    });

    chartRef.current = chart;
    return () => { chart.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.labels = serie.map((m) => m.label);
    chart.data.datasets[0].data = serie.map((m) => m.entradas);
    chart.data.datasets[1].data = serie.map((m) => m.saidas);
    chart.update("none");
  }, [serie, privado]);

  return <canvas id="grafico-meses" ref={canvasRef} />;
}
