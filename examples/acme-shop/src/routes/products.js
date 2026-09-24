'use strict';

const express = require('express');
const db = require('../db');
const cache = require('../cache');

const router = express.Router();

const COLUMNS = 'id, sku, name, description, price_cents, stock';

router.get('/', async (req, res) => {
  const cached = await cache.getJSON('products:all');
  if (cached) return res.set('X-Cache', 'HIT').json(cached);

  const { rows } = await db.pool.query(`SELECT ${COLUMNS} FROM products ORDER BY id`);
  await cache.setJSON('products:all', rows);
  res.set('X-Cache', 'MISS').json(rows);
});

router.get('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid product id' });
  }

  const key = `products:${id}`;
  const cached = await cache.getJSON(key);
  if (cached) return res.set('X-Cache', 'HIT').json(cached);

  const { rows } = await db.pool.query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'product not found' });

  await cache.setJSON(key, rows[0]);
  res.set('X-Cache', 'MISS').json(rows[0]);
});

module.exports = router;
