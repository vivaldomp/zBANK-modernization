import { describe, expect, it } from "vitest";
import { deposit, withdraw } from "./bank-engine.ts";

describe("deposit", () => {
  it("adds amount to balance", () => {
    const r = deposit(1000n, 500n);
    expect(r).toEqual({ ok: true, newBalance: 1500n });
  });

  it("rejects zero amount", () => {
    const r = deposit(1000n, 0n);
    expect(r).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });

  it("rejects negative amount", () => {
    const r = deposit(1000n, -1n);
    expect(r).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });

  it("works on zero balance", () => {
    const r = deposit(0n, 100n);
    expect(r).toEqual({ ok: true, newBalance: 100n });
  });
});

describe("withdraw", () => {
  it("subtracts amount from balance", () => {
    const r = withdraw(1000n, 300n);
    expect(r).toEqual({ ok: true, newBalance: 700n });
  });

  it("allows withdrawing exact balance", () => {
    const r = withdraw(500n, 500n);
    expect(r).toEqual({ ok: true, newBalance: 0n });
  });

  it("rejects when amount exceeds balance (bug fix vs COBOL)", () => {
    const r = withdraw(100n, 200n);
    expect(r).toEqual({ ok: false, error: "INSUFFICIENT_FUNDS" });
  });

  it("rejects zero amount", () => {
    const r = withdraw(1000n, 0n);
    expect(r).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });

  it("rejects negative amount", () => {
    const r = withdraw(1000n, -50n);
    expect(r).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });
});
