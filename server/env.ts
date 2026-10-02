/** Bindings das Pages Functions (vars do wrangler.toml + segredos). */
export interface Env {
  /** Connection string do Neon (segredo). */
  DATABASE_URL: string;
  /** Chave da API do Resend (segredo). Sem ela, os e-mails só vão para o log. */
  RESEND_API_KEY?: string;
  /** Remetente, ex.: "Mimo <nao-responda@mimo.app>" (domínio verificado no Resend). */
  EMAIL_FROM: string;
  /** Origem pública do app, usada nos links dos e-mails e na checagem de Origin. */
  APP_URL: string;
  APP_ENV?: "development" | "preview" | "production";
  /** Protege /api/internal/* (chamado por um cron externo). */
  CRON_SECRET?: string;
}

export const isProduction = (env: Env) => env.APP_ENV === "production" || env.APP_ENV === "preview";
