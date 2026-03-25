const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected PG pool error', err);
});

module.exports = pool;
