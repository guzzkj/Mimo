// Cliente HTTP da API (/api/*). Cookie de sessão httpOnly vai sozinho
// (mesma origem); o corpo é sempre JSON.

export class ErroApi extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly retryAfter: number | null;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}, retryAfter: number | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

const SEM_REDE = "Sem conexão com o Mimo agora. Confira a internet e tente de novo.";

async function requisitar<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ErroApi(0, "network", SEM_REDE);
  }
  if (res.status === 204 || res.status === 202) return undefined as T;
  const texto = await res.text();
  let json: unknown = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* corpo não-JSON (ex.: proxy fora do ar) */ }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    const retry = Number(res.headers.get("retry-after"));
    throw new ErroApi(res.status, e?.code ?? "http_" + res.status, e?.message ?? SEM_REDE, e?.fields ?? {}, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => requisitar<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => requisitar<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => requisitar<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => requisitar<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => requisitar<T>("DELETE", path, body),
};

/** Mensagem pronta para mostrar na tela a partir de qualquer erro. */
export const mensagemDeErro = (e: unknown) => (e instanceof ErroApi ? e.message : "Algo deu errado. Tente de novo.");
