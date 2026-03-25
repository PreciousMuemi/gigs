/**
 * Rating Service
 * Calculate and manage freelancer ratings
 */

const repo = require('../repositories/platformRepository');

/**
 * Get all ratings for a user (received)
 */
async function getUserRatings(userId) {
  const { rows } = await repo.pool.query(
    `SELECT r.*, fu.full_name AS from_user_name, tu.full_name AS to_user_name
     FROM ratings r
     JOIN users fu ON fu.id = r.from_user_id
     JOIN users tu ON tu.id = r.to_user_id
     WHERE r.to_user_id = $1
     ORDER BY r.created_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * Calculate average rating for a user
 */
async function getAverageRating(userId) {
  const { rows } = await repo.pool.query(
    `SELECT
      COUNT(*) as total_ratings,
      AVG(score)::numeric(3,2) as avg_score,
      MIN(score) as min_score,
      MAX(score) as max_score
     FROM ratings
     WHERE to_user_id = $1`,
    [userId],
  );

  const result = rows[0] || {};
  return {
    totalRatings: parseInt(result.total_ratings || 0, 10),
    avgScore: parseFloat(result.avg_score || 0),
    minScore: result.min_score || 0,
    maxScore: result.max_score || 0,
  };
}

/**
 * Get rating distribution (how many 5-star, 4-star, etc.)
 */
async function getRatingDistribution(userId) {
  const { rows } = await repo.pool.query(
    `SELECT score, COUNT(*) as count
     FROM ratings
     WHERE to_user_id = $1
     GROUP BY score
     ORDER BY score DESC`,
    [userId],
  );

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  rows.forEach((r) => {
    distribution[r.score] = parseInt(r.count, 10);
  });

  return distribution;
}

/**
 * Get recent ratings (last N)
 */
async function getRecentRatings(userId, limit = 5) {
  const { rows } = await repo.pool.query(
    `SELECT r.*, fu.full_name, fu.phone
     FROM ratings r
     JOIN users fu ON fu.id = r.from_user_id
     WHERE r.to_user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

/**
 * Get freelancer profile with rating
 */
async function getFreelancerProfile(userId) {
  const user = await repo.getUserByPhone(null); // get by ID instead
  const avgRating = await getAverageRating(userId);
  const distribution = await getRatingDistribution(userId);

  return {
    user,
    avgRating: avgRating.avgScore,
    totalRatings: avgRating.totalRatings,
    distribution,
  };
}

module.exports = {
  getUserRatings,
  getAverageRating,
  getRatingDistribution,
  getRecentRatings,
  getFreelancerProfile,
};
