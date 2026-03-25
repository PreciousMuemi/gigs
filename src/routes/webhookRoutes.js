const express = require('express');
const paymentEscrow = require('../services/paymentEscrowService');
const repo = require('../repositories/platformRepository');
const notify = require('../services/notificationService');

const router = express.Router();

router.post('/payments', async (req, res, next) => {
  try {
    const outcome = await paymentEscrow.handleFundingWebhook(req.body);

    if (outcome.ok && outcome.status === 'success') {
      const contract = await repo.getContractParties(outcome.tx.contract_id);
      if (contract) {
        try {
          await notify.sendSms(contract.client_phone, `Escrow funded successfully for contract ${contract.id.slice(0, 8)}.`);
          await notify.sendSms(contract.freelancer_phone, `Escrow funded. You can start work for contract ${contract.id.slice(0, 8)}.`);
        } catch (_) {
          // no-op
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/sms', async (req, res, next) => {
  try {
    await repo.writeAudit({
      actorType: 'system',
      actorId: 'sms-webhook',
      action: 'sms.delivery_report',
      payload: req.body,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
