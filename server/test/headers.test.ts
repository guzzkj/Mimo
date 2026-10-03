import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf-8");

describe("security headers (public/_headers)", () => {
  const headers = read("public/_headers");

  test("define uma CSP com defaults restritivos", () => {
    const csp = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    // script-src não pode liberar 'unsafe-inline' (abriria XSS)
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test("a CSP cobre o script inline de tema nas duas quebras de linha (CRLF/LF)", () => {
    // o browser faz o hash dos bytes crus do script como servido; incluímos
    // as variantes CRLF e LF para o line-ending não quebrar a página.
    const raw = readFileSync(root + "index.html");
    const inline = raw.subarray(raw.indexOf("<script>") + 8, raw.indexOf("</script>"));
    const crlf = createHash("sha256").update(inline).digest("base64");
    const lf = createHash("sha256").update(Buffer.from(inline.toString("utf-8").replace(/\r\n/g, "\n"))).digest("base64");
    expect(headers).toContain(`'sha256-${crlf}'`);
    expect(headers).toContain(`'sha256-${lf}'`);
  });
});
