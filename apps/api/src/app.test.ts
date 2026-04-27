import { describe, expect, it, beforeAll } from "vitest";
import { createApp } from "./app.ts";
import { LoginUseCase, DepositUseCase, WithdrawUseCase, GetBalanceUseCase, GetHistoryUseCase } from "@zbank/application";
import type {
  AccountRecord,
  AccountRepository,
  AccountTransactionService,
  MoneyMovementInput,
  MoneyMovementResult,
  PinHasher,
  SessionStore,
  TransactionRecord,
} from "@zbank/application";

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
  async create(accountId: string) {
    const id = `session-${this.store.size + 1}`;
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
    return this.txs.filter((t) => t.accountId === accountId).slice(-limit).reverse();
  }
}

function makeApp() {
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
  const container = {
    db: {} as never,
    accounts,
    txService,
    hasher,
    sessions,
    useCases: {
      login: new LoginUseCase(accounts, hasher, sessions),
      deposit: new DepositUseCase(txService),
      withdraw: new WithdrawUseCase(txService),
      getBalance: new GetBalanceUseCase(accounts),
      getHistory: new GetHistoryUseCase(txService),
    },
  };
  return createApp(container, { allowOrigin: "http://localhost:3000" });
}

describe("API", () => {
  let app: ReturnType<typeof makeApp>;
  let cookie = "";

  beforeAll(() => {
    app = makeApp();
  });

  it("GET /health returns ok", async () => {
    const r = await app.request("/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
  });

  it("POST /auth/login rejects bad credentials", async () => {
    const r = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountNumber: "0000123450", pin: "9999999999" }),
    });
    expect(r.status).toBe(401);
  });

  it("POST /auth/login sets session cookie", async () => {
    const r = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountNumber: "0000123450", pin: "0000001111" }),
    });
    expect(r.status).toBe(200);
    const setCookie = r.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("zbank_session=");
    cookie = setCookie.split(";")[0]!;
  });

  it("requires auth on /accounts/me", async () => {
    const r = await app.request("/accounts/me");
    expect(r.status).toBe(401);
  });

  it("GET /accounts/me returns account", async () => {
    const r = await app.request("/accounts/me", { headers: { cookie } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.accountNumber).toBe("0000123450");
    expect(body.balanceCents).toBe("10000");
  });

  it("POST /accounts/me/deposit increases balance", async () => {
    const r = await app.request("/accounts/me/deposit", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 5000 }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.newBalance).toBe("15000");
  });

  it("POST /accounts/me/withdraw decreases balance", async () => {
    const r = await app.request("/accounts/me/withdraw", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 2000 }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.newBalance).toBe("13000");
  });

  it("POST /accounts/me/withdraw rejects insufficient funds", async () => {
    const r = await app.request("/accounts/me/withdraw", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 9999999 }),
    });
    expect(r.status).toBe(409);
    const body = await r.json();
    expect(body.error).toBe("INSUFFICIENT_FUNDS");
  });

  it("GET /accounts/me/transactions returns history", async () => {
    const r = await app.request("/accounts/me/transactions", { headers: { cookie } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].type).toBe("WITHDRAWAL");
    expect(body.transactions[1].type).toBe("DEPOSIT");
  });
});
