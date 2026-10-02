import type { Env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Evita envio duplicado se a mesma requisição for repetida (header do Resend). */
  idempotencyKey?: string;
  tag?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Envia pela API REST do Resend (fetch puro, sem SDK: roda em Workers).
 * Sem RESEND_API_KEY (ex.: desenvolvimento), apenas registra no console —
 * nada sai para caixas de e-mail reais.
 */
export function createResendMailer(env: Env, fetcher: typeof fetch = fetch): Mailer {
  return {
    async send(message) {
      if (!env.RESEND_API_KEY) {
        console.info(`[email:log] para=${message.to} assunto="${message.subject}"\n${message.text}`);
        return;
      }
      const res = await fetcher(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.tag ? { tags: [{ name: "category", value: message.tag }] } : {}),
        }),
      });
      if (!res.ok) {
        // não expõe a chave nem o corpo inteiro; o suficiente para depurar
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`Resend respondeu ${res.status}: ${detail}`);
      }
    },
  };
}

/** Mailer de teste: guarda as mensagens em memória. */
export function createMemoryMailer() {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = { async send(message) { sent.push(message); } };
  return { mailer, sent };
}
