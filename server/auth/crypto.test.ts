import { describe, expect, test } from "vitest";
import { fromBase64Url, hashPassword, PBKDF2_ITERATIONS, randomToken, sha256Hex, timingSafeEqual, toBase64Url, verifyPassword } from "./crypto";

describe("password hashing", () => {
  test("round-trips and rejects a wrong password", async () => {
    const hash = await hashPassword("mimo2026casa");
    expect(hash.startsWith(`pbkdf2_sha256$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(await verifyPassword("mimo2026casa", hash)).toBe(true);
    expect(await verifyPassword("mimo2026Casa", hash)).toBe(false);
  });

  test("salts every hash", async () => {
    expect(await hashPassword("igual123")).not.toBe(await hashPassword("igual123"));
  });

  test("rejects malformed or out-of-policy hashes", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "md5$1$a$b")).toBe(false);
    // acima do limite do Workers: recusado em vez de explodir em produção
    expect(await verifyPassword("x", "pbkdf2_sha256$900000$AAAA$AAAA")).toBe(false);
  });
});

describe("tokens and encoding", () => {
  test("base64url round-trip", () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 128, 1]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
  });

  test("random tokens are url-safe and unique", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  test("sha256 hex and constant-time compare", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
