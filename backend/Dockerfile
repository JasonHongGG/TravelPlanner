FROM node:24-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package.json ./
COPY backend/package-lock.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY shared /app/shared
RUN npm run build

FROM node:24-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package.json ./
COPY backend/package-lock.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=build /app/backend/dist ./dist

ENV NODE_ENV=production
ENV NODE_OPTIONS=--experimental-specifier-resolution=node

EXPOSE 3001 3002 3003

CMD ["node", "dist/backend/src/server.js"]
