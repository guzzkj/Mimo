import { addDaysIso } from "../http";
import type { Fetcher } from "./types";
import { unzipFirstEntry } from "./zip";

// Série histórica oficial da B3 (COTAHIST): um arquivo de largura fixa por
// pregão, gratuito, publicado à noite. Layout: "SeriesHistoricas_Layout.pdf" da B3.
// https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/series-historicas/

export interface DailyClose {
  symbol: string;
  date: string;
  closeCents: number;
}

const MERCADO_A_VISTA = "010";

/** Fechamentos do mercado à vista (ações, FIIs, ETFs, BDRs, units) de um arquivo COTAHIST. */
export function parseCotahist(text: string): DailyClose[] {
  const out: DailyClose[] = [];
  for (const line of text.split(/\r?\n/)) {
    // 01 = registro de cotação; 00 e 99 são cabeçalho e rodapé
    if (!line.startsWith("01") || line.slice(24, 27) !== MERCADO_A_VISTA) continue;
    const d = line.slice(2, 10);
    out.push({
      symbol: line.slice(12, 24).trim(),
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      // PREULT: 13 dígitos com 2 casas decimais implícitas = centavos
      closeCents: Number(line.slice(108, 121)),
    });
  }
  return out;
}

const fileUrl = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D${d}${m}${y}.ZIP`;
};

/**
 * Baixa o pregão mais recente até `fromIso` (volta até 7 dias por causa de fim
 * de semana e feriado; a B3 responde 404 para dia sem pregão).
 */
export async function fetchLatestCotahist(fetcher: Fetcher, fromIso: string): Promise<{ date: string; closes: DailyClose[] } | null> {
  for (let back = 0; back < 7; back++) {
    const date = addDaysIso(fromIso, -back);
    const res = await fetcher(fileUrl(date));
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`COTAHIST ${date}: HTTP ${res.status}`);
    const text = new TextDecoder("latin1").decode(await unzipFirstEntry(new Uint8Array(await res.arrayBuffer())));
    return { date, closes: parseCotahist(text) };
  }
  return null;
}
