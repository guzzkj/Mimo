import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";
import type { Item } from "../types";

const base: Item = {
  id: 1, tipo: "saida", descricao: "Mercado", categoria: "Casa",
  valor: 123.45, data: "2024-05-10", status: "pago", meio: "conta",
};

describe("buildCsv", () => {
  it("mantém texto comum sem alteração", () => {
    const csv = buildCsv([base]);
    expect(csv).toContain('"Mercado"');
    expect(csv).toContain('"Casa"');
    expect(csv).toContain('"123,45"');
  });

  it("neutraliza injeção de fórmula em descrição e categoria", () => {
    const itens: Item[] = [
      { ...base, id: 2, descricao: "=1+1", categoria: "@SUM(A1)" },
      { ...base, id: 3, descricao: "+CMD()", categoria: "-2+3" },
    ];
    const csv = buildCsv(itens);
    // o payload recebe apóstrofo na frente para a planilha tratar como texto
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).toContain(`"'@SUM(A1)"`);
    expect(csv).toContain(`"'+CMD()"`);
    expect(csv).toContain(`"'-2+3"`);
    // nenhuma célula começa com caractere de fórmula logo após as aspas
    expect(csv).not.toMatch(/"[=+\-@]/);
  });

  it("escapa aspas duplas sem reintroduzir fórmula", () => {
    const csv = buildCsv([{ ...base, id: 4, descricao: '=HYPERLINK("http://x")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});
