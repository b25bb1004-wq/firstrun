# Brightloop web

Marketing site and checkout for Brightloop.

> Setup verified by FirstRun at `11a8edb` in `node:20-bookworm`: clone to running in 1m54s.

## Prerequisites

- Node.js 20
- ImageMagick (macOS: `brew install imagemagick`; Debian/Ubuntu: `sudo apt-get install imagemagick`)

## Getting started

```bash
apt-get update && apt-get install -y imagemagick
npm install
npx prisma generate
npm run build
npm start
```

> Needs a human: Add STRIPE_SECRET_KEY (sk_test_...) from the Stripe dashboard to .env.local.

## License

MIT
