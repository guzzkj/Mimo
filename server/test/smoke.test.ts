import { expect, test } from "vitest";
import { createTestDb } from "./db";
import { users } from "../db/schema";

test("migrations apply on a clean Postgres", async () => {
  const { db, close } = await createTestDb();
  const [u] = await db.insert(users).values({ email: "a@b.com", passwordHash: "x" }).returning();
  expect(u.email).toBe("a@b.com");
  await expect(db.insert(users).values({ email: "UPPER@b.com", passwordHash: "x" })).rejects.toThrow();
  await close();
});
