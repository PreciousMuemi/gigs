const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

async function run() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('Database schema initialized successfully.');
}

run()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize DB schema:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
