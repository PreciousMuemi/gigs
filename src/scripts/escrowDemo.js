/**
 * Escrow Simulation for Hackathon
 * Real escrow is held by Africa's Talking; this simulates the flow
 * without actual M-Pesa payments.
 *
 * Use this to demo the full workflow in 2 minutes:
 * 1. Client funds escrow (mocked)
 * 2. Freelancer marks work complete
 * 3. Client confirms + releases payment
 * 4. Both rate each other
 */

const repo = require('../repositories/platformRepository');
const notify = require('../services/notificationService');

// ============================================================================
// STEP 1: Mock Escrow Funding (Client approves payment via STK)
// ============================================================================

async function mockClientFundsEscrow({ contractId }) {
  const contract = await repo.getContractById(contractId);
  if (!contract) throw new Error('Contract not found');

  // Simulate STK push accepted (would happen on client's phone in real scenario)
  await repo.insertEscrowTx({
    contractId,
    type: 'fund',
    amount: contract.agreed_amount,
    currency: contract.currency,
    idempotencyKey: `mock-fund-${contractId}-${Date.now()}`,
    providerReference: `MOCK-STK-${Date.now()}`,
    status: 'success', // Instantly succeed in mock mode
    rawPayload: {
      mode: 'hackathon_mock',
      note: 'Simulated STK push - real would require M-Pesa approval',
    },
  });

  // Update contract status
  await repo.setContractStatus(contractId, 'in_progress');

  const parties = await repo.getContractParties(contractId);
  try {
    await notify.sendSms(parties.client_phone, `Escrow funded for contract ${contractId.slice(0, 8)}. Freelancer can now start work.`);
    await notify.sendSms(parties.freelancer_phone, `Escrow received for contract ${contractId.slice(0, 8)}. You can start work.`);
  } catch (_) {
    // ignore SMS errors
  }

  return { ok: true, contractId, amount: contract.agreed_amount };
}

// ============================================================================
// STEP 2: Freelancer Marks Work Complete
// ============================================================================

async function freelancerSubmitsWork({ contractId, deliveryNotes = '' }) {
  const contract = await repo.getContractById(contractId);
  if (!contract) throw new Error('Contract not found');

  await repo.setContractStatus(contractId, 'work_submitted');

  const parties = await repo.getContractParties(contractId);
  try {
    await notify.sendSms(
      parties.client_phone,
      `Work submitted for contract ${contractId.slice(0, 8)}. Review and confirm to release payment.`,
    );
  } catch (_) {
    // ignore
  }

  return { ok: true, contractId, status: 'work_submitted' };
}

// ============================================================================
// STEP 3: Client Confirms + Releases Escrow
// ============================================================================

async function clientConfirmsAndReleases({ contractId }) {
  const contract = await repo.getContractById(contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'work_submitted') {
    throw new Error(`Invalid status: ${contract.status}. Expected work_submitted.`);
  }

  // Record release transaction
  await repo.insertEscrowTx({
    contractId,
    type: 'release',
    amount: contract.agreed_amount,
    currency: contract.currency,
    idempotencyKey: `mock-release-${contractId}-${Date.now()}`,
    providerReference: `MOCK-RELEASE-${Date.now()}`,
    status: 'success',
    rawPayload: {
      mode: 'hackathon_mock',
      note: 'Escrow released - real would trigger M-Pesa payout',
    },
  });

  // Update contract status
  await repo.setContractStatus(contractId, 'released');

  const parties = await repo.getContractParties(contractId);
  try {
    await notify.sendSms(
      parties.freelancer_phone,
      `Payment released! KES ${contract.agreed_amount} for contract ${contractId.slice(0, 8)}.`,
    );
    await notify.sendSms(parties.client_phone, `Payment confirmed and released for contract ${contractId.slice(0, 8)}.`);
  } catch (_) {
    // ignore
  }

  return { ok: true, contractId, amount: contract.agreed_amount, status: 'released' };
}

// ============================================================================
// STEP 4: Both Parties Rate Each Other
// ============================================================================

async function clientRatesFreelancer({ contractId, fromUserId, toUserId, score, comment }) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be between 1 and 5');
  }

  await repo.createRating({
    contractId,
    fromUserId,
    toUserId,
    score,
    comment,
  });

  return { ok: true, contractId, ratedBy: 'client', score };
}

async function freelancerRatesClient({ contractId, fromUserId, toUserId, score, comment }) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be between 1 and 5');
  }

  await repo.createRating({
    contractId,
    fromUserId,
    toUserId,
    score,
    comment,
  });

  return { ok: true, contractId, ratedBy: 'freelancer', score };
}

// ============================================================================
// Demo: Full Hackathon Workflow
// ============================================================================

async function runHackathonDemo() {
  // eslint-disable-next-line no-console
  console.log('=== Hackathon Escrow Demo ===\n');

  try {
    // Use existing contract if present, otherwise create demo entities.
    let contractId = '550e8400-e29b-41d4-a716-446655440000'; // legacy placeholder
    let contract = await repo.getContractById(contractId);

    if (!contract) {
      const client = await repo.upsertUserByPhone({
        phone: '+254700111111',
        fullName: 'Demo Client',
        role: 'client',
        region: 'Nairobi',
      });

      const freelancer = await repo.upsertUserByPhone({
        phone: '+254700222222',
        fullName: 'Demo Freelancer',
        role: 'freelancer',
      });

      await repo.upsertUserSkillByName({
        userId: freelancer.id,
        skillName: 'plumbing',
      });

      const job = await repo.createJob({
        clientId: client.id,
        title: 'Fix kitchen sink',
        description: 'Leaking kitchen sink needs repair',
        budget: 1500,
        currency: 'KES',
      });

      const app = await repo.createApplication({
        jobId: job.id,
        freelancerId: freelancer.id,
        bidAmount: 1400,
        coverNote: 'Can complete today',
      });

      contract = await repo.createContractFromApplication({
        jobId: job.id,
        clientId: client.id,
        freelancerId: freelancer.id,
        agreedAmount: app.bid_amount,
        currency: 'KES',
      });

      contractId = contract.id;
      // eslint-disable-next-line no-console
      console.log(`ℹ️ Created demo contract: ${contractId.slice(0, 8)}`);
    }

    // eslint-disable-next-line no-console
    console.log('1️⃣ Client funds escrow (mock STK push)...');
    const step1 = await mockClientFundsEscrow({ contractId });
    // eslint-disable-next-line no-console
    console.log(`✓ Escrow funded: KES ${step1.amount}\n`);

    // eslint-disable-next-line no-console
    console.log('2️⃣ Freelancer submits work...');
    const step2 = await freelancerSubmitsWork({ contractId, deliveryNotes: 'Fixed the kitchen sink' });
    // eslint-disable-next-line no-console
    console.log(`✓ Work submitted: ${step2.status}\n`);

    // eslint-disable-next-line no-console
    console.log('3️⃣ Client confirms and releases payment...');
    const step3 = await clientConfirmsAndReleases({ contractId });
    // eslint-disable-next-line no-console
    console.log(`✓ Payment released: KES ${step3.amount}\n`);

    // eslint-disable-next-line no-console
    console.log('4️⃣ Both parties rate each other...');
    const parties = await repo.getContractParties(contractId);
    await clientRatesFreelancer({
      contractId,
      fromUserId: parties.client_id,
      toUserId: parties.freelancer_id,
      score: 5,
      comment: 'Excellent work, very professional',
    });
    // eslint-disable-next-line no-console
    console.log('✓ Client rated freelancer 5/5\n');

    await freelancerRatesClient({
      contractId,
      fromUserId: parties.freelancer_id,
      toUserId: parties.client_id,
      score: 5,
      comment: 'Great client, clear instructions',
    });
    // eslint-disable-next-line no-console
    console.log('✓ Freelancer rated client 5/5\n');

    // eslint-disable-next-line no-console
    console.log('✓ Demo complete! Full escrow workflow successful.\n');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Demo error:', error.message);
  }
}

module.exports = {
  mockClientFundsEscrow,
  freelancerSubmitsWork,
  clientConfirmsAndReleases,
  clientRatesFreelancer,
  freelancerRatesClient,
  runHackathonDemo,
};

// Run demo if called directly
if (require.main === module) {
  runHackathonDemo();
}
