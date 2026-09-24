'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db');
const cache = require('../src/cache');
const { createApp } = require('../src/app');

let server;
let baseUrl;

before(async () => {
  await cache.connect();
  await cache.client.del(['products:all', 'products:1']);
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.allSettled([db.close(), cache.close()]);
});

test('GET /health reports db and redis up', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'up');
  assert.equal(body.redis, 'up');
});

test('GET /products lists seeded products and caches them', async () => {
  const first = await fetch(`${baseUrl}/products`);
  assert.equal(first.status, 200);
  const products = await first.json();
  assert.ok(products.length >= 5, 'expected seeded products');
  assert.equal(first.headers.get('x-cache'), 'MISS');

  const second = await fetch(`${baseUrl}/products`);
  assert.equal(second.headers.get('x-cache'), 'HIT');
});

test('GET /products/:id returns a single product', async () => {
  const res = await fetch(`${baseUrl}/products/1`);
  assert.equal(res.status, 200);
  const product = await res.json();
  assert.equal(product.id, 1);
  assert.equal(typeof product.price_cents, 'number');
});

test('GET /products/:id handles bad and unknown ids', async () => {
  assert.equal((await fetch(`${baseUrl}/products/abc`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/products/999999`)).status, 404);
});
