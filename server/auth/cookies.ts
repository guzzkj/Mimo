import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Ctx } from "../context";
import { isProduction } from "../env";

// Em produção, prefixo __Host-: exige Secure, Path=/ e proíbe Domain (o cookie
// não vaza para subdomínios). Em dev (http://localhost) usa o nome simples.
const cookieName = (c: Ctx) => (isProduction(c.env) ? "__Host-mimo_session" : "mimo_session");

export const readSessionCookie = (c: Ctx) => getCookie(c, cookieName(c)) ?? null;

export function writeSessionCookie(c: Ctx, token: string, expiresAt: Date) {
  setCookie(c, cookieName(c), token, {
    httpOnly: true,
    secure: isProduction(c.env),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Ctx) {
  deleteCookie(c, cookieName(c), { path: "/", secure: isProduction(c.env) });
}
