FROM node:23.9.0-alpine AS builder

WORKDIR /app

ARG API_BASE_URL=http://localhost:4000/api
ENV API_BASE_URL=${API_BASE_URL}

# Build each frontend app (esbuild is a dependency of each app)
COPY apps/manutenzioni apps/manutenzioni
RUN cd apps/manutenzioni && npm install && npm run build

COPY apps/locker apps/locker
RUN cd apps/locker && npm install && npm run build

COPY apps/ticket-it apps/ticket-it
RUN cd apps/ticket-it && npm install && npm run build

COPY apps/utenti apps/utenti
RUN cd apps/utenti && npm install && npm run build

COPY apps/vending apps/vending
RUN cd apps/vending && npm install && npm run build

# Build shared/accounts.js (reuse esbuild already installed in manutenzioni)
COPY shared shared
RUN apps/manutenzioni/node_modules/.bin/esbuild shared/accounts.ts \
      --bundle \
      --format=iife \
      --global-name=_UHAccountsModule \
      --allow-overwrite \
      --footer:js="window.UHAccounts = _UHAccountsModule.default;" \
      --outfile=shared/accounts.js

# Compile portal serve.ts
COPY portal portal
RUN cd portal && npm install && npx tsc

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM node:23.9.0-alpine

WORKDIR /app

COPY --from=builder /app/apps/manutenzioni/dist apps/manutenzioni/dist
COPY --from=builder /app/apps/locker/dist       apps/locker/dist
COPY --from=builder /app/apps/ticket-it/dist    apps/ticket-it/dist
COPY --from=builder /app/apps/utenti/dist       apps/utenti/dist
COPY --from=builder /app/apps/vending/dist      apps/vending/dist
COPY --from=builder /app/shared                 shared
COPY --from=builder /app/portal                 portal

EXPOSE 5173

CMD ["node", "portal/serve.js"]
