import type {
  AccountRepository,
  AccountRecord,
} from "@zbank/application";
import type { Database } from "@zbank/db";
import { accounts } from "@zbank/db/schema";
import { eq } from "drizzle-orm";

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: Database) {}

  async findByAccountNumber(accountNumber: string): Promise<AccountRecord | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.accountNumber, accountNumber))
      .limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<AccountRecord | null> {
    const rows = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }
}

function toRecord(row: typeof accounts.$inferSelect): AccountRecord {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    pinHash: row.pinHash,
    ownerName: row.ownerName,
    balanceCents: row.balanceCents,
  };
}
