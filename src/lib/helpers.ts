import { MESES, MESES_LONGOS } from "./constants";

export { MESES, MESES_LONGOS };

export const pad = (n: number) => String(n).padStart(2, "0");

export const isoDe = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Datas de referência, calculadas uma vez a partir do relógio real.
export const HOJE = new Date();
export const HOJE_ISO = isoDe(HOJE);
export const MES_REF = HOJE_ISO.slice(0, 7);
export const DIA_HOJE = HOJE.getDate();
export const DIAS_NO_MES = new Date(HOJE.getFullYear(), HOJE.getMonth() + 1, 0).getDate();

// Monta a data de um exemplo a partir de quantos meses atrás ele fica.
export const dataSeed = (mesesAtras: number, dia: number) => {
  const mes = new Date(HOJE.getFullYear(), HOJE.getMonth() - mesesAtras, 1);
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  return `${mes.getFullYear()}-${pad(mes.getMonth() + 1)}-${pad(Math.min(dia, ultimoDia))}`;
};

// Devolve a chave do mês anterior no formato ano-mês.
export const mesAnterior = (chave: string) => {
  const [ano, mes] = chave.split("-").map(Number);
  const d = new Date(ano, mes - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// Escapa caracteres especiais antes de inserir texto no HTML (mantido por
// paridade com o original; em React o JSX já escapa por padrão, mas esta
// função continua disponível onde texto é montado manualmente).
export const esc = (valor: unknown) => String(valor).replace(/[&<>"']/g, (ch) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string
));

export const formatador = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

// Converte um valor digitado no formato brasileiro em número.
export const parseNum = (texto: string) => {
  const limpo = String(texto).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isNaN(n) ? NaN : n;
};

// "2026-09-01" -> "01/09/2026"
export const dataBr = (iso: string) => {
  const [ano, mes, dia] = String(iso).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
};

// "01/09/2026" -> "2026-09-01"; devolve "" se não for uma data completa e real.
export const isoDeBr = (texto: string) => {
  const partes = String(texto).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return "";
  const [, dia, mes, ano] = partes;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const existe = d.getFullYear() === Number(ano)
    && d.getMonth() === Number(mes) - 1
    && d.getDate() === Number(dia);
  return existe ? `${ano}-${mes}-${dia}` : "";
};

// A mesma data, N meses adiante, sem estourar mês curto (31/01 -> 28/02).
export const dataAdiante = (iso: string, meses: number) => {
  const [ano, mes, dia] = String(iso).split("-").map(Number);
  const alvo = new Date(ano, mes - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return `${alvo.getFullYear()}-${pad(alvo.getMonth() + 1)}-${pad(Math.min(dia, ultimoDia))}`;
};

// Divide um total em N parcelas trabalhando em centavos: o que sobra da
// divisão vai para a primeira, então a soma das parcelas bate com o total.
export const dividirEmParcelas = (total: number, quantas: number) => {
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / quantas);
  const resto = centavos - base * quantas;
  return Array.from({ length: quantas }, (_, i) => (i === 0 ? base + resto : base) / 100);
};

// Vai pondo as barras conforme se digita, e ignora o que não é dígito.
export const mascaraData = (texto: string) => {
  const n = String(texto).replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
};

// Formata uma data ISO no padrão dia mês ano.
export const dataFmt = (iso: string) => {
  const [ano, mes, dia] = String(iso).split("-");
  return `${dia} ${MESES[Number(mes) - 1]} ${ano}`;
};

// Calcula a porcentagem arredondada e evita divisão por zero.
export const pct = (parte: number, total: number) => Math.round((parte / (total || 1)) * 100);

// Cria um formulário em branco com a data de hoje.
export const formVazio = (): import("../types").FormState => ({
  tipo: "saida",
  descricao: "",
  valor: "",
  data: dataBr(HOJE_ISO),
  categoria: "Mercado",
  status: "pago",
  parcelado: false,
  parcelas: "2",
});
