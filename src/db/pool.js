const { Pool } = require('pg');
const env = require('../config/env');

const isSupabase = /supabase\.co/i.test(env.databaseUrl || '');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ...(isSupabase
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected PG pool error', err);
});

module.exports = pool;
