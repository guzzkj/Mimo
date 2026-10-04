/** `fetch` injetável (testes passam um falso; produção usa o global). */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
