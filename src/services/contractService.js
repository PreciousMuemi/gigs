const repo = require('../repositories/platformRepository');
const paymentEscrow = require('./paymentEscrowService');
const notify = require('./notificationService');

async function acceptApplicationAndRequestEscrow({ jobId, freelancerId }) {
  const job = await repo.getJobById(jobId);
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }

  const apps = await repo.listApplicationsForJob(jobId);
  const target = apps.find((a) => a.freelancer_id === freelancerId);
  if (!target) {
    const err = new Error('Application not found for freelancer');
    err.status = 404;
    throw err;
  }

  const contract = await repo.createContractFromApplication({
    jobId,
    clientId: job.client_id,
    freelancerId,
    agreedAmount: target.bid_amount,
    currency: job.currency,
  });

  const parties = await repo.getContractParties(contract.id);

  const stk = await paymentEscrow.initiateFunding({
    contract,
    clientPhone: parties.client_phone,
  });

  try {
    await notify.sendSms(parties.client_phone, `Escrow STK push sent for ${contract.agreed_amount} ${contract.currency}. Contract ${contract.id.slice(0, 8)}.`);
    await notify.sendSms(parties.freelancer_phone, `Client accepted your bid. Awaiting escrow funding for contract ${contract.id.slice(0, 8)}.`);
  } catch (_) {
    // non-blocking
  }

  return { contract, stk };
}

async function markWorkSubmitted(contractId) {
  const contract = await repo.getContractById(contractId);
  if (!contract) {
    const err = new Error('Contract not found');
    err.status = 404;
    throw err;
  }

  const updated = await repo.setContractStatus(contractId, 'work_submitted');
  await repo.setJobStatusByJobId(contract.job_id, 'delivered');

  const parties = await repo.getContractParties(contractId);
  try {
    await notify.sendSms(parties.client_phone, `Work marked submitted for contract ${contractId.slice(0, 8)}. Confirm to release escrow.`);
  } catch (_) {}

  return updated;
}

async function confirmAndRelease(contractId) {
  const contract = await repo.getContractById(contractId);
  if (!contract) {
    const err = new Error('Contract not found');
    err.status = 404;
    throw err;
  }

  await repo.insertEscrowTx({
    contractId,
    type: 'release',
    amount: contract.agreed_amount,
    currency: contract.currency,
    idempotencyKey: `release-${contractId}-${Date.now()}`,
    providerReference: `manual-release-${Date.now()}`,
    status: 'success',
    rawPayload: { mode: 'manual_release_placeholder' },
  });

  const updated = await repo.setContractStatus(contractId, 'released');
  await repo.setJobStatusByJobId(contract.job_id, 'completed');

  const parties = await repo.getContractParties(contractId);
  try {
    await notify.sendSms(parties.client_phone, `Escrow released for contract ${contractId.slice(0, 8)}.`);
    await notify.sendSms(parties.freelancer_phone, `Payment released for contract ${contractId.slice(0, 8)}.`);
  } catch (_) {}

  return updated;
}

module.exports = {
  acceptApplicationAndRequestEscrow,
  markWorkSubmitted,
  confirmAndRelease,
};
