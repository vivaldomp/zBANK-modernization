import type {
  AccountTransactionService,
  MoneyMovementInput,
  MoneyMovementResult,
  TransactionRecord,
} from "@zbank/application";
import type { Database } from "@zbank/db";
import { accounts, transactions } from "@zbank/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export class DrizzleTransactionService implements AccountTransactionService {
  constructor(private readonly db: Database) {}

  async applyMovement(input: MoneyMovementInput): Promise<MoneyMovementResult> {
    if (input.amountCents <= 0n) return { ok: false, error: "INVALID_AMOUNT" };

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .for("update")
        .limit(1);
      const account = rows[0];
      if (!account) return { ok: false, error: "ACCOUNT_NOT_FOUND" } as const;

      const newBalance =
        input.type === "DEPOSIT"
          ? account.balanceCents + input.amountCents
          : account.balanceCents - input.amountCents;

      if (newBalance < 0n) {
        return { ok: false, error: "INSUFFICIENT_FUNDS" } as const;
      }

      await tx
        .update(accounts)
        .set({ balanceCents: newBalance })
        .where(eq(accounts.id, account.id));

      const inserted = await tx
        .insert(transactions)
        .values({
          accountId: account.id,
          type: input.type,
          amountCents: input.amountCents,
          balanceAfterCents: newBalance,
        })
        .returning();
      const row = inserted[0]!;

      const txRecord: TransactionRecord = {
        id: row.id,
        accountId: row.accountId,
        type: row.type,
        amountCents: row.amountCents,
        balanceAfterCents: row.balanceAfterCents,
        createdAt: row.createdAt,
      };

      return { ok: true, newBalance, transaction: txRecord } as const;
    });
  }

  async listTransactions(accountId: string, limit: number): Promise<TransactionRecord[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      type: r.type,
      amountCents: r.amountCents,
      balanceAfterCents: r.balanceAfterCents,
      createdAt: r.createdAt,
    }));
  }
}

// silence unused import warning for `sql` (kept for future raw queries)
void sql;
