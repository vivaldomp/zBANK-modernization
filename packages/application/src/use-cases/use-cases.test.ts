import { describe, expect, it } from "vitest";
import { LoginUseCase } from "./login.ts";
import { DepositUseCase } from "./deposit.ts";
import { WithdrawUseCase } from "./withdraw.ts";
import { GetBalanceUseCase } from "./get-balance.ts";
import { GetHistoryUseCase } from "./get-history.ts";
import type {
  AccountRecord,
  AccountRepository,
  AccountTransactionService,
  MoneyMovementInput,
  MoneyMovementResult,
  PinHasher,
  SessionStore,
  TransactionRecord,
} from "../ports.ts";

class FakeAccountRepository implements AccountRepository {
  private byNumber = new Map<string, AccountRecord>();
  private byId = new Map<string, AccountRecord>();
  add(a: AccountRecord) {
    this.byNumber.set(a.accountNumber, a);
    this.byId.set(a.id, a);
  }
  async findByAccountNumber(n: string) {
    return this.byNumber.get(n) ?? null;
  }
  async findById(id: string) {
    return this.byId.get(id) ?? null;
  }
}

class FakeHasher implements PinHasher {
  async hash(pin: string) {
    return `hashed:${pin}`;
  }
  async verify(pin: string, hash: string) {
    return hash === `hashed:${pin}`;
  }
}

class FakeSessions implements SessionStore {
  private store = new Map<string, string>();
  private counter = 0;
  async create(accountId: string) {
    const id = `session-${++this.counter}`;
    this.store.set(id, accountId);
    return id;
  }
  async get(id: string) {
    return this.store.get(id) ?? null;
  }
  async destroy(id: string) {
    this.store.delete(id);
  }
}

class FakeTxService implements AccountTransactionService {
  txs: TransactionRecord[] = [];
  constructor(private readonly accounts: FakeAccountRepository) {}

  async applyMovement(input: MoneyMovementInput): Promise<MoneyMovementResult> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    if (input.amountCents <= 0n) return { ok: false, error: "INVALID_AMOUNT" };

    const newBalance =
      input.type === "DEPOSIT"
        ? account.balanceCents + input.amountCents
        : account.balanceCents - input.amountCents;
    if (newBalance < 0n) return { ok: false, error: "INSUFFICIENT_FUNDS" };

    account.balanceCents = newBalance;
    const tx: TransactionRecord = {
      id: `tx-${this.txs.length + 1}`,
      accountId: account.id,
      type: input.type,
      amountCents: input.amountCents,
      balanceAfterCents: newBalance,
      createdAt: new Date(),
    };
    this.txs.push(tx);
    return { ok: true, newBalance, transaction: tx };
  }

  async listTransactions(accountId: string, limit: number) {
    return this.txs
      .filter((t) => t.accountId === accountId)
      .slice(-limit)
      .reverse();
  }
}

function setup() {
  const accounts = new FakeAccountRepository();
  const hasher = new FakeHasher();
  const sessions = new FakeSessions();
  const txService = new FakeTxService(accounts);
  accounts.add({
    id: "acc-1",
    accountNumber: "0000123450",
    pinHash: "hashed:0000001111",
    ownerName: "Demo",
    balanceCents: 10000n,
  });
  return { accounts, hasher, sessions, txService };
}

describe("LoginUseCase", () => {
  it("creates a session for valid credentials", async () => {
    const { accounts, hasher, sessions } = setup();
    const uc = new LoginUseCase(accounts, hasher, sessions);
    const r = await uc.execute({ accountNumber: "0000123450", pin: "0000001111" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.accountId).toBe("acc-1");
      expect(r.sessionId).toMatch(/^session-/);
    }
  });

  it("rejects unknown account", async () => {
    const { accounts, hasher, sessions } = setup();
    const uc = new LoginUseCase(accounts, hasher, sessions);
    const r = await uc.execute({ accountNumber: "9999999999", pin: "0000001111" });
    expect(r).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("rejects wrong pin", async () => {
    const { accounts, hasher, sessions } = setup();
    const uc = new LoginUseCase(accounts, hasher, sessions);
    const r = await uc.execute({ accountNumber: "0000123450", pin: "9999999999" });
    expect(r).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });
});

describe("DepositUseCase", () => {
  it("deposits and returns new balance", async () => {
    const { txService } = setup();
    const uc = new DepositUseCase(txService);
    const r = await uc.execute({ accountId: "acc-1", amountCents: 5000n });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.newBalance).toBe(15000n);
  });

  it("rejects zero amount", async () => {
    const { txService } = setup();
    const uc = new DepositUseCase(txService);
    const r = await uc.execute({ accountId: "acc-1", amountCents: 0n });
    expect(r).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });
});

describe("WithdrawUseCase", () => {
  it("withdraws and returns new balance", async () => {
    const { txService } = setup();
    const uc = new WithdrawUseCase(txService);
    const r = await uc.execute({ accountId: "acc-1", amountCents: 4000n });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.newBalance).toBe(6000n);
  });

  it("rejects when balance is insufficient", async () => {
    const { txService } = setup();
    const uc = new WithdrawUseCase(txService);
    const r = await uc.execute({ accountId: "acc-1", amountCents: 99999n });
    expect(r).toEqual({ ok: false, error: "INSUFFICIENT_FUNDS" });
  });
});

describe("GetBalanceUseCase", () => {
  it("returns balance and owner", async () => {
    const { accounts } = setup();
    const uc = new GetBalanceUseCase(accounts);
    const r = await uc.execute("acc-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.balanceCents).toBe(10000n);
      expect(r.ownerName).toBe("Demo");
    }
  });

  it("returns error for unknown account", async () => {
    const { accounts } = setup();
    const uc = new GetBalanceUseCase(accounts);
    const r = await uc.execute("missing");
    expect(r).toEqual({ ok: false, error: "ACCOUNT_NOT_FOUND" });
  });
});

describe("GetHistoryUseCase", () => {
  it("returns transactions in reverse chronological order", async () => {
    const { txService } = setup();
    const dep = new DepositUseCase(txService);
    const wd = new WithdrawUseCase(txService);
    await dep.execute({ accountId: "acc-1", amountCents: 1000n });
    await wd.execute({ accountId: "acc-1", amountCents: 500n });
    const uc = new GetHistoryUseCase(txService);
    const txs = await uc.execute("acc-1");
    expect(txs).toHaveLength(2);
    expect(txs[0]?.type).toBe("WITHDRAWAL");
    expect(txs[1]?.type).toBe("DEPOSIT");
  });
});
