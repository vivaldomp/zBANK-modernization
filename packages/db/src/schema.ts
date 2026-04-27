import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "DEPOSIT",
  "WITHDRAWAL",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountNumber: varchar("account_number", { length: 10 }).notNull().unique(),
  pinHash: varchar("pin_hash", { length: 255 }).notNull(),
  ownerName: varchar("owner_name", { length: 120 }).notNull(),
  balanceCents: bigint("balance_cents", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    balanceAfterCents: bigint("balance_after_cents", {
      mode: "bigint",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byAccount: index("transactions_account_idx").on(t.accountId, t.createdAt),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
