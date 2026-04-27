import type { AccountTransactionService, TransactionRecord } from "../ports.ts";

export class GetHistoryUseCase {
  constructor(private readonly txService: AccountTransactionService) {}

  execute(accountId: string, limit = 50): Promise<TransactionRecord[]> {
    return this.txService.listTransactions(accountId, limit);
  }
}
