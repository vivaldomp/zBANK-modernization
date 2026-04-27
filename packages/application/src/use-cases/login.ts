import type { AccountRepository, PinHasher, SessionStore } from "../ports.ts";

export type LoginInput = { accountNumber: string; pin: string };

export type LoginResult =
  | { ok: true; sessionId: string; accountId: string; ownerName: string }
  | { ok: false; error: "INVALID_CREDENTIALS" };

export class LoginUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PinHasher,
    private readonly sessions: SessionStore,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const account = await this.accounts.findByAccountNumber(input.accountNumber);
    if (!account) return { ok: false, error: "INVALID_CREDENTIALS" };
    const valid = await this.hasher.verify(input.pin, account.pinHash);
    if (!valid) return { ok: false, error: "INVALID_CREDENTIALS" };
    const sessionId = await this.sessions.create(account.id);
    return {
      ok: true,
      sessionId,
      accountId: account.id,
      ownerName: account.ownerName,
    };
  }
}
