import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { consents } from "../db/schema";

/** Finalidades opcionais de consentimento (LGPD art. 8º). */
export const CONSENT_PURPOSES = ["marketing", "analytics"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const consentUpdateSchema = z
  .object({
    marketing: z.boolean().optional(),
    analytics: z.boolean().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Informe ao menos uma finalidade.");

export type ConsentState = Record<ConsentPurpose, boolean>;

/** Estado atual dos consentimentos opcionais (ausente = não concedido). */
export async function listConsents(db: Db, userId: string): Promise<ConsentState> {
  const rows = await db.select().from(consents).where(eq(consents.userId, userId));
  const state: ConsentState = { marketing: false, analytics: false };
  for (const r of rows) state[r.purpose] = r.granted;
  return state;
}

/** Concede ou revoga um consentimento (upsert idempotente). */
export async function setConsent(
  db: Db,
  userId: string,
  purpose: ConsentPurpose,
  granted: boolean,
  version: string | null,
): Promise<void> {
  await db
    .insert(consents)
    .values({ userId, purpose, granted, version })
    .onConflictDoUpdate({
      target: [consents.userId, consents.purpose],
      set: { granted, version, updatedAt: new Date() },
    });
}
