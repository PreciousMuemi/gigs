const repo = require('../repositories/platformRepository');
const env = require('../config/env');
const atClient = require('./africasTalkingClient');

async function sendSms(phone, message) {
  try {
    const response = await atClient.sendSms({
      to: phone,
      message,
      from: env.atSmsSenderId,
    });

    const messageId =
      response?.SMSMessageData?.Recipients?.[0]?.messageId ||
      response?.SMSMessageData?.Recipients?.[0]?.messageid ||
      null;

    await repo.logSms({
      phone,
      message,
      status: 'sent',
      providerMessageId: messageId,
      rawPayload: response,
    });

    return response;
  } catch (error) {
    await repo.logSms({
      phone,
      message,
      status: 'failed',
      rawPayload: {
        error: error.response?.data || error.message,
      },
    });
    throw error;
  }
}

module.exports = {
  sendSms,
};
