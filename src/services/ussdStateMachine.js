const repo = require('../repositories/platformRepository');
const notify = require('./notificationService');

const STATES = {
  MAIN_MENU: 'MAIN_MENU',
  REGISTER_ROLE: 'REGISTER_ROLE',
  REGISTER_NAME: 'REGISTER_NAME',
  CLIENT_POST_TITLE: 'CLIENT_POST_TITLE',
  CLIENT_POST_BUDGET: 'CLIENT_POST_BUDGET',
  FREELANCER_BROWSE: 'FREELANCER_BROWSE',
  FREELANCER_APPLY_JOB_ID: 'FREELANCER_APPLY_JOB_ID',
  FREELANCER_APPLY_BID: 'FREELANCER_APPLY_BID',
};

function con(message) {
  return `CON ${message}`;
}

function end(message) {
  return `END ${message}`;
}

async function handleUssd({ sessionId, phoneNumber, text }) {
  const existingSession = await repo.getSession(sessionId);
  const user = await repo.getUserByPhone(phoneNumber);

  if (!existingSession) {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.MAIN_MENU,
      context: {},
    });

    return con([
      'Welcome to KaziLink',
      '1. Register / Update Profile',
      '2. Post Job (Client)',
      '3. Browse Jobs (Freelancer)',
      '4. My Profile',
      '0. Exit',
    ].join('\n'));
  }

  const input = getLatestInput(text);
  const state = existingSession.state;
  const ctx = existingSession.context_json || {};

  if (input === '0') {
    await repo.deleteSession(sessionId);
    return end('Goodbye.');
  }

  switch (state) {
    case STATES.MAIN_MENU:
      return handleMainMenu({ sessionId, phoneNumber, input, user });
    case STATES.REGISTER_ROLE:
      return handleRegisterRole({ sessionId, phoneNumber, input });
    case STATES.REGISTER_NAME:
      return handleRegisterName({ sessionId, phoneNumber, input, ctx });
    case STATES.CLIENT_POST_TITLE:
      return handleClientPostTitle({ sessionId, input });
    case STATES.CLIENT_POST_BUDGET:
      return handleClientPostBudget({ sessionId, phoneNumber, input, user, ctx });
    case STATES.FREELANCER_BROWSE:
      return handleFreelancerBrowse({ sessionId, input, jobs: ctx.jobs || [] });
    case STATES.FREELANCER_APPLY_JOB_ID:
      return handleFreelancerApplyJobId({ sessionId, input, ctx });
    case STATES.FREELANCER_APPLY_BID:
      return handleFreelancerApplyBid({ sessionId, phoneNumber, input, user, ctx });
    default:
      await repo.upsertSession({
        sessionId,
        phone: phoneNumber,
        state: STATES.MAIN_MENU,
        context: {},
      });
      return con('Session reset. Dial again to continue.');
  }
}

function getLatestInput(text) {
  if (!text) return '';
  const parts = text.split('*');
  return (parts[parts.length - 1] || '').trim();
}

async function handleMainMenu({ sessionId, phoneNumber, input, user }) {
  if (input === '1') {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.REGISTER_ROLE,
      context: {},
    });
    return con('Choose role:\n1. Client\n2. Freelancer\n3. Both');
  }

  if (input === '2') {
    if (!user) return end('Please register first from menu 1.');

    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.CLIENT_POST_TITLE,
      context: {},
    });
    return con('Enter job title:');
  }

  if (input === '3') {
    if (!user) return end('Please register first from menu 1.');

    const jobs = await repo.listOpenJobs(5);
    const list = jobs.map((j, i) => `${i + 1}. ${j.title} - ${Number(j.budget).toFixed(0)} ${j.currency}`).join('\n');

    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.FREELANCER_BROWSE,
      context: {
        jobs: jobs.map((j) => ({ id: j.id, title: j.title, budget: j.budget, currency: j.currency })),
      },
    });

    if (!jobs.length) return end('No open jobs currently. Try again later.');

    return con(`${list}\nChoose job number to apply:`);
  }

  if (input === '4') {
    if (!user) return end('Profile not found. Register first.');
    return end(`Name: ${user.full_name || 'N/A'}\nRole: ${user.role}\nPhone: ${user.phone}`);
  }

  return con('Invalid option.\n1. Register\n2. Post Job\n3. Browse Jobs\n4. My Profile\n0. Exit');
}

async function handleRegisterRole({ sessionId, phoneNumber, input }) {
  const role = input === '1' ? 'client' : input === '2' ? 'freelancer' : input === '3' ? 'both' : null;
  if (!role) return con('Invalid role.\n1. Client\n2. Freelancer\n3. Both');

  await repo.upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.REGISTER_NAME,
    context: { role },
  });

  return con('Enter your full name:');
}

async function handleRegisterName({ sessionId, phoneNumber, input, ctx }) {
  if (!input || input.length < 3) return con('Name too short. Enter full name:');

  const user = await repo.upsertUserByPhone({
    phone: phoneNumber,
    fullName: input,
    role: ctx.role,
  });

  await repo.writeAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'user.register_or_update',
    payload: { phone: phoneNumber, role: ctx.role },
  });

  await repo.deleteSession(sessionId);
  try {
    await notify.sendSms(phoneNumber, `Welcome to KaziLink, ${input}. Profile updated as ${ctx.role}.`);
  } catch (_) {
    // ignore SMS failure in USSD flow
  }

  return end('Registration complete.');
}

async function handleClientPostTitle({ sessionId, input }) {
  if (!input || input.length < 4) return con('Title too short. Enter job title:');

  const session = await repo.getSession(sessionId);
  await repo.upsertSession({
    sessionId,
    phone: session.phone,
    state: STATES.CLIENT_POST_BUDGET,
    context: {
      ...session.context_json,
      title: input,
    },
  });

  return con('Enter budget in KES (numbers only):');
}

async function handleClientPostBudget({ sessionId, phoneNumber, input, user, ctx }) {
  const budget = Number(input);
  if (!Number.isFinite(budget) || budget <= 0) return con('Invalid budget. Enter amount in KES:');

  const currentUser = user || (await repo.getUserByPhone(phoneNumber));
  if (!currentUser) return end('Register first.');

  const job = await repo.createJob({
    clientId: currentUser.id,
    title: ctx.title,
    budget,
    currency: 'KES',
  });

  await repo.writeAudit({
    actorType: 'user',
    actorId: currentUser.id,
    action: 'job.posted',
    payload: { jobId: job.id, title: job.title, budget },
  });

  await repo.deleteSession(sessionId);
  return end(`Job posted successfully. Job ID: ${job.id.slice(0, 8)}`);
}

async function handleFreelancerBrowse({ sessionId, input, jobs }) {
  const idx = Number(input) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= jobs.length) return con('Invalid selection. Choose listed job number:');

  const selected = jobs[idx];
  const session = await repo.getSession(sessionId);
  await repo.upsertSession({
    sessionId,
    phone: session.phone,
    state: STATES.FREELANCER_APPLY_BID,
    context: {
      selectedJobId: selected.id,
      selectedJobTitle: selected.title,
    },
  });

  return con(`Job: ${selected.title}\nEnter your bid amount:`);
}

async function handleFreelancerApplyJobId() {
  return end('Not implemented in this state path.');
}

async function handleFreelancerApplyBid({ sessionId, phoneNumber, input, user, ctx }) {
  const bidAmount = Number(input);
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) return con('Invalid bid amount. Enter numeric value:');

  const freelancer = user || (await repo.getUserByPhone(phoneNumber));
  if (!freelancer) return end('Please register first.');

  const application = await repo.createApplication({
    jobId: ctx.selectedJobId,
    freelancerId: freelancer.id,
    bidAmount,
  });

  await repo.writeAudit({
    actorType: 'user',
    actorId: freelancer.id,
    action: 'job.applied',
    payload: { applicationId: application.id, jobId: ctx.selectedJobId, bidAmount },
  });

  await repo.deleteSession(sessionId);
  return end('Application submitted successfully.');
}

module.exports = {
  handleUssd,
  STATES,
};
