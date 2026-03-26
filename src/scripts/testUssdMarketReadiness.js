const { handleUssd } = require('../services/ussdStateMachine');
const repo = require('../repositories/platformRepository');
const pool = require('../db/pool');

function printStep(title, response) {
  // eslint-disable-next-line no-console
  console.log(`\n${title}`);
  // eslint-disable-next-line no-console
  console.log(response);
}

async function seedContracts({ clientPhone, freelancerPhone }) {
  const client = await repo.upsertUserByPhone({
    phone: clientPhone,
    fullName: 'Market Client',
    role: 'client',
    region: 'Nairobi',
  });

  const freelancer = await repo.upsertUserByPhone({
    phone: freelancerPhone,
    fullName: 'Market Plumber',
    role: 'freelancer',
  });

  await repo.upsertUserSkillByName({ userId: freelancer.id, skillName: 'plumbing' });

  // Contract A: released (used for option 6 and rating)
  const jobA = await repo.createJob({
    clientId: client.id,
    title: 'Repair leaking sink',
    description: 'Kitchen sink leaking',
    budget: 2500,
    currency: 'KES',
  });

  const appA = await repo.createApplication({
    jobId: jobA.id,
    freelancerId: freelancer.id,
    bidAmount: 2200,
    coverNote: 'Can fix same day',
  });

  const contractA = await repo.createContractFromApplication({
    jobId: jobA.id,
    clientId: client.id,
    freelancerId: freelancer.id,
    agreedAmount: appA.bid_amount,
    currency: 'KES',
  });
  await repo.setContractStatus(contractA.id, 'released');
  await repo.setJobStatusByJobId(jobA.id, 'completed');

  // Contract B: work_submitted (used for option 7 checklist)
  const jobB = await repo.createJob({
    clientId: client.id,
    title: 'Unblock bathroom drain',
    description: 'Drain blocked',
    budget: 3000,
    currency: 'KES',
  });

  const appB = await repo.createApplication({
    jobId: jobB.id,
    freelancerId: freelancer.id,
    bidAmount: 2800,
    coverNote: 'Specialized tools available',
  });

  const contractB = await repo.createContractFromApplication({
    jobId: jobB.id,
    clientId: client.id,
    freelancerId: freelancer.id,
    agreedAmount: appB.bid_amount,
    currency: 'KES',
  });
  await repo.setContractStatus(contractB.id, 'work_submitted');
  await repo.setJobStatusByJobId(jobB.id, 'delivered');

  return {
    releasedRef: contractA.id.slice(0, 8),
    checklistRef: contractB.id.slice(0, 8),
  };
}

async function run() {
  // eslint-disable-next-line no-console
  console.log('=== USSD Market Readiness Test (Options 1-7) ===');

  const freelancerPhone = '+254799100001';
  const clientPhone = '+254799100002';

  // Seed contracts for verify/rating/checklist options
  const refs = await seedContracts({ clientPhone, freelancerPhone });

  // Option 1: Register freelancer
  const s1 = `mkt-1-${Date.now()}`;
  printStep('Option 1 - Menu', await handleUssd({ sessionId: s1, phoneNumber: '+254799100010', text: '' }));
  printStep('Option 1 - Select', await handleUssd({ sessionId: s1, phoneNumber: '+254799100010', text: '1' }));
  printStep('Option 1 - Name', await handleUssd({ sessionId: s1, phoneNumber: '+254799100010', text: '1*Jane Wanjiku' }));
  printStep('Option 1 - Skill', await handleUssd({ sessionId: s1, phoneNumber: '+254799100010', text: '1*Jane Wanjiku*Plumbing' }));

  // Option 2: Register client
  const s2 = `mkt-2-${Date.now()}`;
  printStep('Option 2 - Menu', await handleUssd({ sessionId: s2, phoneNumber: '+254799100011', text: '' }));
  printStep('Option 2 - Select', await handleUssd({ sessionId: s2, phoneNumber: '+254799100011', text: '2' }));
  printStep('Option 2 - Name', await handleUssd({ sessionId: s2, phoneNumber: '+254799100011', text: '2*Acme Homes' }));
  printStep('Option 2 - Location', await handleUssd({ sessionId: s2, phoneNumber: '+254799100011', text: '2*Acme Homes*Nairobi' }));

  // Option 3: Post job
  const s3 = `mkt-3-${Date.now()}`;
  printStep('Option 3 - Menu', await handleUssd({ sessionId: s3, phoneNumber: clientPhone, text: '' }));
  printStep('Option 3 - Select', await handleUssd({ sessionId: s3, phoneNumber: clientPhone, text: '3' }));
  printStep('Option 3 - Title', await handleUssd({ sessionId: s3, phoneNumber: clientPhone, text: '3*Fix sink tap' }));
  printStep('Option 3 - Budget', await handleUssd({ sessionId: s3, phoneNumber: clientPhone, text: '3*Fix sink tap*3500' }));

  // Option 4: Find freelancer
  const s4 = `mkt-4-${Date.now()}`;
  printStep('Option 4 - Menu', await handleUssd({ sessionId: s4, phoneNumber: clientPhone, text: '' }));
  printStep('Option 4 - Select', await handleUssd({ sessionId: s4, phoneNumber: clientPhone, text: '4' }));
  printStep('Option 4 - Skill', await handleUssd({ sessionId: s4, phoneNumber: clientPhone, text: '4*plumb' }));
  printStep('Option 4 - Choose', await handleUssd({ sessionId: s4, phoneNumber: clientPhone, text: '4*plumb*1' }));

  // Option 5: Rate freelancer
  const s5 = `mkt-5-${Date.now()}`;
  printStep('Option 5 - Menu', await handleUssd({ sessionId: s5, phoneNumber: clientPhone, text: '' }));
  printStep('Option 5 - Select', await handleUssd({ sessionId: s5, phoneNumber: clientPhone, text: '5' }));
  printStep('Option 5 - Phone', await handleUssd({ sessionId: s5, phoneNumber: clientPhone, text: `5*${freelancerPhone}` }));
  printStep('Option 5 - Score', await handleUssd({ sessionId: s5, phoneNumber: clientPhone, text: `5*${freelancerPhone}*5` }));

  // Option 6: Verify work status
  const s6 = `mkt-6-${Date.now()}`;
  printStep('Option 6 - Menu', await handleUssd({ sessionId: s6, phoneNumber: clientPhone, text: '' }));
  printStep('Option 6 - Select', await handleUssd({ sessionId: s6, phoneNumber: clientPhone, text: '6' }));
  printStep('Option 6 - Ref', await handleUssd({ sessionId: s6, phoneNumber: clientPhone, text: `6*${refs.releasedRef}` }));

  // Option 7: Confirm checklist
  const s7 = `mkt-7-${Date.now()}`;
  printStep('Option 7 - Menu', await handleUssd({ sessionId: s7, phoneNumber: clientPhone, text: '' }));
  printStep('Option 7 - Select', await handleUssd({ sessionId: s7, phoneNumber: clientPhone, text: '7' }));
  printStep('Option 7 - Ref', await handleUssd({ sessionId: s7, phoneNumber: clientPhone, text: `7*${refs.checklistRef}` }));
  printStep('Option 7 - Leak', await handleUssd({ sessionId: s7, phoneNumber: clientPhone, text: `7*${refs.checklistRef}*1` }));
  printStep('Option 7 - Flow', await handleUssd({ sessionId: s7, phoneNumber: clientPhone, text: `7*${refs.checklistRef}*1*1` }));
  printStep('Option 7 - Callback', await handleUssd({ sessionId: s7, phoneNumber: clientPhone, text: `7*${refs.checklistRef}*1*1*2` }));

  // eslint-disable-next-line no-console
  console.log('\n=== Result: All options executed in terminal simulation ===');
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Market readiness test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
