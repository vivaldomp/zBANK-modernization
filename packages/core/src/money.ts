export type Cents = bigint;

export const ZERO: Cents = 0n;

export function isPositive(amount: Cents): boolean {
  return amount > 0n;
}

export function add(a: Cents, b: Cents): Cents {
  return a + b;
}

export function subtract(a: Cents, b: Cents): Cents {
  return a - b;
}
