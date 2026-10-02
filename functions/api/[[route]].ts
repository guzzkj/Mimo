import { handle } from "hono/cloudflare-pages";
import { createApp } from "../../server/app";

// Pages Function catch-all: toda requisição em /api/* cai no app Hono.
export const onRequest = handle(createApp());
