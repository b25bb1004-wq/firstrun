'use strict';

const express = require('express');
const db = require('./db');
const cache = require('./cache');
const products = require('./routes/products');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', async (req, res) => {
    const [dbCheck, redisCheck] = await Promise.allSettled([db.ping(), cache.ping()]);
    const body = {
      status: 'ok',
      db: dbCheck.status === 'fulfilled' ? 'up' : 'down',
      redis: redisCheck.status === 'fulfilled' ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
    };
    if (body.db === 'down' || body.redis === 'down') body.status = 'degraded';
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  app.use('/products', products);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
