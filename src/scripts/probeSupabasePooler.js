const { Client } = require('pg');

const projectRef = process.env.SUPABASE_PROJECT_REF || 'tqpvfrgmnmlqqprneesz';
const password = process.env.SUPABASE_DB_PASSWORD || 'ZDu3b4IK7rtOy6fu';

const regions = [
  'af-south-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'me-south-1',
  'sa-east-1',
];

const ports = [5432, 6543];

async function tryEndpoint(host, port) {
  const users = [
    `postgres.${projectRef}`,
    'postgres',
    projectRef,
  ];

  let lastError = null;

  for (const user of users) {
    const client = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });

    try {
      await client.connect();
      const res = await client.query('select 1 as ok');
      await client.end();
      return { ok: true, host, port, user, result: res.rows[0] };
    } catch (error) {
      try {
        await client.end();
      } catch (_) {
        // ignore cleanup errors
      }
      lastError = { host, port, user, code: error.code, message: error.message };
    }
  }

  return { ok: false, ...lastError };
}

(async () => {
  const hostCandidates = [];
  for (const region of regions) {
    for (let idx = 0; idx <= 5; idx += 1) {
      hostCandidates.push(`aws-${idx}-${region}.pooler.supabase.com`);
    }
  }

  for (const host of hostCandidates) {
    for (const port of ports) {
      // eslint-disable-next-line no-console
      console.log(`Trying ${host}:${port} ...`);
      const outcome = await tryEndpoint(host, port);
      if (outcome.ok) {
        // eslint-disable-next-line no-console
        console.log('\nSUCCESS');
        // eslint-disable-next-line no-console
        console.log(`DATABASE_URL=postgresql://${outcome.user}:${password}@${outcome.host}:${outcome.port}/postgres?sslmode=require`);
        process.exit(0);
      }
      // eslint-disable-next-line no-console
      console.log(`  fail: ${outcome.code || 'ERR'} ${outcome.message}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log('\nNo reachable pooler endpoint found from this network.');
  process.exit(1);
})();
