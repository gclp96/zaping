FROM node:24.20.0-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY .prettierrc eslint.config.mjs nest-cli.json tsconfig.json tsconfig.build.json tsconfig.spec.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

FROM node:24.20.0-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

USER node

CMD ["node", "dist/src/main"]
