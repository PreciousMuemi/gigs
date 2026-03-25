const repo = require('../repositories/platformRepository');
const notify = require('./notificationService');

const STATES = {
  MAIN_MENU: 'MAIN_MENU',
  REGISTER_FREELANCER_NAME: 'REGISTER_FREELANCER_NAME',
  REGISTER_FREELANCER_SKILL: 'REGISTER_FREELANCER_SKILL',
  REGISTER_CLIENT_NAME: 'REGISTER_CLIENT_NAME',
  REGISTER_CLIENT_LOCATION: 'REGISTER_CLIENT_LOCATION',
  POST_JOB_TITLE: 'POST_JOB_TITLE',
  POST_JOB_BUDGET: 'POST_JOB_BUDGET',
  FIND_FREELANCER_SKILL: 'FIND_FREELANCER_SKILL',
  FIND_FREELANCER_SELECT: 'FIND_FREELANCER_SELECT',
  RATE_FREELANCER_PHONE: 'RATE_FREELANCER_PHONE',
  RATE_FREELANCER_SCORE: 'RATE_FREELANCER_SCORE',
};

function con(message) {
  return `CON ${message}`;
}

function end(message) {
  return `END ${message}`;
}

async function handleUssd({ sessionId, phoneNumber, text }) {
  const existingSession = await repo.getSession(sessionId);

  if (!existingSession) {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.MAIN_MENU,
      context: {},
    });

    return con([
      'Welcome to KaziLink',
      '1. Register as Freelancer',
      '2. Register as Client',
      '3. Post a Job',
      '4. Find a Freelancer',
      '5. Rate a Freelancer',
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
      return handleMainMenu({ sessionId, phoneNumber, input });
    case STATES.REGISTER_FREELANCER_NAME:
      return handleRegisterFreelancerName({ sessionId, phoneNumber, input });
    case STATES.REGISTER_FREELANCER_SKILL:
      return handleRegisterFreelancerSkill({ sessionId, phoneNumber, input, ctx });
    case STATES.REGISTER_CLIENT_NAME:
      return handleRegisterClientName({ sessionId, phoneNumber, input });
    case STATES.REGISTER_CLIENT_LOCATION:
      return handleRegisterClientLocation({ sessionId, phoneNumber, input, ctx });
    case STATES.POST_JOB_TITLE:
      return handlePostJobTitle({ sessionId, input });
    case STATES.POST_JOB_BUDGET:
      return handlePostJobBudget({ sessionId, phoneNumber, input, ctx });
    case STATES.FIND_FREELANCER_SKILL:
      return handleFindFreelancerSkill({ sessionId, phoneNumber, input });
    case STATES.FIND_FREELANCER_SELECT:
      return handleFindFreelancerSelect({ sessionId, phoneNumber, input, ctx });
    case STATES.RATE_FREELANCER_PHONE:
      return handleRateFreelancerPhone({ sessionId, phoneNumber, input });
    case STATES.RATE_FREELANCER_SCORE:
      return handleRateFreelancerScore({ sessionId, phoneNumber, input, ctx });
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

async function handleMainMenu({ sessionId, phoneNumber, input }) {
  if (input === '1') {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.REGISTER_FREELANCER_NAME,
      context: {},
    });
    return con('Enter your full name:');
  }

  if (input === '2') {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.REGISTER_CLIENT_NAME,
      context: {},
    });
    return con('Enter your full name:');
  }

  if (input === '3') {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.POST_JOB_TITLE,
      context: {},
    });
    return con('Enter job title:');
  }

  if (input === '4') {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.FIND_FREELANCER_SKILL,
      context: {},
    });
    return con('Enter required skill (e.g. plumber):');
  }

  if (input === '5') {
    await repo.upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.RATE_FREELANCER_PHONE,
      context: {},
    });
    return con('Enter freelancer phone number:');
  }

  return con('Invalid option.\n1.Register Freelancer\n2.Register Client\n3.Post Job\n4.Find Freelancer\n5.Rate Freelancer\n0.Exit');
}

async function handleRegisterFreelancerName({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 3) return con('Name too short. Enter full name:');

  await repo.upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.REGISTER_FREELANCER_SKILL,
    context: { fullName: input },
  });

  return con('Enter your main skill (e.g. plumbing):');
}

async function handleRegisterFreelancerSkill({ sessionId, phoneNumber, input, ctx }) {
  if (!input || input.length < 2) return con('Skill too short. Enter your main skill:');

  const user = await repo.upsertUserByPhone({
    phone: phoneNumber,
    fullName: ctx.fullName,
    role: 'freelancer',
  });
  await repo.upsertUserSkillByName({ userId: user.id, skillName: input });

  await repo.writeAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'user.register.freelancer',
    payload: { phone: phoneNumber, skill: input },
  });

  await repo.deleteSession(sessionId);
  try {
    await notify.sendSms(phoneNumber, `Welcome ${ctx.fullName}. Freelancer profile created with skill: ${input}.`);
  } catch (_) {
    // ignore SMS errors in USSD flow
  }

  return end('Freelancer profile created successfully.');
}

async function handleRegisterClientName({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 3) return con('Name too short. Enter full name:');

  await repo.upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.REGISTER_CLIENT_LOCATION,
    context: { fullName: input },
  });

  return con('Enter your location (town/city):');
}

async function handleRegisterClientLocation({ sessionId, phoneNumber, input, ctx }) {
  if (!input || input.length < 2) return con('Location too short. Enter town/city:');

  const user = await repo.upsertUserByPhone({
    phone: phoneNumber,
    fullName: ctx.fullName,
    role: 'client',
    region: input,
  });

  await repo.writeAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'user.register.client',
    payload: { phone: phoneNumber, location: input },
  });

  await repo.deleteSession(sessionId);
  try {
    await notify.sendSms(phoneNumber, `Welcome ${ctx.fullName}. Client profile created for ${input}.`);
  } catch (_) {
    // ignore SMS errors in USSD flow
  }

  return end('Client profile created successfully.');
}

async function handlePostJobTitle({ sessionId, input }) {
  if (!input || input.length < 4) return con('Title too short. Enter job title:');

  const session = await repo.getSession(sessionId);
  await repo.upsertSession({
    sessionId,
    phone: session.phone,
    state: STATES.POST_JOB_BUDGET,
    context: {
      ...session.context_json,
      title: input,
    },
  });

  return con('Enter budget in KES (numbers only):');
}

async function handlePostJobBudget({ sessionId, phoneNumber, input, ctx }) {
  const budget = Number(input);
  if (!Number.isFinite(budget) || budget <= 0) return con('Invalid budget. Enter amount in KES:');

  const currentUser = await repo.getUserByPhone(phoneNumber);
  if (!currentUser) return end('Please register as client first.');

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
  return end(`Job posted successfully. Ref: ${job.id.slice(0, 8).toUpperCase()}`);
}

async function handleFindFreelancerSkill({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 2) return con('Skill too short. Enter required skill:');

  const freelancers = await repo.findFreelancersBySkill(input, 3);
  if (!freelancers.length) {
    await repo.deleteSession(sessionId);
    return end('No freelancers found for that skill.');
  }

  const menu = freelancers
    .map((f, i) => `${i + 1}. ${f.full_name || 'Freelancer'} - ${Number(f.avg_rating).toFixed(1)}`)
    .join('\n');

  await repo.upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.FIND_FREELANCER_SELECT,
    context: {
      skill: input,
      freelancers: freelancers.map((f) => ({
        id: f.id,
        name: f.full_name,
        phone: f.phone,
        avgRating: f.avg_rating,
      })),
    },
  });

  return con(`Select freelancer:\n${menu}`);
}

async function handleFindFreelancerSelect({ sessionId, phoneNumber, input, ctx }) {
  const options = ctx.freelancers || [];
  const idx = Number(input) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
    return con('Invalid option. Select listed freelancer number:');
  }

  const selected = options[idx];
  await repo.deleteSession(sessionId);

  try {
    await notify.sendSms(
      phoneNumber,
      `Freelancer selected: ${selected.name || 'N/A'} (${selected.phone}). Skill: ${ctx.skill}.`,
    );
  } catch (_) {
    // ignore SMS errors in USSD flow
  }

  return end('Freelancer selected. You will receive SMS contact details.');
}

async function handleRateFreelancerPhone({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 8) return con('Invalid phone number. Enter freelancer phone number:');

  await repo.upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.RATE_FREELANCER_SCORE,
    context: { freelancerPhone: input },
  });

  return con('Rate freelancer (1-5):');
}

async function handleRateFreelancerScore({ sessionId, phoneNumber, input, ctx }) {
  const score = Number(input);
  if (!Number.isInteger(score) || score < 1 || score > 5) return con('Invalid rating. Enter a score from 1 to 5:');

  try {
    await repo.createRatingByPhones({
      fromPhone: phoneNumber,
      toPhone: ctx.freelancerPhone,
      score,
    });
  } catch (error) {
    await repo.deleteSession(sessionId);
    return end('Rating failed. Ensure you have a completed contract with this freelancer.');
  }

  await repo.deleteSession(sessionId);
  return end('Rating submitted. Thank you.');
}

module.exports = {
  handleUssd,
  STATES,
};
