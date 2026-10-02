// Primitivas de criptografia só com WebCrypto (roda igual em Workers e Node).

const encoder = new TextEncoder();

/**
 * O runtime do Cloudflare Workers recusa PBKDF2 acima de 100.000 iterações.
 * Com SHA-256 e sal aleatório por senha, é o máximo que a plataforma permite;
 * o formato guarda as iterações para migrar o hash no futuro sem quebrar logins.
 */
export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = "pbkdf2_sha256";

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/** Token opaco para cookies e links de e-mail (256 bits). */
export const randomToken = (bytes = 32) => toBase64Url(randomBytes(bytes));

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante (não para no primeiro byte diferente). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

/** "pbkdf2_sha256$<iterações>$<sal>$<hash>" (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return [PREFIX, PBKDF2_ITERATIONS, toBase64Url(salt), toBase64Url(hash)].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iter, saltB64, hashB64] = stored.split("$");
  const iterations = Number(iter);
  if (prefix !== PREFIX || !Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS || !saltB64 || !hashB64) return false;
  const expected = fromBase64Url(hashB64);
  const actual = await pbkdf2(password, fromBase64Url(saltB64), iterations);
  return timingSafeEqual(actual, expected);
}

/**
 * Hash fixo usado quando o e-mail não existe: o login faz o mesmo trabalho
 * e o tempo de resposta não denuncia quais e-mails têm conta.
 */
let dummyHash: Promise<string> | null = null;
export const getDummyHash = () => (dummyHash ??= hashPassword(randomToken()));
