import type { AccountRepository } from "../ports.ts";

export type GetBalanceResult =
  | { ok: true; balanceCents: bigint; ownerName: string; accountNumber: string }
  | { ok: false; error: "ACCOUNT_NOT_FOUND" };

export class GetBalanceUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(accountId: string): Promise<GetBalanceResult> {
    const account = await this.accounts.findById(accountId);
    if (!account) return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    return {
      ok: true,
      balanceCents: account.balanceCents,
      ownerName: account.ownerName,
      accountNumber: account.accountNumber,
    };
  }
}
