'use strict';

const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

async function ping() {
  await pool.query('SELECT 1');
}

module.exports = { pool, ping, close: () => pool.end() };
