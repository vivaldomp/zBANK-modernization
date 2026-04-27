FROM oven/bun:1.3-alpine AS base
WORKDIR /app

FROM base AS runtime
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/application/package.json ./packages/application/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/infra/package.json ./packages/infra/

COPY apps/api ./apps/api
COPY packages/core ./packages/core
COPY packages/application ./packages/application
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY packages/infra ./packages/infra

RUN bun install --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 3001

COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
