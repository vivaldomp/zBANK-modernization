Contexto: Você é um desenvolvedor Fullstack especializado em prototipagem rápida e modernização de sistemas legados. Estamos migrando a lógica COBOL do sistema zBANK encontrado no folder @zBank para uma aplicação moderna usando tecnologias de ponta em Javascript.

Objetivo: Criar um aplicativo de caixa eletrônico com uma interface web e banckend utilizando Bun, Typescript 6, NextJS 16, Hono 4, Drizzle ORM, e Zod para as estruturas de dados. O aplicativo deve ser facilmente executável a partir de um comando Docker Compose.

Requisitos Técnicos:

Backend: Criar uma camada de servico BanckEngine que imite a lógica do ZBank (Saldo, Depósito, Saque) contruído em cobol na raiz do projeto. Utilizar um banco de dados Postgress local para armazenamento persistente, simulando arquivos VSAM do código original.

Frontend: Construir uma interface limpa e responsiva utilizando NextJS 16, ShadCN e Tailwind CSS compatíveis. Ela deve incluir:
- Uma barra lateral para seleção de conta/login.
- Cartões visuais com métricas para o saldo atual.
- Formulários interativos para ações de depósito e saque.
- Uma tabela de histórico de transações.

Containerização: containerizar toda a demonstração (frontend, backend e banco de dados) para que seja possível subir a stack via docker compose.

Estilo de Programação: utilize a abordagem TDD para um estilo limpo em toda a base de código;

Estrutura do Projeto: utilize Bun para gerenciar o projeto no modo monorepo. Abaixo uma estrutura esperada:

```
/apps
  /web                 # Next.js frontend
  /api                 # Hono backend

/packages
  /core                # Domain logic (pure)
  /application         # Use cases
  /infra               # DB adapters
  /db                  # Drizzle schema
  /contracts           # Zod schemas
  /ui                  # Shared components
    /components          # shadcn-based components (Button, Card, etc.)
    /primitives          # Radix wrappers
    /patterns            # domain UI patterns (exam, dashboard)
    /layouts             # layout systems
    /hooks               # UI hooks
    /theme               # tokens (colors, spacing, typography)
    /utils               # helpers (cn, variants)
  /testing             # Fixtures + builders
  /config              # Shared configs
```
