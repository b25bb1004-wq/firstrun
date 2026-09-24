'use strict';

const { pool } = require('../src/db');

const PRODUCTS = [
  ['ACME-001', 'Rocket Skates', 'Jet-powered roller skates. Brakes sold separately.', 12999, 14],
  ['ACME-002', 'Giant Rubber Band', 'For tripping road runners.', 1499, 120],
  ['ACME-003', 'Portable Hole', 'Fits in any pocket. Works on most surfaces.', 4999, 8],
  ['ACME-004', 'Earthquake Pills', 'Not effective on road runners.', 899, 60],
  ['ACME-005', 'Bird Seed (5 kg)', 'Irresistible to fast birds.', 1299, 200],
];

async function main() {
  for (const [sku, name, description, price, stock] of PRODUCTS) {
    await pool.query(
      `INSERT INTO products (sku, name, description, price_cents, stock)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
         price_cents = EXCLUDED.price_cents, stock = EXCLUDED.stock`,
      [sku, name, description, price, stock],
    );
  }
  console.log(`seeded ${PRODUCTS.length} products`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
