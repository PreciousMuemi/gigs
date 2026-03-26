const repo = require('../repositories/platformRepository');
const { handleUssd } = require('../services/ussdStateMachine');
const pool = require('../db/pool');

async function seedContract() {
  const client = await repo.upsertUserByPhone({
    phone: '+254701000001',
    fullName: 'Checklist Client',
    role: 'client',
    region: 'Nairobi',
  });

  const freelancer = await repo.upsertUserByPhone({
    phone: '+254701000002',
    fullName: 'Checklist Plumber',
    role: 'freelancer',
  });

  await repo.upsertUserSkillByName({ userId: freelancer.id, skillName: 'plumbing' });

  const job = await repo.createJob({
    clientId: client.id,
    title: 'Fix leaking sink',
    description: 'Kitchen sink leak',
    budget: 1800,
    currency: 'KES',
  });

  const app = await repo.createApplication({
    jobId: job.id,
    freelancerId: freelancer.id,
    bidAmount: 1700,
    coverNote: 'Available now',
  });

  const contract = await repo.createContractFromApplication({
    jobId: job.id,
    clientId: client.id,
    freelancerId: freelancer.id,
    agreedAmount: app.bid_amount,
    currency: 'KES',
  });

  await repo.setContractStatus(contract.id, 'work_submitted');
  return { contractId: contract.id, clientPhone: client.phone };
}

async function run() {
  const { contractId, clientPhone } = await seedContract();
  const ref = contractId.slice(0, 8);
  const sessionId = `check-${Date.now()}`;

  const steps = [
    '',
    '7',
    `7*${ref}`,
    `7*${ref}*1`,
    `7*${ref}*1*1`,
    `7*${ref}*1*1*2`,
  ];

  // eslint-disable-next-line no-console
  console.log(`Testing ref: ${ref}`);

  for (const text of steps) {
    // eslint-disable-next-line no-await-in-loop
    const res = await handleUssd({ sessionId, phoneNumber: clientPhone, text });
    // eslint-disable-next-line no-console
    console.log(`\nINPUT: ${text || '(empty)'}`);
    // eslint-disable-next-line no-console
    console.log(res);
  }

  const contract = await repo.getContractById(contractId);
  const { rows } = await pool.query(
    'SELECT decision, leak_fixed, flow_restored, callback_needed FROM work_verifications WHERE contract_id = $1',
    [contractId],
  );

  // eslint-disable-next-line no-console
  console.log('\nFinal status:', contract.status);
  // eslint-disable-next-line no-console
  console.log('Verification row:', rows[0]);
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
