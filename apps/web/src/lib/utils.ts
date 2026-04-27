import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(cents: bigint | string | number): string {
  const value = typeof cents === "bigint" ? cents : BigInt(cents);
  const reais = Number(value) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(reais);
}

export function parseBRLToCents(input: string): bigint | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return BigInt(Math.round(num * 100));
}

export function formatAccountNumber(n: string): string {
  return n.replace(/(\d{4})(\d{2})(\d{4})/, "$1.$2.$3");
}
