import { z } from "zod";

export const accountNumberSchema = z
  .string()
  .regex(/^\d{10}$/, "Número da conta deve ter exatamente 10 dígitos");

export const pinSchema = z
  .string()
  .regex(/^\d{10}$/, "PIN deve ter exatamente 10 dígitos");

export const amountCentsSchema = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
  .transform((v) => BigInt(v));

export const loginRequestSchema = z.object({
  accountNumber: accountNumberSchema,
  pin: pinSchema,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const amountRequestSchema = z.object({
  amountCents: amountCentsSchema,
});
export type AmountRequest = z.infer<typeof amountRequestSchema>;

export const accountDtoSchema = z.object({
  id: z.string().uuid(),
  accountNumber: z.string(),
  ownerName: z.string(),
  balanceCents: z.string(),
});
export type AccountDto = z.infer<typeof accountDtoSchema>;

export const transactionTypeSchema = z.enum(["DEPOSIT", "WITHDRAWAL"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionDtoSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  type: transactionTypeSchema,
  amountCents: z.string(),
  balanceAfterCents: z.string(),
  createdAt: z.string(),
});
export type TransactionDto = z.infer<typeof transactionDtoSchema>;

export const balanceResponseSchema = z.object({
  balanceCents: z.string(),
});
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;
