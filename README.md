# zBank — Modernização do COBOL para a Web

Aplicação de **caixa eletrônico** que moderniza o sistema mainframe **zBANK** (COBOL/CICS/VSAM) para uma stack TypeScript contemporânea, preservando integralmente a lógica de negócio original (login, saldo, depósito, saque) e estendendo com histórico de transações persistente, autenticação por sessão e UI responsiva.

> **Créditos**: o sistema COBOL original que serviu de base para esta modernização foi escrito por [Benjamin Linnik](https://github.com/BenLinnik), Nicklas V. e Henrik G. como projeto da disciplina *Enterprise Mainframe Computing*. O fork [github.com/Nantero1/zBANK](https://github.com/Nantero1/zBANK) — incluído neste repositório como submódulo `zBANK/` — forneceu o código-fonte COBOL, mapas BMS, JCL CICS e dados VSAM que **subsidiaram os testes e a engenharia reversa** da lógica de negócio.

---

## Objetivo

Demonstrar como uma aplicação mainframe legada (COBOL + CICS + VSAM) pode ser modernizada para a stack JavaScript de ponta sem perda funcional:

| Original (`zBANK/CICS.COB_ZBANK3_.cbl`) | Modernizado |
|------|------------|
| Telas BMS em terminal 3270 | UI Web responsiva (Next.js + Tailwind) |
| `EXEC CICS READ DATASET ... UPDATE` (VSAM) | `SELECT ... FOR UPDATE` (PostgreSQL) |
| `EXEC CICS REWRITE` | `UPDATE accounts` dentro de transação |
| `IF PIN = WS-PIN` (PIN em claro) | `bcrypt.compare(pin, pinHash)` |
| Saque sem verificação de saldo (bug) | **Corrigido**: rejeita saldo insuficiente (HTTP 409) |
| `ACTION = 'T'` / `'R'` (stubs no COBOL) | Fora de escopo |

---

## Stack e técnicas

### Tecnologias
- **Bun 1.3** — runtime + package manager + monorepo via workspaces
- **TypeScript 5.7** — tipagem estrita (`strict`, `noUncheckedIndexedAccess`)
- **Next.js 16** (App Router + Turbopack + standalone output) — frontend
- **Hono 4** — framework HTTP minimalista para o backend
- **PostgreSQL 16** + **Drizzle ORM** — substitui o arquivo VSAM key-sequenced
- **Zod** — schemas compartilhados front + back
- **Tailwind CSS v4** + componentes **shadcn-style** + **lucide-react**
- **Vitest** — unit + integration tests
- **Docker Compose** — orquestração de toda a stack

### Técnicas e decisões-chave
- **Clean Architecture / Hexagonal**: domínio puro (`core`) não conhece HTTP nem DB; casos de uso (`application`) dependem de ports; adapters reais (`infra`) só são instanciados na composição.
- **TDD**: a lógica de saldo foi escrita com testes vermelhos primeiro (ver `packages/core/src/bank-engine.test.ts`).
- **Dinheiro como `bigint` em centavos** — elimina float drift que afetaria operações financeiras.
- **PIN com bcrypt** — mesmo em ambiente demo, evita armazenar credenciais em claro.
- **Atomicidade transacional** — `db.transaction` com `SELECT ... FOR UPDATE` espelha o `READ UPDATE`/`REWRITE` do VSAM, prevenindo lost updates concorrentes.
- **Sessão via cookie httpOnly assinado** — armazenamento server-side em memória, TTL 30 min (suficiente para demo, não horizontalmente escalável).
- **Server Actions** do Next.js para mutações (depósito/saque/login/logout), com `revalidatePath` após cada operação.

---

## Arquitetura

```mermaid
flowchart LR
    User([👤 Usuário])

    subgraph Web["apps/web · Next.js 16"]
        Login["/login (Server Action)"]
        Home["/ (Dashboard)"]
        ApiLib["lib/api.ts<br/>encaminha cookie de sessão"]
    end

    subgraph Api["apps/api · Hono 4"]
        Routes["Rotas REST<br/>/auth/* · /accounts/me/*"]
        Mw["Middleware de sessão<br/>(cookie httpOnly)"]
        Container["container.ts<br/>(composition root)"]
    end

    subgraph Application["packages/application · Use Cases"]
        UC["LoginUC · DepositUC<br/>WithdrawUC · GetBalanceUC<br/>GetHistoryUC"]
        Ports[("Ports<br/>AccountRepository<br/>AccountTransactionService<br/>PinHasher · SessionStore")]
    end

    subgraph Core["packages/core · Domínio puro"]
        Engine["BankEngine<br/>deposit() · withdraw()<br/>(funções puras)"]
    end

    subgraph Infra["packages/infra · Adapters"]
        DrizzleRepo["DrizzleAccountRepository"]
        DrizzleTx["DrizzleTransactionService<br/>SELECT ... FOR UPDATE"]
        Bcrypt["BcryptPinHasher"]
        InMem["InMemorySessionStore"]
    end

    subgraph DB["packages/db · Drizzle"]
        Schema["schema.ts<br/>accounts · transactions"]
        Migrate["migrate.ts · seed.ts"]
    end

    Postgres[(🐘 PostgreSQL 16)]

    User -->|HTTP| Web
    Web -->|fetch + cookie| Api
    Routes --> Mw --> Container
    Container --> UC
    UC --> Ports
    UC -->|regras puras| Engine
    Ports -.implementado por.-> DrizzleRepo
    Ports -.implementado por.-> DrizzleTx
    Ports -.implementado por.-> Bcrypt
    Ports -.implementado por.-> InMem
    DrizzleRepo --> Schema
    DrizzleTx --> Schema
    Schema --> Postgres
    Migrate --> Postgres
```

### Fluxo de uma operação (ex.: depósito)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant W as Next.js (Server Action)
    participant A as Hono API
    participant UC as DepositUseCase
    participant TX as DrizzleTransactionService
    participant DB as PostgreSQL

    U->>W: submete form (R$ 50,00)
    W->>W: parseBRLToCents → 5000n
    W->>A: POST /accounts/me/deposit (cookie + body)
    A->>A: middleware sessão → accountId
    A->>UC: execute({ accountId, amountCents: 5000n })
    UC->>TX: applyMovement(DEPOSIT)
    TX->>DB: BEGIN
    TX->>DB: SELECT ... FOR UPDATE
    TX->>DB: UPDATE accounts SET balance_cents = newBalance
    TX->>DB: INSERT INTO transactions ...
    TX->>DB: COMMIT
    TX-->>UC: { ok: true, newBalance, transaction }
    UC-->>A: 200 OK
    A-->>W: JSON
    W->>W: revalidatePath('/')
    W-->>U: redirect com saldo atualizado
```

---

## Estrutura do projeto

```
cobol_modernization/
├── apps/
│   ├── api/                    # Backend Hono
│   │   ├── src/
│   │   │   ├── app.ts          # Definição das rotas + middleware
│   │   │   ├── container.ts    # Composition root (DI)
│   │   │   ├── server.ts       # Bootstrap
│   │   │   └── app.test.ts     # Testes de integração com fakes
│   │   ├── Dockerfile
│   │   └── docker-entrypoint.sh
│   └── web/                    # Frontend Next.js 16
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── globals.css
│       │   │   ├── login/page.tsx     # Tela de login
│       │   │   └── page.tsx           # Dashboard (saldo + forms + tabela)
│       │   ├── components/ui/         # Button, Card, Input, Label, Table (shadcn-style)
│       │   └── lib/
│       │       ├── api.ts             # Fetch helper que encaminha cookie
│       │       └── utils.ts           # cn(), formatBRL(), parseBRLToCents()
│       ├── next.config.mjs
│       └── Dockerfile
│
├── packages/
│   ├── core/                   # 🟦 Domínio puro (sem I/O)
│   │   └── src/
│   │       ├── bank-engine.ts        # deposit() · withdraw()
│   │       ├── money.ts              # add, subtract, isPositive
│   │       └── bank-engine.test.ts   # 9 testes unitários
│   ├── application/            # 🟨 Casos de uso + ports
│   │   └── src/
│   │       ├── ports.ts              # AccountRepository, PinHasher, SessionStore...
│   │       ├── use-cases/            # Login · Deposit · Withdraw · GetBalance · GetHistory
│   │       └── use-cases/use-cases.test.ts  # 10 testes com fakes em memória
│   ├── infra/                  # 🟧 Adapters concretos
│   │   └── src/
│   │       ├── account-repository.ts     # Drizzle
│   │       ├── transaction-service.ts    # Drizzle + SELECT ... FOR UPDATE
│   │       ├── pin-hasher.ts             # bcryptjs
│   │       └── session-store.ts          # in-memory + crypto.randomBytes
│   ├── db/                     # 🟪 Schema + migrations + seed
│   │   ├── drizzle/0000_init.sql
│   │   └── src/
│   │       ├── schema.ts             # accounts · transactions · transaction_type enum
│   │       ├── migrate.ts
│   │       └── seed.ts               # 2 contas do SEQDAT.ZBANK
│   └── contracts/              # 🟩 Schemas Zod compartilhados
│       └── src/index.ts        # loginRequestSchema, amountRequestSchema, DTOs...
│
├── docs/superpowers/specs/
│   └── 2026-04-26-zbank-modernization-design.md  # Spec validado
│
├── zBANK/                      # ► Submódulo: github.com/Nantero1/zBANK
│   ├── CICS.COB_ZBANK3_.cbl    #   COBOL principal (referência)
│   ├── SEQDAT.ZBANK.cbl        #   Dados VSAM seed
│   └── ...
│
├── docker-compose.yml          # postgres + api + web
├── package.json                # workspaces: apps/* packages/*
├── tsconfig.base.json
└── README.md
```

---

## Subir o stack

```bash
# Clona com submódulo
git clone --recursive <este-repo>

# Sobe tudo
docker compose up --build
```

| Serviço   | URL                       | Notas                            |
|-----------|---------------------------|----------------------------------|
| Web       | http://localhost:3000     | Next.js 16 standalone            |
| API       | http://localhost:3001     | `GET /health` retorna `{status}` |
| Postgres  | `localhost:5432`          | user/pass `zbank/zbank`, db `zbank` |

A API executa **migrations + seed automaticamente** no entrypoint do container.

---

## Como testar

### Contas demo (importadas do `SEQDAT.ZBANK.cbl`)

| Número da conta | PIN          | Saldo inicial | Titular        |
|-----------------|--------------|---------------|----------------|
| `0000123450`    | `0000001111` | R$ 100,00     | Conta Demo 1   |
| `1234567890`    | `0000001234` | R$ 200,00     | Conta Demo 2   |

Os dois cards aparecem no menu lateral da dashboard para troca rápida de conta.

### Cenários de teste manual no navegador

1. Acesse http://localhost:3000 → redireciona para `/login`
2. Login com `0000123450` / `0000001111`
3. Faça um **depósito** de R$ 50,00 → saldo vai para R$ 150,00
4. Faça um **saque** de R$ 30,00 → saldo vai para R$ 120,00
5. Tente sacar **R$ 999.999,00** → mensagem "Saldo insuficiente" (HTTP 409 — bug do COBOL corrigido)
6. Verifique a **tabela de histórico** — depósito e saque listados em ordem reversa
7. Use a sidebar para trocar para `1234567890` e logar com `0000001234`

### Suíte automatizada (Vitest)

```bash
bun install            # primeira vez
bun run test           # 28 testes em ~1s
bun run test:unit      # apenas core + application (sem I/O)
```

| Pacote               | Testes | Cobertura                                       |
|----------------------|--------|-------------------------------------------------|
| `@zbank/core`        | 9      | `deposit` / `withdraw` — puras, BigInt edge cases |
| `@zbank/application` | 10     | Use cases isolados via fakes em memória         |
| `@zbank/api`         | 9      | Rotas Hono completas via `app.request()` + fakes |

### Smoke test via cURL

```bash
# Health
curl http://localhost:3001/health

# Login (extrai cookie)
COOKIE=$(curl -si -X POST http://localhost:3001/auth/login \
  -H 'content-type: application/json' \
  -d '{"accountNumber":"0000123450","pin":"0000001111"}' \
  | grep -i 'set-cookie' | sed 's/.*\(zbank_session=[^;]*\).*/\1/')

# Saldo
curl -H "cookie: $COOKIE" http://localhost:3001/accounts/me

# Depósito
curl -X POST http://localhost:3001/accounts/me/deposit \
  -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"amountCents":5000}'

# Histórico
curl -H "cookie: $COOKIE" http://localhost:3001/accounts/me/transactions
```

---

## Desenvolvimento local (sem Docker para apps)

```bash
bun install
docker compose up postgres -d

DATABASE_URL=postgres://zbank:zbank@localhost:5432/zbank bun run db:migrate
DATABASE_URL=postgres://zbank:zbank@localhost:5432/zbank bun run db:seed

# em terminais separados:
DATABASE_URL=postgres://zbank:zbank@localhost:5432/zbank bun run dev:api
INTERNAL_API_URL=http://localhost:3001 bun run dev:web
```

---

## Créditos

- **Sistema COBOL original (zBANK)** — Benjamin Linnik, Nicklas V. e Henrik G., disciplina *Enterprise Mainframe Computing*. Repositório original: [github.com/BenLinnik/zBANK](https://github.com/BenLinnik/zBANK).
- **Fork utilizado neste projeto** (submódulo `zBANK/`) — [github.com/Nantero1/zBANK](https://github.com/Nantero1/zBANK), que serviu de base para análise do código fonte COBOL, dos dados de seed VSAM e do desenho das telas BMS, **subsidiando os testes e a engenharia reversa da lógica de negócio** que foi recriada nesta versão TypeScript.

> Spec de design: [`docs/superpowers/specs/2026-04-26-zbank-modernization-design.md`](docs/superpowers/specs/2026-04-26-zbank-modernization-design.md)
