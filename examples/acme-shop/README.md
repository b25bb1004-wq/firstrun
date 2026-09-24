# acme-shop

A small product catalogue API for the Acme storefront. It serves products from
Postgres, caches hot reads in Redis, and exposes a health endpoint for the load
balancer.

## Features

- REST endpoints for listing and fetching products
- Read-through caching with configurable TTL
- Plain SQL migrations, no ORM
- Health check that reports database and cache status

## API

| Method | Path            | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/health`       | Service status, including DB + cache |
| GET    | `/products`     | List all products                    |
| GET    | `/products/:id` | Fetch a single product by id         |

Responses from `/products` include an `X-Cache: HIT | MISS` header.

## Getting started

### Prerequisites

- Node.js 16+
- Docker (for the local database)

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/acme-commerce/acme-shop.git
cd acme-shop
npm install
```

Create your local environment file:

```bash
cp .env.sample .env
```

Start the database:

```bash
docker compose up -d
```

Create the schema and load some sample products:

```bash
npm run migrate
npm run db:seed
```

### Run the server

```bash
npm run dev
```

Then open http://localhost:3000/health. You should see `"status": "ok"`.

## Testing

The test suite runs against your local database, so make sure it is up and
seeded first.

```bash
npm test
```

## Configuration

| Variable            | Default | Description                  |
| ------------------- | ------- | ---------------------------- |
| `DATABASE_URL`      | —       | Postgres connection string   |
| `PORT`              | `3000`  | HTTP port                    |
| `CACHE_TTL_SECONDS` | `60`    | How long product reads are cached |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
