import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { deflateRawSync } from "node:zlib";
import { assetPricesDaily, assets } from "../db/schema";
import { parseCotahist } from "../market/cotahist";
import { parseChart, yahooSymbol } from "../market/yahoo";
import { unzipFirstEntry } from "../market/zip";
import { setupApi } from "./harness";

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Linha de cotação no layout de largura fixa do COTAHIST (245 caracteres). */
const cotahistLine = (symbol: string, date: string, closeCents: number, market = "010") =>
  ("01" + date.replaceAll("-", "") + "02" + symbol.padEnd(12) + market + " ".repeat(81) + String(closeCents).padStart(13, "0")).padEnd(245, "0");

/** ZIP de uma entrada só, como o da B3. */
function zipOf(name: string, content: string, method: 0 | 8 = 8): Uint8Array<ArrayBuffer> {
  const raw = Buffer.from(content, "latin1");
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const fileName = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + fileName.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + fileName.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return new Uint8Array(Buffer.concat([local, fileName, data, central, fileName, eocd]));
}

const petr4Chart = {
  chart: {
    result: [{
      meta: { currency: "BRL", longName: "Petróleo Brasileiro S.A. - Petrobras", regularMarketPrice: 51.17, regularMarketTime: unix("2026-10-02T20:00:00Z"), gmtoffset: -10800 },
      timestamp: [unix("2026-10-01T13:00:00Z"), unix("2026-10-02T13:00:00Z")],
      indicators: { quote: [{ close: [49.77, 51.17] }] },
      events: {
        dividends: { [unix("2026-08-24T13:00:00Z")]: { amount: 1.3481, date: unix("2026-08-24T13:00:00Z") } },
        splits: { [unix("2026-05-04T13:00:00Z")]: { date: unix("2026-05-04T13:00:00Z"), numerator: 2, denominator: 1 } },
      },
    }],
    error: null,
  },
};

describe("market parsers", () => {
  test("COTAHIST keeps only the spot market, in cents", () => {
    const text = ["00COTAHIST.2026BOVESPA 20261002", cotahistLine("PETR4", "2026-10-02", 5117), cotahistLine("PETRJ520", "2026-10-02", 12, "070"), "99COTAHIST.2026BOVESPA 20261002"].join("\r\n");
    expect(parseCotahist(text)).toEqual([{ symbol: "PETR4", date: "2026-10-02", closeCents: 5117 }]);
  });

  test("unzips stored and deflated entries", async () => {
    const decode = (b: Uint8Array) => new TextDecoder("latin1").decode(b);
    expect(decode(await unzipFirstEntry(zipOf("a.txt", "olá mundo", 0)))).toBe("olá mundo");
    expect(decode(await unzipFirstEntry(zipOf("a.txt", "olá mundo ".repeat(500))))).toBe("olá mundo ".repeat(500));
  });

  test("Yahoo chart: B3 suffix, exchange-local dates, dividends and splits", () => {
    expect(yahooSymbol("PETR4")).toBe("PETR4.SA");
    expect(yahooSymbol("TAEE11")).toBe("TAEE11.SA");
    expect(yahooSymbol("AAPL")).toBe("AAPL");
    const chart = parseChart(petr4Chart)!;
    expect(chart).toMatchObject({ currency: "BRL", priceCents: 5117, closes: [{ date: "2026-10-01", closeCents: 4977 }, { date: "2026-10-02", closeCents: 5117 }] });
    expect(chart.dividends).toEqual([{ exDate: "2026-08-24", amount: 1.3481 }]);
    expect(chart.splits).toEqual([{ exDate: "2026-05-04", ratio: 2 }]);
    expect(parseChart({ chart: { result: null, error: { code: "Not Found" } } })).toBeNull();
  });
});

describe("market sync", () => {
  const requested: string[] = [];
  let cotahistCalls = 0;
  let api: Awaited<ReturnType<typeof setupApi>>;
  beforeAll(async () => {
    api = await setupApi({
      fetch: async (url) => {
        requested.push(url);
        if (url.includes("COTAHIST")) {
          // primeiro dia consultado "sem pregão": precisa voltar um dia
          if (cotahistCalls++ === 0) return new Response("not found", { status: 404 });
          const text = [cotahistLine("PETR4", "2026-10-02", 5200), cotahistLine("VALE3", "2026-10-02", 6100)].join("\n");
          return new Response(zipOf("COTAHIST_D02102026.TXT", text));
        }
        if (url.includes("/PETR4.SA?")) return Response.json(petr4Chart);
        if (url.includes("/HGLG11.SA?")) return new Response("boom", { status: 500 });
        return Response.json({ chart: { result: null, error: { code: "Not Found" } } }, { status: 404 });
      },
    });
  });
  afterAll(async () => { await api.close(); });

  const internal = (path: string) => api.app.request(`/api/internal/${path}`, { method: "POST", headers: { authorization: "Bearer segredo-de-teste" } }, api.env);

  test("quotes, dividends and official closes flow into the portfolio", async () => {
    const r = await api.signupVerified("carteira@example.com", { plan: "solo" });
    const other = await api.signupVerified("outra-carteira@example.com", { plan: "solo" });
    for (const body of [{ ticker: "petr4", quantity: "10", averagePriceCents: 3000 }, { ticker: "HGLG11", quantity: "2", averagePriceCents: 15000 }, { ticker: "ZZZZ9", quantity: "1", averagePriceCents: 100 }]) {
      expect((await r.agent.post(`/accounts/${r.solo}/investments`, body)).status).toBe(201);
    }

    expect((await api.app.request("/api/internal/market/quotes", { method: "POST" }, api.env)).status).toBe(404);
    expect(await (await internal("market/quotes")).json()).toEqual({ synced: 1, notFound: 1, errors: 1, remaining: 0 });
    expect(requested.find((u) => u.includes("PETR4.SA"))).toContain("range=2y");
    // em dia: a segunda chamada não refaz ninguém
    expect(await (await internal("market/quotes")).json()).toMatchObject({ synced: 0, remaining: 0 });
    // depois do backfill, só a janela curta
    await internal("market/quotes?freshMinutes=0");
    expect(requested.filter((u) => u.includes("PETR4.SA")).at(-1)).toContain("range=3mo");

    const list = await r.agent.get(`/accounts/${r.solo}/investments`);
    const petr = list.json.investments.find((i: { ticker: string }) => i.ticker === "PETR4");
    expect(petr).toMatchObject({ quote: { priceCents: 5117, currency: "BRL" }, marketValueCents: 51170 });
    expect(list.json.investments.find((i: { ticker: string }) => i.ticker === "ZZZZ9")).toMatchObject({ quote: null, marketValueCents: null });

    const divs = await r.agent.get(`/accounts/${r.solo}/investments/dividends?from=2026-01-01&to=2026-12-31`);
    expect(divs.json.dividends).toEqual([expect.objectContaining({ ticker: "PETR4", exDate: "2026-08-24", amountPerShare: "1.34810000", quantity: "10.00000000", estimatedCents: 1348 })]);
    expect((await other.agent.get(`/accounts/${other.solo}/investments/dividends?from=2026-01-01&to=2026-12-31`)).json.dividends).toEqual([]);
    expect((await r.agent.get(`/accounts/${r.solo}/investments/dividends?from=ontem`)).status).toBe(422);

    // fechamento oficial da B3 substitui o do Yahoo e vira a última cotação
    const eod = await (await internal("market/eod")).json() as { date: string; saved: number };
    expect(eod.saved).toBe(1);
    const [close] = await api.db.select().from(assetPricesDaily).where(and(eq(assetPricesDaily.symbol, "PETR4"), eq(assetPricesDaily.date, "2026-10-02")));
    expect(close).toMatchObject({ closeCents: 5200, source: "cotahist" });
    const [asset] = await api.db.select().from(assets).where(eq(assets.symbol, "PETR4"));
    expect(asset.lastPriceCents).toBe(5200);
    expect((await api.db.select().from(assets).where(eq(assets.symbol, "VALE3")))).toHaveLength(0);
  });
});
