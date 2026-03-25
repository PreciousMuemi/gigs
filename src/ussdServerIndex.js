/**
 * Entry point for minimal USSD server
 * Usage: npm run dev:ussd
 */

const ussdServer = require('./ussdServer');
const env = require('./config/env');

const PORT = env.port || 3000;

ussdServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ USSD server listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`✓ POST /ussd - USSD handler`);
  // eslint-disable-next-line no-console
  console.log(`✓ GET /health - Health check`);
  // eslint-disable-next-line no-console
  console.log(`✓ GET /api/stats - Admin stats`);
});
