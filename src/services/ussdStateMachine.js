const repo = require('../repositories/platformRepository');
const notify = require('./notificationService');
const contractService = require('./contractService');

let dbFallbackMode = false;
const memoryStore = {
  sessions: new Map(),
  usersByPhone: new Map(),
  jobs: [],
  applications: [],
  ratings: [],
};

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function useFallback(error) {
  if (dbFallbackMode) return true;
  const msg = String(error?.message || error || '');
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|getaddrinfo|connect/i.test(msg)) {
    dbFallbackMode = true;
    return true;
  }
  return false;
}

function memoryGetSession(sessionId) {
  return memoryStore.sessions.get(sessionId) || null;
}

function memoryUpsertSession({ sessionId, phone, state, context }) {
  memoryStore.sessions.set(sessionId, {
    session_id: sessionId,
    phone,
    state,
    context_json: context || {},
  });
}

function memoryDeleteSession(sessionId) {
  memoryStore.sessions.delete(sessionId);
}

function memoryUpsertUserByPhone({ phone, fullName, role, region }) {
  const existing = memoryStore.usersByPhone.get(phone);
  if (existing) {
    existing.full_name = fullName || existing.full_name;
    existing.role = role || existing.role;
    existing.region = region || existing.region;
    return existing;
  }

  const user = {
    id: makeId('usr'),
    phone,
    full_name: fullName || 'User',
    role: role || 'freelancer',
    region: region || null,
    skill_name: null,
    avg_rating: 0,
  };
  memoryStore.usersByPhone.set(phone, user);
  return user;
}

function memoryUpsertUserSkillByName({ userId, skillName }) {
  for (const user of memoryStore.usersByPhone.values()) {
    if (user.id === userId) {
      user.skill_name = skillName;
      break;
    }
  }
}

function memoryFindFreelancersBySkill(skill, limit) {
  const query = String(skill || '').toLowerCase();
  return Array.from(memoryStore.usersByPhone.values())
    .filter((u) => u.role === 'freelancer' && String(u.skill_name || '').toLowerCase().includes(query))
    .slice(0, limit)
    .map((u) => ({
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      avg_rating: u.avg_rating || 0,
    }));
}

function memoryCreateJob({ clientId, title, budget, currency }) {
  const job = {
    id: makeId('job'),
    client_id: clientId,
    title,
    budget,
    currency,
    status: 'open',
  };
  memoryStore.jobs.push(job);
  return job;
}

function memoryListOpenJobs(limit = 10) {
  return memoryStore.jobs
    .filter((j) => j.status === 'open')
    .slice(0, limit)
    .map((j) => {
      const client = Array.from(memoryStore.usersByPhone.values()).find((u) => u.id === j.client_id);
      return {
        ...j,
        client_name: client?.full_name || 'Client',
        client_phone: client?.phone || null,
      };
    });
}

function memoryCreateApplication({ jobId, freelancerId, bidAmount, coverNote = null }) {
  const existing = memoryStore.applications.find((a) => a.job_id === jobId && a.freelancer_id === freelancerId);
  if (existing) {
    existing.bid_amount = bidAmount;
    existing.cover_note = coverNote;
    return existing;
  }

  const app = {
    id: makeId('app'),
    job_id: jobId,
    freelancer_id: freelancerId,
    bid_amount: bidAmount,
    cover_note: coverNote,
    status: 'pending',
  };
  memoryStore.applications.push(app);
  return app;
}

function memoryCreateRatingByPhones({ fromPhone, toPhone, score }) {
  const fromUser = memoryStore.usersByPhone.get(fromPhone) || memoryUpsertUserByPhone({
    phone: fromPhone,
    fullName: 'User',
    role: 'client',
  });
  const toUser = memoryStore.usersByPhone.get(toPhone);
  if (!toUser) throw new Error('Target user not found');

  memoryStore.ratings.push({
    id: makeId('rat'),
    from_user_id: fromUser.id,
    to_user_id: toUser.id,
    score,
  });

  const ratings = memoryStore.ratings.filter((r) => r.to_user_id === toUser.id);
  toUser.avg_rating = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
}

async function getSession(sessionId) {
  if (dbFallbackMode) return memoryGetSession(sessionId);
  try {
    return await repo.getSession(sessionId);
  } catch (error) {
    if (useFallback(error)) return memoryGetSession(sessionId);
    throw error;
  }
}

async function upsertSession(data) {
  if (dbFallbackMode) return memoryUpsertSession(data);
  try {
    return await repo.upsertSession(data);
  } catch (error) {
    if (useFallback(error)) return memoryUpsertSession(data);
    throw error;
  }
}

async function deleteSession(sessionId) {
  if (dbFallbackMode) return memoryDeleteSession(sessionId);
  try {
    return await repo.deleteSession(sessionId);
  } catch (error) {
    if (useFallback(error)) return memoryDeleteSession(sessionId);
    throw error;
  }
}

async function upsertUserByPhone(data) {
  if (dbFallbackMode) return memoryUpsertUserByPhone(data);
  try {
    return await repo.upsertUserByPhone(data);
  } catch (error) {
    if (useFallback(error)) return memoryUpsertUserByPhone(data);
    throw error;
  }
}

async function upsertUserSkillByName(data) {
  if (dbFallbackMode) return memoryUpsertUserSkillByName(data);
  try {
    return await repo.upsertUserSkillByName(data);
  } catch (error) {
    if (useFallback(error)) return memoryUpsertUserSkillByName(data);
    throw error;
  }
}

async function writeAudit(data) {
  if (dbFallbackMode) return undefined;
  try {
    return await repo.writeAudit(data);
  } catch (error) {
    if (useFallback(error)) return undefined;
    throw error;
  }
}

async function getUserByPhone(phone) {
  if (dbFallbackMode) return memoryStore.usersByPhone.get(phone) || null;
  try {
    return await repo.getUserByPhone(phone);
  } catch (error) {
    if (useFallback(error)) return memoryStore.usersByPhone.get(phone) || null;
    throw error;
  }
}

async function createJob(data) {
  if (dbFallbackMode) return memoryCreateJob(data);
  try {
    return await repo.createJob(data);
  } catch (error) {
    if (useFallback(error)) return memoryCreateJob(data);
    throw error;
  }
}

async function findFreelancersBySkill(skill, limit) {
  if (dbFallbackMode) return memoryFindFreelancersBySkill(skill, limit);
  try {
    return await repo.findFreelancersBySkill(skill, limit);
  } catch (error) {
    if (useFallback(error)) return memoryFindFreelancersBySkill(skill, limit);
    throw error;
  }
}

async function createRatingByPhones(data) {
  if (dbFallbackMode) return memoryCreateRatingByPhones(data);
  try {
    return await repo.createRatingByPhones(data);
  } catch (error) {
    if (useFallback(error)) return memoryCreateRatingByPhones(data);
    throw error;
  }
}

async function listOpenJobs(limit) {
  if (dbFallbackMode) return memoryListOpenJobs(limit);
  try {
    return await repo.listOpenJobs(limit);
  } catch (error) {
    if (useFallback(error)) return memoryListOpenJobs(limit);
    throw error;
  }
}

async function createApplication(data) {
  if (dbFallbackMode) return memoryCreateApplication(data);
  try {
    return await repo.createApplication(data);
  } catch (error) {
    if (useFallback(error)) return memoryCreateApplication(data);
    throw error;
  }
}

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
  VERIFY_WORK_REF: 'VERIFY_WORK_REF',
  VERIFY_WORK_CHECKLIST_REF: 'VERIFY_WORK_CHECKLIST_REF',
  VERIFY_WORK_CHECKLIST_LEAK: 'VERIFY_WORK_CHECKLIST_LEAK',
  VERIFY_WORK_CHECKLIST_FLOW: 'VERIFY_WORK_CHECKLIST_FLOW',
  VERIFY_WORK_CHECKLIST_CALLBACK: 'VERIFY_WORK_CHECKLIST_CALLBACK',
  VIEW_OPEN_JOBS_SELECT: 'VIEW_OPEN_JOBS_SELECT',
};

async function getContractByRefForPhone({ contractRef, phone }) {
  if (dbFallbackMode) return null;
  try {
    return await repo.getContractByRefForPhone({ contractRef, phone });
  } catch (error) {
    if (useFallback(error)) return null;
    throw error;
  }
}

function con(message) {
  return `CON ${message}`;
}

function end(message) {
  return `END ${message}`;
}

async function handleUssd({ sessionId, phoneNumber, text }) {
  const existingSession = await getSession(sessionId);

  if (!existingSession) {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.MAIN_MENU,
      context: {},
    });

    return con([
      'Welcome to iKokazi',
      '1. Register as Freelancer',
      '2. Register as Client',
      '3. Post a Job (get bids)',
      '4. Find Work / Freelancer',
      '5. Rate a Freelancer',
      '6. Track Job & Payment',
      '7. Confirm Finished Work',
      '8. View Open Jobs & Bid',
      '0. Exit',
    ].join('\n'));
  }

  const input = getLatestInput(text);
  const state = existingSession.state;
  const ctx = existingSession.context_json || {};

  if (input === '0') {
    await deleteSession(sessionId);
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
    case STATES.VERIFY_WORK_REF:
      return handleVerifyWorkRef({ sessionId, phoneNumber, input });
    case STATES.VERIFY_WORK_CHECKLIST_REF:
      return handleVerifyChecklistRef({ sessionId, phoneNumber, input });
    case STATES.VERIFY_WORK_CHECKLIST_LEAK:
      return handleVerifyChecklistLeak({ sessionId, phoneNumber, input, ctx });
    case STATES.VERIFY_WORK_CHECKLIST_FLOW:
      return handleVerifyChecklistFlow({ sessionId, phoneNumber, input, ctx });
    case STATES.VERIFY_WORK_CHECKLIST_CALLBACK:
      return handleVerifyChecklistCallback({ sessionId, phoneNumber, input, ctx });
    case STATES.VIEW_OPEN_JOBS_SELECT:
      return handleViewOpenJobsSelect({ sessionId, phoneNumber, input, ctx });
    default:
      await upsertSession({
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
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.REGISTER_FREELANCER_NAME,
      context: {},
    });
    return con('Enter your full name:');
  }

  if (input === '2') {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.REGISTER_CLIENT_NAME,
      context: {},
    });
    return con('Enter your full name:');
  }

  if (input === '3') {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.POST_JOB_TITLE,
      context: {},
    });
    return con('Post job: enter title (e.g. Mama Fua weekly cleaning):');
  }

  if (input === '4') {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.FIND_FREELANCER_SKILL,
      context: {},
    });
    return con('Enter skill/job keyword (e.g. cleaning, plumber):');
  }

  if (input === '5') {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.RATE_FREELANCER_PHONE,
      context: {},
    });
    return con('Enter freelancer phone number:');
  }

  if (input === '6') {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.VERIFY_WORK_REF,
      context: {},
    });
    return con('Track story (funded → in progress → submitted → released).\nEnter contract ref (first 8 chars):');
  }

  if (input === '7') {
    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.VERIFY_WORK_CHECKLIST_REF,
      context: {},
    });
    return con('If worker finished, confirm and release funds.\nEnter contract ref (first 8 chars):');
  }

  if (input === '8') {
    const jobs = await listOpenJobs(20);
    const options = jobs.slice(0, 5);
    if (!options.length) {
      await deleteSession(sessionId);
      return end('No open jobs available right now. Try again later.');
    }

    const menu = options
      .map((j, i) => `${i + 1}. ${j.title} - ${j.currency} ${j.budget}`)
      .join('\n');

    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.VIEW_OPEN_JOBS_SELECT,
      context: {
        jobs: options.map((j) => ({
          id: j.id,
          title: j.title,
          budget: j.budget,
          currency: j.currency,
          clientPhone: j.client_phone,
          clientName: j.client_name,
        })),
      },
    });

    return con(`Open jobs:\n${menu}\nSelect job number to place bid:`);
  }

  return con('Invalid option.\n1.Register Freelancer\n2.Register Client\n3.Post Job\n4.Find Work/Freelancer\n5.Rate Freelancer\n6.Track Job/Payment\n7.Confirm Finished Work\n8.View Open Jobs & Bid\n0.Exit');
}

async function handleRegisterFreelancerName({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 3) return con('Name too short. Enter full name:');

  await upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.REGISTER_FREELANCER_SKILL,
    context: { fullName: input },
  });

  return con('Enter your main skill (e.g. electrician):');
}

async function handleRegisterFreelancerSkill({ sessionId, phoneNumber, input, ctx }) {
  if (!input || input.length < 2) return con('Skill too short. Enter your main skill:');

  const user = await upsertUserByPhone({
    phone: phoneNumber,
    fullName: ctx.fullName,
    role: 'freelancer',
  });
  await upsertUserSkillByName({ userId: user.id, skillName: input });

  await writeAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'user.register.freelancer',
    payload: { phone: phoneNumber, skill: input },
  });

  await deleteSession(sessionId);
  try {
    await notify.sendSms(phoneNumber, `Welcome ${ctx.fullName}. Freelancer profile created with skill: ${input}.`);
  } catch (_) {
    // ignore SMS errors in USSD flow
  }

  return end('Freelancer profile created successfully.');
}

async function handleRegisterClientName({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 3) return con('Name too short. Enter full name:');

  await upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.REGISTER_CLIENT_LOCATION,
    context: { fullName: input },
  });

  return con('Enter your location (town/city):');
}

async function handleRegisterClientLocation({ sessionId, phoneNumber, input, ctx }) {
  if (!input || input.length < 2) return con('Location too short. Enter town/city:');

  const user = await upsertUserByPhone({
    phone: phoneNumber,
    fullName: ctx.fullName,
    role: 'client',
    region: input,
  });

  await writeAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'user.register.client',
    payload: { phone: phoneNumber, location: input },
  });

  await deleteSession(sessionId);
  try {
    await notify.sendSms(phoneNumber, `Welcome ${ctx.fullName}. Client profile created for ${input}.`);
  } catch (_) {
    // ignore SMS errors in USSD flow
  }

  return end('Client profile created successfully.');
}

async function handlePostJobTitle({ sessionId, input }) {
  if (!input || input.length < 4) return con('Title too short. Enter job title:');

  const session = await getSession(sessionId);
  await upsertSession({
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

  const currentUser = await getUserByPhone(phoneNumber);
  if (!currentUser) return end('Please register as client first.');

  const job = await createJob({
    clientId: currentUser.id,
    title: ctx.title,
    budget,
    currency: 'KES',
  });

  await writeAudit({
    actorType: 'user',
    actorId: currentUser.id,
    action: 'job.posted',
    payload: { jobId: job.id, title: job.title, budget },
  });

  await deleteSession(sessionId);
  try {
    await notify.sendSms(
      phoneNumber,
      `Job posted: ${job.title} (${job.currency} ${job.budget}). Ref ${job.id.slice(0, 8).toUpperCase()}. We will notify you when a freelancer bids.`,
    );
  } catch (_) {
    // non-blocking
  }

  return end(
    `Job posted. Ref: ${job.id.slice(0, 8).toUpperCase()}\n` +
    'Story:\n1) Freelancers discover and bid\n2) You get SMS on each bid\n3) You choose winner and fund escrow',
  );
}

async function handleFindFreelancerSkill({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 2) return con('Skill too short. Enter required skill:');

  const currentUser = await getUserByPhone(phoneNumber);
  const role = String(currentUser?.role || '').toLowerCase();

  if (role === 'freelancer' || role === 'both') {
    const jobs = await listOpenJobs(20);
    const query = String(input || '').toLowerCase();
    const matchingJobs = jobs
      .filter((j) => String(j.title || '').toLowerCase().includes(query))
      .slice(0, 3);

    if (!matchingJobs.length) {
      await deleteSession(sessionId);
      return end('No open jobs matched that keyword.');
    }

    const menu = matchingJobs
      .map((j, i) => `${i + 1}. ${j.title} - ${j.currency} ${j.budget}`)
      .join('\n');

    await upsertSession({
      sessionId,
      phone: phoneNumber,
      state: STATES.FIND_FREELANCER_SELECT,
      context: {
        mode: 'jobs',
        skill: input,
        jobs: matchingJobs.map((j) => ({
          id: j.id,
          title: j.title,
          budget: j.budget,
          currency: j.currency,
          clientPhone: j.client_phone,
          clientName: j.client_name,
        })),
      },
    });

    return con(`Open jobs near your skill:\n${menu}\nSelect job number to place bid:`);
  }

  const freelancers = await findFreelancersBySkill(input, 3);
  if (!freelancers.length) {
    await deleteSession(sessionId);
    return end('No freelancers found for that skill.');
  }

  const menu = freelancers
    .map((f, i) => `${i + 1}. ${f.full_name || 'Freelancer'} - ${Number(f.avg_rating).toFixed(1)}`)
    .join('\n');

  await upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.FIND_FREELANCER_SELECT,
    context: {
      mode: 'freelancers',
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
  if (ctx.mode === 'jobs') {
    const options = ctx.jobs || [];
    const idx = Number(input) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return con('Invalid option. Select listed job number:');
    }

    const selectedJob = options[idx];
    const freelancer = await getUserByPhone(phoneNumber);
    if (!freelancer || !['freelancer', 'both'].includes(String(freelancer.role || '').toLowerCase())) {
      await deleteSession(sessionId);
      return end('Please register as freelancer first to place a bid.');
    }

    await createApplication({
      jobId: selectedJob.id,
      freelancerId: freelancer.id,
      bidAmount: Number(selectedJob.budget),
      coverNote: `USSD bid by ${phoneNumber}`,
    });

    try {
      if (selectedJob.clientPhone) {
        await notify.sendSms(
          selectedJob.clientPhone,
          `New bid on your job "${selectedJob.title}" from ${freelancer.full_name || 'Freelancer'} (${phoneNumber}).`,
        );
      }
      await notify.sendSms(
        phoneNumber,
        `Bid sent for "${selectedJob.title}". Client notified. Wait for acceptance + escrow funding prompt.`,
      );
    } catch (_) {
      // non-blocking
    }

    await deleteSession(sessionId);
    return end('Bid submitted. Client has been notified by SMS.');
  }

  const options = ctx.freelancers || [];
  const idx = Number(input) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
    return con('Invalid option. Select listed freelancer number:');
  }

  const selected = options[idx];
  await deleteSession(sessionId);

  try {
    await notify.sendSms(
      selected.phone,
      `New request: client ${phoneNumber} needs ${ctx.skill}. Reply with your quote/bid.`,
    );
    await notify.sendSms(
      phoneNumber,
      `Freelancer selected: ${selected.name || 'N/A'} (${selected.phone}). We alerted them to send a bid/quote.`,
    );
  } catch (_) {
    // ignore SMS errors in USSD flow
  }

  return end('Request sent. You will be notified once freelancer sends a bid.');
}

async function handleRateFreelancerPhone({ sessionId, phoneNumber, input }) {
  if (!input || input.length < 8) return con('Invalid phone number. Enter freelancer phone number:');

  await upsertSession({
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
    await createRatingByPhones({
      fromPhone: phoneNumber,
      toPhone: ctx.freelancerPhone,
      score,
    });
  } catch (error) {
    await deleteSession(sessionId);
    return end('Rating failed. Ensure you have a completed contract with this freelancer.');
  }

  await deleteSession(sessionId);
  return end('Rating submitted. Thank you.');
}

function formatContractStatus(status) {
  const map = {
    awaiting_escrow: 'Awaiting escrow funding',
    in_progress: 'Work in progress',
    work_submitted: 'Submitted, awaiting client confirmation',
    completed: 'Completed',
    released: 'Payment released',
    refunded: 'Refunded',
    disputed: 'Disputed',
  };
  return map[status] || status;
}

async function handleVerifyWorkRef({ sessionId, phoneNumber, input }) {
  const contractRef = String(input || '').trim();
  if (contractRef.length < 6) {
    return con('Invalid ref. Enter first 8 chars of contract ref:');
  }

  const contract = await getContractByRefForPhone({ contractRef, phone: phoneNumber });
  await deleteSession(sessionId);

  if (!contract) {
    return end('No contract found for this ref and phone number.');
  }

  const normalizedPhone = String(phoneNumber || '').replace(/^\+/, '');
  const normalizedClientPhone = String(contract.client_phone || '').replace(/^\+/, '');
  const counterpart = normalizedClientPhone === normalizedPhone ? contract.freelancer_phone : contract.client_phone;

  let nextStep = 'Keep tracking for updates.';
  if (contract.status === 'awaiting_escrow') nextStep = 'Next: client funds escrow via M-Pesa.';
  if (contract.status === 'in_progress') nextStep = 'Next: worker completes task and marks submitted.';
  if (contract.status === 'work_submitted') nextStep = 'Next: client uses option 7 to confirm and release funds.';
  if (contract.status === 'released') nextStep = 'Done: freelancer paid successfully.';

  return end(
    `Ref ${String(contract.id).slice(0, 8).toUpperCase()}\n` +
    `Status: ${formatContractStatus(contract.status)}\n` +
    `Amount: ${contract.currency} ${contract.agreed_amount}\n` +
    `Counterparty: ${counterpart}\n` +
    `Next: ${nextStep}`,
  );
}

function parseYesNo(input) {
  if (input === '1') return true;
  if (input === '2') return false;
  return null;
}

function normalizePhone(value) {
  return String(value || '').replace(/^\+/, '');
}

async function handleVerifyChecklistRef({ sessionId, phoneNumber, input }) {
  const contractRef = String(input || '').trim();
  if (contractRef.length < 6) {
    return con('Invalid ref. Enter first 8 chars of contract ref:');
  }

  const contract = await getContractByRefForPhone({ contractRef, phone: phoneNumber });
  if (!contract) {
    await deleteSession(sessionId);
    return end('No contract found for this ref and phone number.');
  }

  if (normalizePhone(contract.client_phone) !== normalizePhone(phoneNumber)) {
    await deleteSession(sessionId);
    return end('Only the client can complete checklist verification.');
  }

  if (contract.status !== 'work_submitted') {
    await deleteSession(sessionId);
    return end(`Cannot verify now. Current status: ${formatContractStatus(contract.status)}`);
  }

  await upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.VERIFY_WORK_CHECKLIST_LEAK,
    context: {
      contractId: contract.id,
      contractRef: String(contract.id).slice(0, 8).toUpperCase(),
      jobId: contract.job_id,
      freelancerPhone: contract.freelancer_phone,
    },
  });

  return con('Was the agreed job completed?\n1. Yes\n2. No');
}

async function handleVerifyChecklistLeak({ sessionId, phoneNumber, input, ctx }) {
  const value = parseYesNo(input);
  if (value === null) return con('Select 1 for Yes or 2 for No');

  await upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.VERIFY_WORK_CHECKLIST_FLOW,
    context: {
      ...ctx,
      leakFixed: value,
    },
  });
  return con('Was the quality satisfactory?\n1. Yes\n2. No');
}

async function handleVerifyChecklistFlow({ sessionId, phoneNumber, input, ctx }) {
  const value = parseYesNo(input);
  if (value === null) return con('Select 1 for Yes or 2 for No');

  await upsertSession({
    sessionId,
    phone: phoneNumber,
    state: STATES.VERIFY_WORK_CHECKLIST_CALLBACK,
    context: {
      ...ctx,
      flowRestored: value,
    },
  });
  return con('Is rework needed within 24h?\n1. Yes\n2. No');
}

async function handleVerifyChecklistCallback({ sessionId, phoneNumber, input, ctx }) {
  const value = parseYesNo(input);
  if (value === null) return con('Select 1 for Yes or 2 for No');

  const callbackNeeded = value;
  const decision = ctx.leakFixed && ctx.flowRestored && !callbackNeeded ? 'confirmed' : 'disputed';

  await repo.upsertWorkVerification({
    contractId: ctx.contractId,
    verifierPhone: phoneNumber,
    leakFixed: Boolean(ctx.leakFixed),
    flowRestored: Boolean(ctx.flowRestored),
    callbackNeeded,
    decision,
    notes: decision === 'confirmed' ? 'Checklist passed' : 'Checklist failed',
  });

  await deleteSession(sessionId);

  if (decision === 'confirmed') {
    await contractService.confirmAndRelease(ctx.contractId);
    return end(
      `Great. Mama Fua marked as finished.\n` +
      `Escrow released for ref ${ctx.contractRef}.\n` +
      'Client and worker both notified by SMS.',
    );
  }

  await repo.setContractStatus(ctx.contractId, 'disputed');
  if (ctx.jobId) await repo.setJobStatusByJobId(ctx.jobId, 'disputed');

  try {
    await notify.sendSms(
      ctx.freelancerPhone,
      `Contract ${ctx.contractRef} moved to dispute. Client requested callback/issue resolution.`,
    );
  } catch (_) {
    // non-blocking
  }

  return end(`Checklist failed. Contract ${ctx.contractRef} marked disputed.`);
}

async function handleViewOpenJobsSelect({ sessionId, phoneNumber, input, ctx }) {
  const options = ctx.jobs || [];
  const idx = Number(input) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
    return con('Invalid option. Select listed job number:');
  }

  const selectedJob = options[idx];
  const freelancer = await getUserByPhone(phoneNumber);
  if (!freelancer || !['freelancer', 'both'].includes(String(freelancer.role || '').toLowerCase())) {
    await deleteSession(sessionId);
    return end('Please register as freelancer first to place a bid.');
  }

  await createApplication({
    jobId: selectedJob.id,
    freelancerId: freelancer.id,
    bidAmount: Number(selectedJob.budget),
    coverNote: `USSD bid by ${phoneNumber}`,
  });

  try {
    if (selectedJob.clientPhone) {
      await notify.sendSms(
        selectedJob.clientPhone,
        `New bid on your job "${selectedJob.title}" from ${freelancer.full_name || 'Freelancer'} (${phoneNumber}).`,
      );
    }
    await notify.sendSms(
      phoneNumber,
      `Bid sent for "${selectedJob.title}". Client notified. Wait for acceptance + escrow funding prompt.`,
    );
  } catch (_) {
    // non-blocking
  }

  await deleteSession(sessionId);
  return end('Bid submitted. Client has been notified by SMS.');
}

module.exports = {
  handleUssd,
  STATES,
};
