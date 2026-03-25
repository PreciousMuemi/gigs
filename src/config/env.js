const dotenv = require('dotenv');

dotenv.config();

const required = ['DATABASE_URL', 'AT_USERNAME', 'AT_API_KEY', 'AT_PRODUCT_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    // allow boot for local development but warn loudly
    // eslint-disable-next-line no-console
    console.warn(`[WARN] Missing env var: ${key}`);
  }
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  atUsername: process.env.AT_USERNAME,
  atApiKey: process.env.AT_API_KEY,
  atProductName: process.env.AT_PRODUCT_NAME,
  atSmsSenderId: process.env.AT_SMS_SENDER_ID || undefined,
  paymentCallbackUrl: process.env.PAYMENT_CALLBACK_URL,
  smsDeliveryCallbackUrl: process.env.SMS_DELIVERY_CALLBACK_URL,
  platformCurrency: process.env.PLATFORM_CURRENCY || 'KES',
  escrowFeePercent: Number(process.env.ESCROW_FEE_PERCENT || 5),
};
