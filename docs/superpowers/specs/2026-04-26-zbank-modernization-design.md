# zBank Modernization — Design Spec

**Date**: 2026-04-26
**Source**: `prompt-modernizacao.md` + analysis of `zBANK/CICS.COB_ZBANK3_.cbl` and `zBANK/SEQDAT.ZBANK.cbl`

## Goal

Modernize the COBOL `ZBANK` ATM into a containerized full-stack TypeScript application with a clean web UI, REST API, and persistent storage. Preserve the original business logic (login, deposit, withdraw) and extend with transaction history.

## Original COBOL behavior (reference)

- VSAM record: `ACCNO PIC 9(10)` + `PIN PIC 9(10)` + `BALANCE PIC 9(10)`
- Login: `ACCNO + PIN` validated against VSAM
- Actions on home screen:
  - `D` deposit: `ADD AMOUNT TO WS-BALANCE` then `REWRITE`
  - `W` withdraw: `SUBTRACT AMOUNT FROM WS-BALANCE` then `REWRITE` *(no balance check — bug fixed in modern version)*
  - `Q` quit: back to login
  - `T` transfer: stub `"TO BE IMPLEMENTED"` — out of scope
- Seed data (`SEQDAT.ZBANK.cbl`): two accounts pre-loaded
  - `0000123450` / pin `0000001111` / balance `0000000100`
  - `1234567890` / pin `0000001234` / balance `0000000200`

## Stack

- **Runtime**: Bun (monorepo with workspaces)
- **Language**: TypeScript 6
- **Backend**: Hono 4
- **Frontend**: Next.js 16 (App Router) + shadcn/ui + Tailwind
- **DB**: PostgreSQL 16 + Drizzle ORM
- **Validation**: Zod
- **Tests**: Vitest (unit + integration)
- **Container**: Docker Compose

## Project structure

```
/apps
  /web        # Next.js 16 frontend
  /api        # Hono backend
/packages
  /core         # BankEngine (pure)
  /application  # Use cases + ports
  /infra        # Drizzle adapters
  /db           # schema + migrations + seed
  /contracts    # Zod schemas
  /ui           # shared shadcn components
  /testing      # fixtures + builders
  /config       # shared tsconfig/eslint
```

## Domain model

### Account
| field | type | notes |
|-------|------|-------|
| id | uuid | primary key |
| accountNumber | string(10) | unique, 10-digit numeric (matches VSAM ACCNO) |
| pinHash | string | bcrypt of 10-digit PIN |
| ownerName | string | added for UX |
| balanceCents | bigint | money in cents to avoid float drift |
| createdAt | timestamp | |

### Transaction
| field | type | notes |
|-------|------|-------|
| id | uuid | primary key |
| accountId | uuid (fk Account.id) | |
| type | enum('DEPOSIT','WITHDRAWAL') | |
| amountCents | bigint | |
| balanceAfterCents | bigint | snapshot post-operation |
| createdAt | timestamp | |

## Layers

### `packages/core` — pure domain
- `deposit(balance, amount): Result` — returns new balance or error
- `withdraw(balance, amount): Result` — rejects when `amount > balance` (bug fix vs. COBOL)
- `getBalance(account)` — accessor
- No I/O, no DB. Fully unit-testable.

### `packages/application` — use cases
- Ports (interfaces): `AccountRepository`, `TransactionRepository`, `SessionStore`, `PinHasher`
- Use cases: `LoginUseCase`, `DepositUseCase`, `WithdrawUseCase`, `GetBalanceUseCase`, `GetHistoryUseCase`
- Each use case takes ports via constructor; tested with in-memory fakes

### `packages/infra` — adapters
- `DrizzleAccountRepository`, `DrizzleTransactionRepository`
- `BcryptPinHasher`
- Deposit/withdraw run inside a DB transaction: read → mutate balance → insert transaction row → commit (atomic, simulates VSAM `READ UPDATE` + `REWRITE`)

### `apps/api` — Hono
Routes:
- `POST /auth/login` — body: `{ accountNumber, pin }` → sets `session` cookie
- `POST /auth/logout` — clears cookie
- `GET /me` — returns logged-in account summary
- `GET /accounts/me/balance`
- `POST /accounts/me/deposit` — `{ amountCents }`
- `POST /accounts/me/withdraw` — `{ amountCents }`
- `GET /accounts/me/transactions?limit=50`

Session: signed httpOnly cookie holding session id, server-side in-memory `Map<sessionId, accountId>` with 30 min TTL. Suitable for demo; not horizontally scalable (out of scope).

### `apps/web` — Next.js 16
Pages/components:
- `/login` — account number + PIN form
- `/` — protected dashboard
  - **Sidebar**: list of available demo accounts (for quick login switching) + current user
  - **Balance card** (shadcn `Card`) — current balance, BRL formatted
  - **Deposit form** — amount input, submit
  - **Withdraw form** — amount input, submit, shows error on insufficient balance
  - **Transactions table** — date, type, amount, balance after

Communication: server actions + fetch to API via internal Docker network URL; cookies forwarded.

## Money handling

- DB: `bigint` cents
- Wire: `amountCents` integers in JSON
- UI: parse user input as `R$ 12,34` → cents; display via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

## Tests (TDD)

- **Unit** (Vitest, no I/O): `core` engine, all use cases against in-memory fakes
- **Integration** (Vitest + real Postgres via dockerized test DB): infra repos, API routes (Hono `app.fetch`)
- **No E2E** in MVP (per user decision)

## Docker Compose

Services:
- `postgres:16-alpine` — volume-backed, healthcheck
- `api` — Bun + Hono; entrypoint runs migrations + seed then starts server
- `web` — Next 16 standalone build

Single command: `docker compose up --build`. Web served on `:3000`, API on `:3001`.

## Out of scope

- Transfers (`T` action stub in COBOL)
- Account registration (`R` action stub in COBOL — we ship pre-seeded accounts)
- Multi-instance session storage (Redis)
- E2E browser tests
- Full i18n (Portuguese-only labels)

## Key decisions log

| # | Decision | Reason |
|---|----------|--------|
| 1 | Cookie session, not JWT | Simpler for demo; user choice |
| 2 | Reject withdraw on insufficient balance | Bug in COBOL; user choice |
| 3 | bigint cents, not numeric/float | Avoid float drift |
| 4 | Two pre-seeded accounts from SEQDAT | Preserve original demo data |
| 5 | Skip Playwright/E2E in MVP | User choice |
| 6 | bcrypt PIN hash | Don't store plain PINs even in demo |
