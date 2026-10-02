import { describe, expect, test } from "vitest";
import { ApiError } from "../errors";
import { crossedMilestones } from "./goals";
import { resolveAccountSettings, resolveMemberPrefs } from "./settings";
import { mergePatch, normalizeTransaction, toTransactionDto, type TransactionInput, type TransactionRow } from "./transactions";

const ME = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const duo = { accountKind: "duo" as const, meId: ME, isMember: (id: string) => id === ME || id === PARTNER };
const solo = { accountKind: "solo" as const, meId: ME, isMember: (id: string) => id === ME };

const base: TransactionInput = {
  type: "expense", description: "Mercado", category: "Mercado", amountCents: 41280, occurredOn: "2026-09-23",
  status: "paid", method: "card", recurring: false, isPrivate: false, split: true,
};

describe("normalizeTransaction", () => {
  test("solo: author is always me, never private or split", () => {
    const t = normalizeTransaction({ ...base, authorUserId: PARTNER, isPrivate: true }, solo);
    expect(t).toMatchObject({ authorUserId: ME, isPrivate: false, split: false });
  });

  test("duo: defaults the author to whoever is posting", () => {
    expect(normalizeTransaction(base, duo).authorUserId).toBe(ME);
  });

  test("duo: rejects authors outside the account", () => {
    expect(() => normalizeTransaction({ ...base, authorUserId: STRANGER }, duo)).toThrow(ApiError);
  });

  test("duo: joint account entries are never private", () => {
    expect(() => normalizeTransaction({ ...base, authorUserId: null, isPrivate: true }, duo)).toThrow(/sempre compartilhados/);
  });

  test("duo: only the author can mark an entry private", () => {
    expect(() => normalizeTransaction({ ...base, authorUserId: PARTNER, isPrivate: true }, duo)).toThrow(/Só quem fez/);
  });

  test("duo: split only applies to shared expenses paid by a person", () => {
    expect(normalizeTransaction({ ...base, authorUserId: null }, duo).split).toBe(false);
    expect(normalizeTransaction({ ...base, isPrivate: true }, duo).split).toBe(false);
    expect(normalizeTransaction({ ...base, type: "income" }, duo).split).toBe(false);
    expect(normalizeTransaction(base, duo).split).toBe(true);
  });

  test("income is never on the card", () => {
    expect(normalizeTransaction({ ...base, type: "income" }, duo).method).toBe("account");
  });
});

const row = (over: Partial<TransactionRow> = {}): TransactionRow => ({
  id: 7, accountId: "a", createdBy: PARTNER, authorUserId: PARTNER, type: "expense", description: "Presente", category: "Presentes",
  amountCents: 24000, occurredOn: "2026-09-20", status: "paid", method: "account", groupId: 3, installmentNumber: 1, installmentTotal: 2,
  recurring: false, isPrivate: true, split: false, createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe("privacy redaction", () => {
  test("partner's private entry shows only the amount", () => {
    const dto = toTransactionDto(row(), ME);
    expect(dto).toMatchObject({ description: "Lançamento privado", category: "Privado", amountCents: 24000, redacted: true, groupId: null, installment: null });
  });

  test("the author sees everything", () => {
    expect(toTransactionDto(row(), PARTNER)).toMatchObject({ description: "Presente", category: "Presentes", redacted: false, installment: { number: 1, total: 2 } });
  });

  test("shared entries are not redacted", () => {
    expect(toTransactionDto(row({ isPrivate: false }), ME).redacted).toBe(false);
  });
});

describe("mergePatch", () => {
  test("keeps unspecified fields and allows clearing the installment", () => {
    const merged = mergePatch(row({ isPrivate: false }), { amountCents: 100, installment: null });
    expect(merged).toMatchObject({ amountCents: 100, description: "Presente", installment: null, authorUserId: PARTNER });
  });
});

describe("crossedMilestones", () => {
  test("reports every milestone crossed by one contribution", () => {
    expect(crossedMilestones(2000, 5500, 10000)).toEqual([25, 50]);
    expect(crossedMilestones(9000, 10000, 10000)).toEqual([100]);
    expect(crossedMilestones(2500, 2600, 10000)).toEqual([]);
    expect(crossedMilestones(0, 100, 0)).toEqual([]);
  });
});

describe("settings resolution", () => {
  test("fills defaults and falls back when stored json is invalid", () => {
    expect(resolveAccountSettings("duo", {}).spendingLimitCents).toBe(600000);
    expect(resolveAccountSettings("solo", { card: { closingDay: 99, dueDay: 10 } } as never).card.closingDay).toBe(3);
    expect(resolveMemberPrefs({ alerts: { email: true } }).alerts).toMatchObject({ email: true, bills: true });
  });
});
