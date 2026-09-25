import { Chart } from "chart.js/auto";
import { useEffect, useRef } from "react";
import { token } from "../../lib/storage";
import type { Categoria, Tema } from "../../types";

interface Props {
  categorias: Categoria[];
  fmt: (v: number) => string;
  tema: Tema;
}

// Gráfico de rosca das categorias do mês (5 maiores + "Demais", somando todas
// as saídas). Sem saídas, vira um anel neutro só para não sumir da tela.
export function DonutChart({ categorias, fmt, tema }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const fmtRef = useRef(fmt);
  fmtRef.current = fmt;

  const topCategorias = categorias.slice(0, 6);
  const semDados = topCategorias.length === 0;

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
      displayColors: false,
    });

    const rotulos = semDados ? ["Sem saídas"] : topCategorias.map((c) => c.nome);
    const valores = semDados ? [1] : topCategorias.map((c) => c.valor);
    const cores = semDados ? ["rgba(255,255,255,.18)"] : topCategorias.map((c) => c.cor);

    const chart = new Chart(canvasRef.current, {
      type: "doughnut",
      data: { labels: rotulos, datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0, hoverOffset: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: {
            ...estiloTooltip(),
            enabled: !semDados,
            callbacks: { label: (ctx) => ` ${fmtRef.current(Number(ctx.parsed))}` },
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
    const rotulos = semDados ? ["Sem saídas"] : topCategorias.map((c) => c.nome);
    const valores = semDados ? [1] : topCategorias.map((c) => c.valor);
    const cores = semDados ? ["rgba(255,255,255,.18)"] : topCategorias.map((c) => c.cor);
    chart.data.labels = rotulos;
    chart.data.datasets[0].data = valores;
    chart.data.datasets[0].backgroundColor = cores;
    if (chart.options.plugins?.tooltip) chart.options.plugins.tooltip.enabled = !semDados;
    chart.update("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias]);

  return <canvas id="donut-grafico" ref={canvasRef} />;
}
