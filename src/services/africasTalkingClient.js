const axios = require('axios');
const env = require('../config/env');

const atApi = axios.create({
  baseURL: 'https://api.africastalking.com',
  timeout: 20000,
  headers: {
    apiKey: env.atApiKey,
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

function toForm(payload) {
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    body.append(k, String(v));
  });
  return body;
}

async function sendSms({ to, message, from }) {
  const payload = toForm({
    username: env.atUsername,
    to,
    message,
    from,
    bulkSMSMode: 1,
    enqueue: 1,
  });

  const response = await atApi.post('/version1/messaging', payload);
  return response.data;
}

async function requestStkPush({ phoneNumber, amount, metadata = {} }) {
  const payload = toForm({
    username: env.atUsername,
    productName: env.atProductName,
    phoneNumber,
    currencyCode: env.platformCurrency,
    amount,
    metadata: JSON.stringify(metadata),
    callbackUrl: env.paymentCallbackUrl,
  });

  const response = await atApi.post('/mobile/checkout/request', payload);
  return response.data;
}

module.exports = {
  sendSms,
  requestStkPush,
};
