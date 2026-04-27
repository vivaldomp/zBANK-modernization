import { createDb } from "@zbank/db";
import {
  BcryptPinHasher,
  DrizzleAccountRepository,
  DrizzleTransactionService,
  InMemorySessionStore,
} from "@zbank/infra";
import {
  DepositUseCase,
  GetBalanceUseCase,
  GetHistoryUseCase,
  LoginUseCase,
  WithdrawUseCase,
} from "@zbank/application";

export type Container = ReturnType<typeof buildContainer>;

export function buildContainer(databaseUrl: string) {
  const db = createDb(databaseUrl);
  const accounts = new DrizzleAccountRepository(db);
  const txService = new DrizzleTransactionService(db);
  const hasher = new BcryptPinHasher();
  const sessions = new InMemorySessionStore();

  return {
    db,
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
}
