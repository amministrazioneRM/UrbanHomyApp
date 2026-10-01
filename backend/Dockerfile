FROM node:23.9.0-alpine

RUN apk add --no-cache openssl netcat-openbsd

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

# Compile TypeScript → dist/
RUN npx tsc

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
