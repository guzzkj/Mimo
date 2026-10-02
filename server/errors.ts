export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unsupported_media_type"
  | "unauthenticated"
  | "email_not_verified"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "gone"
  | "too_many_requests"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unsupported_media_type: 415,
  unauthenticated: 401,
  email_not_verified: 403,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  gone: 410,
  too_many_requests: 429,
  internal: 500,
};

/** Erro de domínio que vira resposta JSON `{ error: { code, message, fields? } }`. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;

  constructor(code: ErrorCode, message: string, extra: { fields?: Record<string, string>; retryAfter?: number } = {}) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fields = extra.fields;
    this.retryAfter = extra.retryAfter;
  }
}

export const notFound = (what = "Recurso") => new ApiError("not_found", `${what} não encontrado.`);
export const forbidden = (message = "Você não tem acesso a este recurso.") => new ApiError("forbidden", message);
