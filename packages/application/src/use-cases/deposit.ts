import type { AccountTransactionService, TransactionRecord } from "../ports.ts";

export type DepositInput = { accountId: string; amountCents: bigint };
export type DepositResult =
  | { ok: true; newBalance: bigint; transaction: TransactionRecord }
  | { ok: false; error: "INVALID_AMOUNT" | "ACCOUNT_NOT_FOUND" };

export class DepositUseCase {
  constructor(private readonly txService: AccountTransactionService) {}

  async execute(input: DepositInput): Promise<DepositResult> {
    if (input.amountCents <= 0n) return { ok: false, error: "INVALID_AMOUNT" };
    const result = await this.txService.applyMovement({
      accountId: input.accountId,
      amountCents: input.amountCents,
      type: "DEPOSIT",
    });
    if (result.ok) return result;
    if (result.error === "INSUFFICIENT_FUNDS") {
      return { ok: false, error: "INVALID_AMOUNT" };
    }
    return { ok: false, error: result.error };
  }
}
