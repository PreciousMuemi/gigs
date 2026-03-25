require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users', 'skills', 'user_skills', 'jobs', 'job_applications', 'contracts',
        'escrow_transactions', 'ratings', 'ussd_sessions', 'sms_logs', 'audit_logs'
      )
    ORDER BY table_name
  `);

  const ussdIndexes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ussd_sessions'
    ORDER BY indexname
  `);

  console.log('Tables:', tables.rows.map((r) => r.table_name).join(', '));
  console.log('USSD session indexes:', ussdIndexes.rows.map((r) => r.indexname).join(', '));

  await client.end();
}

run().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});
