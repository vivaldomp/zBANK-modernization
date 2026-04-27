import { add, isPositive, subtract, type Cents } from "./money.ts";

export type DepositOk = { ok: true; newBalance: Cents };
export type WithdrawOk = { ok: true; newBalance: Cents };

export type DepositError =
  | { ok: false; error: "INVALID_AMOUNT" };

export type WithdrawError =
  | { ok: false; error: "INVALID_AMOUNT" }
  | { ok: false; error: "INSUFFICIENT_FUNDS" };

export type DepositResult = DepositOk | DepositError;
export type WithdrawResult = WithdrawOk | WithdrawError;

export function deposit(balance: Cents, amount: Cents): DepositResult {
  if (!isPositive(amount)) return { ok: false, error: "INVALID_AMOUNT" };
  return { ok: true, newBalance: add(balance, amount) };
}

export function withdraw(balance: Cents, amount: Cents): WithdrawResult {
  if (!isPositive(amount)) return { ok: false, error: "INVALID_AMOUNT" };
  if (amount > balance) return { ok: false, error: "INSUFFICIENT_FUNDS" };
  return { ok: true, newBalance: subtract(balance, amount) };
}
