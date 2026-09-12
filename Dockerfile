FROM node:20-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY dashboard/package.json dashboard/package-lock.json ./dashboard/

RUN npm ci && npm ci --prefix dashboard

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY dashboard/package.json dashboard/package-lock.json ./dashboard/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboard/dist ./dashboard/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
