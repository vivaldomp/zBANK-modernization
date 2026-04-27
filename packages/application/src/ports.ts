export type AccountRecord = {
  id: string;
  accountNumber: string;
  pinHash: string;
  ownerName: string;
  balanceCents: bigint;
};

export type TransactionRecord = {
  id: string;
  accountId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amountCents: bigint;
  balanceAfterCents: bigint;
  createdAt: Date;
};

export interface AccountRepository {
  findByAccountNumber(accountNumber: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
}

export type MoneyMovementInput = {
  accountId: string;
  amountCents: bigint;
  type: "DEPOSIT" | "WITHDRAWAL";
};

export type MoneyMovementResult =
  | { ok: true; newBalance: bigint; transaction: TransactionRecord }
  | { ok: false; error: "ACCOUNT_NOT_FOUND" | "INSUFFICIENT_FUNDS" | "INVALID_AMOUNT" };

export interface AccountTransactionService {
  applyMovement(input: MoneyMovementInput): Promise<MoneyMovementResult>;
  listTransactions(accountId: string, limit: number): Promise<TransactionRecord[]>;
}

export interface PinHasher {
  verify(pin: string, hash: string): Promise<boolean>;
  hash(pin: string): Promise<string>;
}

export interface SessionStore {
  create(accountId: string): Promise<string>;
  get(sessionId: string): Promise<string | null>;
  destroy(sessionId: string): Promise<void>;
}
