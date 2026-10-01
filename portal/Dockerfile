FROM node:23.9.0-alpine

WORKDIR /app

ARG API_BASE_URL=http://localhost:4000/api
ENV API_BASE_URL=${API_BASE_URL}

# Copy pre-built dist/ artifacts (built on the host before docker compose up)
COPY apps/manutenzioni/dist apps/manutenzioni/dist
COPY apps/locker/dist       apps/locker/dist
COPY apps/ticket-it/dist    apps/ticket-it/dist
COPY apps/utenti/dist       apps/utenti/dist
COPY apps/vending/dist      apps/vending/dist

# Copy shared library and portal (serve.js pre-compiled on the host)
COPY shared shared
COPY portal portal

EXPOSE 5173

CMD ["node", "portal/serve.js"]
