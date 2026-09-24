# Contributing to acme-shop

Thanks for helping out! Bug reports and pull requests are welcome.

## Local development

You need Node.js 16+ and Docker.

```bash
npm install
cp .env.sample .env
docker compose up -d
npm run migrate
npm run db:seed
npm run dev
```

Run `npm test` before opening a pull request.

## Guidelines

- Keep pull requests focused on a single change.
- Add a migration file under `migrations/` for any schema change; never edit an
  applied migration.
- New endpoints need a test in `test/`.
- Use conventional commit messages (`feat:`, `fix:`, `chore:`).
