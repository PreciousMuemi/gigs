const { v4: uuidv4 } = require('uuid');
const repo = require('../repositories/platformRepository');
const atClient = require('./africasTalkingClient');

async function initiateFunding({ contract, clientPhone }) {
  const idempotencyKey = `fund-${contract.id}-${Date.now()}`;

  const tx = await repo.insertEscrowTx({
    contractId: contract.id,
    type: 'fund',
    amount: contract.agreed_amount,
    currency: contract.currency,
    idempotencyKey,
    providerReference: null,
    status: 'pending',
    rawPayload: { stage: 'initiated' },
  });

  const response = await atClient.requestStkPush({
    phoneNumber: clientPhone,
    amount: contract.agreed_amount,
    metadata: {
      contractId: contract.id,
      txId: tx.id,
      idempotencyKey,
    },
  });

  const providerReference =
    response?.data?.checkoutRequestID ||
    response?.providerRef ||
    response?.transactionId ||
    uuidv4();

  await repo.insertEscrowTx({
    contractId: contract.id,
    type: 'fund',
    amount: contract.agreed_amount,
    currency: contract.currency,
    idempotencyKey,
    providerReference,
    status: 'pending',
    rawPayload: response,
  });

  return { providerReference, response };
}

async function handleFundingWebhook(payload) {
  const providerReference =
    payload?.checkoutRequestID ||
    payload?.providerRef ||
    payload?.transactionId ||
    payload?.requestId;

  if (!providerReference) {
    return { ok: false, reason: 'missing provider reference' };
  }

  const status = mapProviderStatus(payload);
  const tx = await repo.markEscrowTxResult({
    providerReference,
    status,
    payload,
  });

  if (!tx) return { ok: false, reason: 'transaction not found' };

  if (status === 'success') {
    const contract = await repo.setContractStatus(tx.contract_id, 'in_progress');
    await repo.setJobStatusByJobId(contract.job_id, 'in_progress');
  }

  return { ok: true, tx, status };
}

function mapProviderStatus(payload) {
  const raw = String(
    payload?.status ||
      payload?.ResultCode ||
      payload?.providerStatus ||
      payload?.transactionStatus ||
      '',
  ).toLowerCase();

  if (raw.includes('success') || raw === '0' || raw === 'completed') return 'success';
  if (raw.includes('pending')) return 'pending';
  return 'failed';
}

module.exports = {
  initiateFunding,
  handleFundingWebhook,
};
