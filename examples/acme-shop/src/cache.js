'use strict';

const { createClient } = require('redis');
const config = require('./config');

const client = createClient({
  url: config.redisUrl,
  socket: {
    // Give up after a few attempts so a missing Redis fails fast at boot.
    reconnectStrategy: (retries, cause) => (retries >= 3 ? cause : 200 * (retries + 1)),
  },
});

let lastError = null;
client.on('error', (err) => {
  lastError = err;
});

async function connect() {
  if (!client.isOpen) await client.connect();
}

async function getJSON(key) {
  const raw = await client.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function setJSON(key, value, ttl = config.cacheTtlSeconds) {
  await client.set(key, JSON.stringify(value), { EX: ttl });
}

async function ping() {
  return client.ping();
}

async function close() {
  if (client.isOpen) await client.quit();
}

module.exports = { client, connect, getJSON, setJSON, ping, close, lastError: () => lastError };
