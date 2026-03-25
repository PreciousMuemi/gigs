/**
 * SMS Examples for Africa's Talking
 *
 * Two key use cases:
 * 1. Notify freelancer when client posts a job matching their skills
 * 2. Send client the contact details of a freelancer they selected
 *
 * Usage: node src/scripts/smsExamples.js
 */

const notify = require('../services/notificationService');

// ============================================================================
// USE CASE 1: Notify Freelancer of Job Request
// ============================================================================

async function notifyFreelancerOfJob({ freelancerPhone, jobTitle, clientName, budget }) {
  const message = `New job alert! ${clientName} posted "${jobTitle}" for KES ${budget}. Reply to apply or dial *123# to browse jobs.`;

  try {
    await notify.sendSms(freelancerPhone, message);
    // eslint-disable-next-line no-console
    console.log(`✓ SMS sent to freelancer ${freelancerPhone}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`✗ Failed to notify freelancer:`, error.message);
  }
}

// ============================================================================
// USE CASE 2: Send Client Freelancer Contact Details
// ============================================================================

async function sendFreelancerContactToClient({ clientPhone, freelancerName, freelancerPhone, freelancerSkill, freelancerRating }) {
  const message = `Freelancer matched: ${freelancerName} (${freelancerSkill}). Rating: ${freelancerRating}/5. Contact: ${freelancerPhone}. Dial *123# to hire.`;

  try {
    await notify.sendSms(clientPhone, message);
    // eslint-disable-next-line no-console
    console.log(`✓ SMS sent to client ${clientPhone}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`✗ Failed to send freelancer details:`, error.message);
  }
}

// ============================================================================
// Bonus: Send Payment Notification
// ============================================================================

async function notifyPaymentReceived({ freelancerPhone, amount, jobRef }) {
  const message = `Payment received! KES ${amount} for job ${jobRef}. Check M-Pesa for details.`;

  try {
    await notify.sendSms(freelancerPhone, message);
    // eslint-disable-next-line no-console
    console.log(`✓ Payment SMS sent to ${freelancerPhone}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`✗ Failed to send payment SMS:`, error.message);
  }
}

// ============================================================================
// DEMO / TEST
// ============================================================================

async function demo() {
  // eslint-disable-next-line no-console
  console.log('=== SMS Examples ===\n');

  // Example 1: Notify freelancer
  // eslint-disable-next-line no-console
  console.log('Example 1: Notify Freelancer');
  await notifyFreelancerOfJob({
    freelancerPhone: '+254712345678',
    jobTitle: 'Fix kitchen sink',
    clientName: 'Jane Doe',
    budget: 3500,
  });

  // eslint-disable-next-line no-console
  console.log('\nExample 2: Send Freelancer Contact to Client');
  await sendFreelancerContactToClient({
    clientPhone: '+254787654321',
    freelancerName: 'John Kariuki',
    freelancerPhone: '+254712345678',
    freelancerSkill: 'Plumbing',
    freelancerRating: 4.8,
  });

  // eslint-disable-next-line no-console
  console.log('\nExample 3: Payment Notification');
  await notifyPaymentReceived({
    freelancerPhone: '+254712345678',
    amount: 3500,
    jobRef: 'JOB-001',
  });
}

// Export for use in other services
module.exports = {
  notifyFreelancerOfJob,
  sendFreelancerContactToClient,
  notifyPaymentReceived,
};

// Run demo if called directly
if (require.main === module) {
  demo();
}
