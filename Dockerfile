FROM node:22-alpine

RUN apk add --no-cache openssl
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install

COPY . .
RUN pnpm exec prisma generate

EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]
