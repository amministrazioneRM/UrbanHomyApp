FROM node:23.9.0-alpine

RUN apk add --no-cache openssl netcat-openbsd dos2unix

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

# Compile TypeScript → dist/
RUN npx tsc

COPY entrypoint.sh ./
RUN dos2unix entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
