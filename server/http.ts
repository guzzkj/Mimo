import { z } from "zod";
import { ApiError } from "./errors";
import type { Ctx } from "./context";

/** Lê e valida o corpo JSON. Exige Content-Type JSON (também barra forms cross-site). */
export async function readJson<S extends z.ZodType>(c: Ctx, schema: S): Promise<z.infer<S>> {
  const type = c.req.header("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new ApiError("unsupported_media_type", "Envie o corpo como application/json.");
  }
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError("bad_request", "JSON inválido.");
  }
  return parseWith(schema, raw);
}

export function parseWith<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function validationError(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return new ApiError("validation_failed", "Confira os campos destacados.", { fields });
}

// ---- schemas comuns ------------------------------------------------------------

export const uuidSchema = z.uuid({ error: "Identificador inválido." });

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Data inválida.");

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM.");

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Digite um e-mail válido." }));

/** 8+ caracteres com pelo menos um número (mesma regra da tela de cadastro). */
export const passwordSchema = z.string()
  .min(8, "Use pelo menos 8 caracteres, com um número.")
  .max(128, "Use no máximo 128 caracteres.")
  .regex(/\d/, "Use pelo menos 8 caracteres, com um número.");

export const centsSchema = z.number().int("Valor em centavos deve ser inteiro.").positive("Informe um valor maior que zero.").max(1_000_000_000_00);

export function param(c: Ctx, name: string, schema: z.ZodType<string> = uuidSchema): string {
  const value = c.req.param(name);
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError("not_found", "Recurso não encontrado.");
  return result.data;
}

/** "Hoje" no fuso do Brasil (as datas de vencimento são de calendário local). */
export function todayIso(timeZone = "America/Sao_Paulo", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
