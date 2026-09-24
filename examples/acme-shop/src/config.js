'use strict';

// Load .env from the working directory when present (Node >= 20.12).
try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  sessionSecret: required('SESSION_SECRET'),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 60),
};
