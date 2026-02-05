FROM node:24-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_OPTIONS=--experimental-specifier-resolution=node

EXPOSE 3001 3002 3003

CMD ["npm", "run", "server"]
