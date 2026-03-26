const repo = require('../repositories/platformRepository');
const contractService = require('../services/contractService');
const pool = require('../db/pool');

async function seedUsersAndSkills() {
  const freelancers = [
    { phone: '+254799300001', fullName: 'Mary Wanjiru', skill: 'cleaning', region: 'Nairobi' },
    { phone: '+254799300002', fullName: 'John Mutiso', skill: 'plumbing', region: 'Nairobi' },
    { phone: '+254799300003', fullName: 'Aisha Omar', skill: 'electrical', region: 'Mombasa' },
    { phone: '+254799300004', fullName: 'Peter Njoroge', skill: 'painting', region: 'Nakuru' },
    { phone: '+254799300005', fullName: 'Lucy Akinyi', skill: 'laundry', region: 'Kisumu' },
    { phone: '+254799300006', fullName: 'Kevin Kiptoo', skill: 'carpentry', region: 'Eldoret' },
  ];

  const clients = [
    { phone: '+254799400001', fullName: 'Grace Homes Ltd', region: 'Nairobi' },
    { phone: '+254799400002', fullName: 'Westlands Apartments', region: 'Nairobi' },
    { phone: '+254799400003', fullName: 'Mombasa Beach Villas', region: 'Mombasa' },
  ];

  const freelancerRows = [];
  const clientRows = [];

  for (const item of freelancers) {
    const user = await repo.upsertUserByPhone({
      phone: item.phone,
      fullName: item.fullName,
      role: 'freelancer',
      region: item.region,
    });
    await repo.upsertUserSkillByName({ userId: user.id, skillName: item.skill });
    freelancerRows.push({ ...user, skill: item.skill });
  }

  for (const item of clients) {
    const user = await repo.upsertUserByPhone({
      phone: item.phone,
      fullName: item.fullName,
      role: 'client',
      region: item.region,
    });
    clientRows.push(user);
  }

  return { freelancers: freelancerRows, clients: clientRows };
}

async function seedJobs(clients) {
  const jobsToCreate = [
    { clientIndex: 0, title: 'Mama Fua weekly cleaning', description: '2-bedroom apartment, every Saturday', budget: 1800 },
    { clientIndex: 0, title: 'Fix leaking kitchen sink', description: 'Replace washer and seal pipe', budget: 2500 },
    { clientIndex: 1, title: 'Repaint bedsitter room', description: 'White paint + ceiling touch-up', budget: 4200 },
    { clientIndex: 1, title: 'Laundry + ironing', description: 'Family laundry twice per week', budget: 1600 },
    { clientIndex: 2, title: 'Install 3 light fixtures', description: 'Indoor LED fitting and testing', budget: 3000 },
    { clientIndex: 2, title: 'Build shoe rack', description: 'Small wooden shoe rack at entrance', budget: 3500 },
  ];

  const jobs = [];
  for (const j of jobsToCreate) {
    const client = clients[j.clientIndex];
    const job = await repo.createJob({
      clientId: client.id,
      title: j.title,
      description: j.description,
      budget: j.budget,
      currency: 'KES',
    });
    jobs.push(job);
  }
  return jobs;
}

async function seedApplicationsAndContracts({ jobs, freelancers }) {
  // Create a few bids so clients can see notifications and choose.
  const bids = [
    { jobIndex: 0, freelancerIndex: 0, bidAmount: 1700, note: 'Can start this weekend' },
    { jobIndex: 0, freelancerIndex: 4, bidAmount: 1650, note: 'Experienced in weekly cleaning' },
    { jobIndex: 1, freelancerIndex: 1, bidAmount: 2300, note: 'Plumber available today' },
    { jobIndex: 2, freelancerIndex: 3, bidAmount: 4000, note: 'Painting team available' },
    { jobIndex: 3, freelancerIndex: 4, bidAmount: 1500, note: 'Laundry specialist' },
    { jobIndex: 4, freelancerIndex: 2, bidAmount: 2900, note: 'Certified electrician' },
    { jobIndex: 5, freelancerIndex: 5, bidAmount: 3300, note: 'Custom carpentry work' },
  ];

  const applications = [];
  for (const b of bids) {
    const app = await repo.createApplication({
      jobId: jobs[b.jobIndex].id,
      freelancerId: freelancers[b.freelancerIndex].id,
      bidAmount: b.bidAmount,
      coverNote: b.note,
    });
    applications.push(app);
  }

  // Create two contracts for story/demo states.
  // Contract 1 -> released
  const contractOne = await repo.createContractFromApplication({
    jobId: jobs[1].id,
    clientId: jobs[1].client_id,
    freelancerId: freelancers[1].id,
    agreedAmount: 2300,
    currency: 'KES',
  });
  await repo.setContractStatus(contractOne.id, 'in_progress');
  await contractService.markWorkSubmitted(contractOne.id);
  await contractService.confirmAndRelease(contractOne.id);

  // Contract 2 -> work_submitted (awaiting client confirmation)
  const contractTwo = await repo.createContractFromApplication({
    jobId: jobs[0].id,
    clientId: jobs[0].client_id,
    freelancerId: freelancers[0].id,
    agreedAmount: 1700,
    currency: 'KES',
  });
  await repo.setContractStatus(contractTwo.id, 'in_progress');
  await contractService.markWorkSubmitted(contractTwo.id);

  return { applications, contractOne, contractTwo };
}

async function run() {
  // eslint-disable-next-line no-console
  console.log('=== Seeding Demo Data (users, skills, jobs, bids, contracts) ===');

  const { freelancers, clients } = await seedUsersAndSkills();
  const jobs = await seedJobs(clients);
  const { applications, contractOne, contractTwo } = await seedApplicationsAndContracts({ jobs, freelancers });

  // eslint-disable-next-line no-console
  console.log(`✓ Freelancers upserted: ${freelancers.length}`);
  // eslint-disable-next-line no-console
  console.log(`✓ Clients upserted: ${clients.length}`);
  // eslint-disable-next-line no-console
  console.log(`✓ Jobs created: ${jobs.length}`);
  // eslint-disable-next-line no-console
  console.log(`✓ Applications created: ${applications.length}`);
  // eslint-disable-next-line no-console
  console.log(`✓ Released contract ref: ${contractOne.id.slice(0, 8).toUpperCase()}`);
  // eslint-disable-next-line no-console
  console.log(`✓ Work-submitted contract ref: ${contractTwo.id.slice(0, 8).toUpperCase()}`);

  // eslint-disable-next-line no-console
  console.log('\nYou can test in USSD now:');
  // eslint-disable-next-line no-console
  console.log('- Option 8: freelancers view open jobs and bid');
  // eslint-disable-next-line no-console
  console.log(`- Option 6 with released ref: ${contractOne.id.slice(0, 8).toUpperCase()}`);
  // eslint-disable-next-line no-console
  console.log(`- Option 7 with submitted ref: ${contractTwo.id.slice(0, 8).toUpperCase()}`);
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
