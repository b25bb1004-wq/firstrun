# Acme Shop

A small storefront API and admin UI built with Express, Postgres and Vite.

> Setup verified by FirstRun at `9d6540e` in `node:20.11.1-bookworm`: clone to running in 3m12s.

## Prerequisites

- Node.js 20.11.1 (see `.nvmrc`; `.npmrc` sets `engine-strict`, so older versions fail at `npm install`)
- Docker (for Postgres and Redis)

## Getting started

```bash
git clone https://github.com/acme-labs/acme-shop.git && cd acme-shop
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:migrate
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
npm run seed
npm run build
npm run dev
```

The app is now running at http://localhost:3000.

## Tests

```bash
npm test
```

## License

MIT
