'use strict';

const config = require('./config');
const db = require('./db');
const cache = require('./cache');
const { createApp } = require('./app');

async function main() {
  await db.ping();
  await cache.connect();

  const server = createApp().listen(config.port, () => {
    console.log(`acme-shop listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await Promise.allSettled([db.close(), cache.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start acme-shop:', err);
  process.exit(1);
});
