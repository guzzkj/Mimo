import { Chart } from "chart.js/auto";
import { token } from "./storage";

let aplicado = false;

// Fontes e cor padrão dos gráficos, aplicadas uma vez e reaplicadas quando o
// tema muda (os tokens de cor do CSS mudam de valor).
export const aplicarChartDefaults = () => {
  if (!aplicado) {
    Chart.defaults.font.family = '"Manrope", system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    aplicado = true;
  }
  Chart.defaults.color = token("--faint");
};
