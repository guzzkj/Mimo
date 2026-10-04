-- Regra de produto: o plano "duo" (visão do casal) só vale com conta Duo aberta
-- e com as duas pessoas dentro. Ajusta quem estava fora da regra.
UPDATE "users" SET "plan" = 'solo', "updated_at" = now()
WHERE "plan" = 'duo' AND NOT EXISTS (
  SELECT 1 FROM "account_members" m
  JOIN "accounts" a ON a."id" = m."account_id"
  WHERE m."user_id" = "users"."id" AND a."kind" = 'duo' AND a."closed_at" IS NULL
    AND (SELECT count(*) FROM "account_members" x WHERE x."account_id" = a."id") > 1
);--> statement-breakpoint
UPDATE "users" SET "plan" = 'duo', "updated_at" = now()
WHERE "plan" IS DISTINCT FROM 'duo' AND "onboarded_at" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "account_members" m
  JOIN "accounts" a ON a."id" = m."account_id"
  WHERE m."user_id" = "users"."id" AND a."kind" = 'duo' AND a."closed_at" IS NULL
    AND (SELECT count(*) FROM "account_members" x WHERE x."account_id" = a."id") > 1
);
