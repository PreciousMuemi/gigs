/**
 * Rating System Demo for USSD
 *
 * Simulates a complete 1-5 star rating flow:
 * 1. Freelancer completes job
 * 2. Client rates freelancer (1-5)
 * 3. Freelancer rates client
 * 4. Ratings calculated and stored
 *
 * Usage: npm run test:ratings
 */

const repo = require('../repositories/platformRepository');
const ratingService = require('../services/ratingService');
const notify = require('../services/notificationService');

// ============================================================================
// USSD Rating Flow Simulation
// ============================================================================

/**
 * Simulate USSD: Client rates freelancer (1-5)
 * Flow:
 *   Screen 1: "How many stars? (1-5):"
 *   Screen 2: "Any comments? (optional):"
 *   Screen 3: "END Rating submitted. Thank you!"
 */
async function ussdClientRateFreelancer({ clientPhone, contractId, score, comment = null }) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be 1-5');
  }

  try {
    const contract = await repo.getContractParties(contractId);
    if (!contract) throw new Error('Contract not found');

    // Create rating
    const rating = await repo.createRating({
      contractId,
      fromUserId: contract.client_id,
      toUserId: contract.freelancer_id,
      score,
      comment,
    });

    // Get updated average
    const avgRating = await ratingService.getAverageRating(contract.freelancer_id);

    // Notify freelancer
    try {
      await notify.sendSms(
        contract.freelancer_phone,
        `You received a ${score}-star rating from a client. Your avg rating: ${avgRating.avgScore.toFixed(1)}/5.`,
      );
    } catch (_) {
      // ignore
    }

    return {
      ok: true,
      rating: {
        id: rating.id,
        score,
        freelancerAvgRating: avgRating.avgScore,
        totalRatings: avgRating.totalRatings,
      },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Simulate USSD: Freelancer rates client
 */
async function ussdFreelancerRateClient({ freelancerPhone, contractId, score, comment = null }) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be 1-5');
  }

  try {
    const contract = await repo.getContractParties(contractId);
    if (!contract) throw new Error('Contract not found');

    const rating = await repo.createRating({
      contractId,
      fromUserId: contract.freelancer_id,
      toUserId: contract.client_id,
      score,
      comment,
    });

    const avgRating = await ratingService.getAverageRating(contract.client_id);

    try {
      await notify.sendSms(
        contract.client_phone,
        `Freelancer rated you ${score} stars. Your avg: ${avgRating.avgScore.toFixed(1)}/5.`,
      );
    } catch (_) {
      // ignore
    }

    return {
      ok: true,
      rating: {
        id: rating.id,
        score,
        clientAvgRating: avgRating.avgScore,
        totalRatings: avgRating.totalRatings,
      },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ============================================================================
// Display Rating (for client/freelancer profile)
// ============================================================================

function formatRatingDisplay(avgRating, totalRatings) {
  if (totalRatings === 0) return 'No ratings yet';

  const stars = '⭐'.repeat(Math.round(avgRating));
  return `${stars} ${avgRating.toFixed(1)}/5 (${totalRatings} ratings)`;
}

// ============================================================================
// Demo: Full Rating Workflow
// ============================================================================

async function runRatingDemo() {
  // eslint-disable-next-line no-console
  console.log('=== USSD Rating System Demo ===\n');

  try {
    // Mock data (in real scenario, these come from a completed contract)
    const contractId = '550e8400-e29b-41d4-a716-446655440000'; // placeholder
    const clientPhone = '+254787654321';
    const freelancerPhone = '+254712345678';

    // eslint-disable-next-line no-console
    console.log('📱 USSD Flow: Client rates freelancer\n');

    // eslint-disable-next-line no-console
    console.log('Screen 1: "How many stars? (1-5):"');
    // eslint-disable-next-line no-console
    console.log('Client enters: 5\n');

    // eslint-disable-next-line no-console
    console.log('Screen 2: "Any comments? (optional):"');
    // eslint-disable-next-line no-console
    console.log('Client enters: Great job!\n');

    // eslint-disable-next-line no-console
    console.log('Screen 3: Processing...\n');

    const clientRating = await ussdClientRateFreelancer({
      clientPhone,
      contractId,
      score: 5,
      comment: 'Great job, very professional!',
    });

    if (clientRating.ok) {
      // eslint-disable-next-line no-console
      console.log(`✓ Client rating saved: ${clientRating.rating.score} stars`);
      // eslint-disable-next-line no-console
      console.log(`✓ Freelancer average: ${clientRating.rating.freelancerAvgRating.toFixed(1)}/5\n`);
    }

    // Now freelancer rates client
    // eslint-disable-next-line no-console
    console.log('📱 USSD Flow: Freelancer rates client\n');

    // eslint-disable-next-line no-console
    console.log('Screen 1: "How many stars? (1-5):"');
    // eslint-disable-next-line no-console
    console.log('Freelancer enters: 4\n');

    // eslint-disable-next-line no-console
    console.log('Screen 2: Processing...\n');

    const freelancerRating = await ussdFreelancerRateClient({
      freelancerPhone,
      contractId,
      score: 4,
      comment: 'Good communication, paid on time',
    });

    if (freelancerRating.ok) {
      // eslint-disable-next-line no-console
      console.log(`✓ Freelancer rating saved: ${freelancerRating.rating.score} stars`);
      // eslint-disable-next-line no-console
      console.log(`✓ Client average: ${freelancerRating.rating.clientAvgRating.toFixed(1)}/5\n`);
    }

    // Display ratings nicely
    // eslint-disable-next-line no-console
    console.log('=== Rating Display ===\n');

    const freelancerAvg = clientRating.ok ? clientRating.rating.freelancerAvgRating : 0;
    const freelancerTotal = clientRating.ok ? clientRating.rating.totalRatings : 0;
    const clientAvg = freelancerRating.ok ? freelancerRating.rating.clientAvgRating : 0;
    const clientTotal = freelancerRating.ok ? freelancerRating.rating.totalRatings : 0;

    // eslint-disable-next-line no-console
    console.log(`Freelancer profile: ${formatRatingDisplay(freelancerAvg, freelancerTotal)}`);
    // eslint-disable-next-line no-console
    console.log(`Client profile: ${formatRatingDisplay(clientAvg, clientTotal)}\n`);

    // eslint-disable-next-line no-console
    console.log('✓ Demo complete! Ratings stored and displayed.\n');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Demo error:', error.message);
  }
}

module.exports = {
  ussdClientRateFreelancer,
  ussdFreelancerRateClient,
  formatRatingDisplay,
  runRatingDemo,
};

// Run demo if called directly
if (require.main === module) {
  runRatingDemo();
}
