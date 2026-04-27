import type { AccountTransactionService, TransactionRecord } from "../ports.ts";

export type WithdrawInput = { accountId: string; amountCents: bigint };
export type WithdrawResult =
  | { ok: true; newBalance: bigint; transaction: TransactionRecord }
  | { ok: false; error: "INVALID_AMOUNT" | "INSUFFICIENT_FUNDS" | "ACCOUNT_NOT_FOUND" };

export class WithdrawUseCase {
  constructor(private readonly txService: AccountTransactionService) {}

  async execute(input: WithdrawInput): Promise<WithdrawResult> {
    if (input.amountCents <= 0n) return { ok: false, error: "INVALID_AMOUNT" };
    const result = await this.txService.applyMovement({
      accountId: input.accountId,
      amountCents: input.amountCents,
      type: "WITHDRAWAL",
    });
    return result;
  }
}
