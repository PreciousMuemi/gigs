const pool = require('../db/pool');

async function getUserByPhone(phone) {
  const { rows } = await pool.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);
  return rows[0] || null;
}

async function upsertUserByPhone({ phone, fullName, role = 'freelancer', region = null }) {
  const query = `
    INSERT INTO users (phone, full_name, role, region)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (phone)
    DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, users.full_name),
      role = COALESCE(EXCLUDED.role, users.role),
      region = COALESCE(EXCLUDED.region, users.region),
      updated_at = NOW()
    RETURNING *
  `;
  const { rows } = await pool.query(query, [phone, fullName, role, region]);
  return rows[0];
}

async function getOrCreateSkill(skillName) {
  const normalized = String(skillName || '').trim().toLowerCase();
  const { rows } = await pool.query(
    `INSERT INTO skills (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [normalized],
  );
  return rows[0];
}

async function upsertUserSkillByName({ userId, skillName, level = 'intermediate' }) {
  const skill = await getOrCreateSkill(skillName);
  const { rows } = await pool.query(
    `INSERT INTO user_skills (user_id, skill_id, level)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET level = EXCLUDED.level
     RETURNING *`,
    [userId, skill.id, level],
  );
  return rows[0];
}

async function findFreelancersBySkill(skillName, limit = 3) {
  const normalized = String(skillName || '').trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT
      u.id,
      u.full_name,
      u.phone,
      s.name AS skill,
      COALESCE(AVG(r.score), 0)::numeric(3,2) AS avg_rating
     FROM users u
     JOIN user_skills us ON us.user_id = u.id
     JOIN skills s ON s.id = us.skill_id
     LEFT JOIN ratings r ON r.to_user_id = u.id
     WHERE (u.role = 'freelancer' OR u.role = 'both')
       AND s.name LIKE $1
     GROUP BY u.id, u.full_name, u.phone, s.name
     ORDER BY avg_rating DESC, u.created_at DESC
     LIMIT $2`,
    [`%${normalized}%`, limit],
  );
  return rows;
}

async function createJob({ clientId, title, description = null, budget, currency = 'KES' }) {
  const { rows } = await pool.query(
    `INSERT INTO jobs (client_id, title, description, budget, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'open')
     RETURNING *`,
    [clientId, title, description, budget, currency],
  );
  return rows[0];
}

async function listOpenJobs(limit = 10) {
  const { rows } = await pool.query(
    `SELECT j.*, u.full_name AS client_name, u.phone AS client_phone
     FROM jobs j
     JOIN users u ON u.id = j.client_id
     WHERE j.status = 'open'
     ORDER BY j.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

async function getJobById(jobId) {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
  return rows[0] || null;
}

async function createApplication({ jobId, freelancerId, bidAmount, coverNote = null }) {
  const { rows } = await pool.query(
    `INSERT INTO job_applications (job_id, freelancer_id, bid_amount, cover_note, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (job_id, freelancer_id) DO UPDATE SET
      bid_amount = EXCLUDED.bid_amount,
      cover_note = EXCLUDED.cover_note
     RETURNING *`,
    [jobId, freelancerId, bidAmount, coverNote],
  );
  return rows[0];
}

async function listApplicationsForJob(jobId) {
  const { rows } = await pool.query(
    `SELECT ja.*, u.full_name, u.phone
     FROM job_applications ja
     JOIN users u ON u.id = ja.freelancer_id
     WHERE ja.job_id = $1
     ORDER BY ja.created_at ASC`,
    [jobId],
  );
  return rows;
}

async function createContractFromApplication({ jobId, clientId, freelancerId, agreedAmount, currency = 'KES' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const contractRes = await client.query(
      `INSERT INTO contracts (job_id, client_id, freelancer_id, agreed_amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'awaiting_escrow')
       ON CONFLICT (job_id) DO UPDATE SET
        freelancer_id = EXCLUDED.freelancer_id,
        agreed_amount = EXCLUDED.agreed_amount,
        currency = EXCLUDED.currency,
        updated_at = NOW()
       RETURNING *`,
      [jobId, clientId, freelancerId, agreedAmount, currency],
    );

    await client.query(
      `UPDATE jobs SET status = 'awaiting_escrow', updated_at = NOW() WHERE id = $1`,
      [jobId],
    );

    await client.query(
      `UPDATE job_applications
       SET status = CASE WHEN freelancer_id = $2 THEN 'accepted' ELSE 'rejected' END
       WHERE job_id = $1`,
      [jobId, freelancerId],
    );

    await client.query('COMMIT');
    return contractRes.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getContractById(contractId) {
  const { rows } = await pool.query('SELECT * FROM contracts WHERE id = $1 LIMIT 1', [contractId]);
  return rows[0] || null;
}

async function insertEscrowTx({ contractId, type, amount, currency, idempotencyKey, providerReference, status = 'pending', rawPayload = null }) {
  const { rows } = await pool.query(
    `INSERT INTO escrow_transactions (contract_id, type, amount, currency, idempotency_key, provider_reference, status, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (idempotency_key) DO UPDATE SET
      provider_reference = COALESCE(EXCLUDED.provider_reference, escrow_transactions.provider_reference),
      status = EXCLUDED.status,
      raw_payload = COALESCE(EXCLUDED.raw_payload, escrow_transactions.raw_payload),
      updated_at = NOW()
     RETURNING *`,
    [contractId, type, amount, currency, idempotencyKey, providerReference, status, rawPayload],
  );
  return rows[0];
}

async function markEscrowTxResult({ providerReference, status, payload }) {
  const { rows } = await pool.query(
    `UPDATE escrow_transactions
     SET status = $2,
         raw_payload = COALESCE($3, raw_payload),
         updated_at = NOW()
     WHERE provider_reference = $1
     RETURNING *`,
    [providerReference, status, payload],
  );
  return rows[0] || null;
}

async function setContractStatus(contractId, status) {
  const { rows } = await pool.query(
    `UPDATE contracts SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [contractId, status],
  );
  return rows[0] || null;
}

async function setJobStatusByJobId(jobId, status) {
  const { rows } = await pool.query(
    `UPDATE jobs SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [jobId, status],
  );
  return rows[0] || null;
}

async function upsertSession({ sessionId, phone, state, context, ttlMinutes = 5 }) {
  const { rows } = await pool.query(
    `INSERT INTO ussd_sessions (session_id, phone, state, context_json, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW() + ($5 || ' minutes')::interval)
     ON CONFLICT (session_id) DO UPDATE SET
      phone = EXCLUDED.phone,
      state = EXCLUDED.state,
      context_json = EXCLUDED.context_json,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
     RETURNING *`,
    [sessionId, phone, state, JSON.stringify(context || {}), String(ttlMinutes)],
  );
  return rows[0];
}

async function getSession(sessionId) {
  const { rows } = await pool.query(
    `SELECT * FROM ussd_sessions WHERE session_id = $1 AND expires_at > NOW() LIMIT 1`,
    [sessionId],
  );
  return rows[0] || null;
}

async function deleteSession(sessionId) {
  await pool.query('DELETE FROM ussd_sessions WHERE session_id = $1', [sessionId]);
}

async function createRating({ contractId, fromUserId, toUserId, score, comment }) {
  const { rows } = await pool.query(
    `INSERT INTO ratings (contract_id, from_user_id, to_user_id, score, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (contract_id, from_user_id, to_user_id) DO UPDATE SET
      score = EXCLUDED.score,
      comment = EXCLUDED.comment
     RETURNING *`,
    [contractId, fromUserId, toUserId, score, comment],
  );
  return rows[0];
}

async function createRatingByPhones({ fromPhone, toPhone, score, comment = null }) {
  const fromUser = await getUserByPhone(fromPhone);
  const toUser = await getUserByPhone(toPhone);

  if (!fromUser || !toUser) {
    const err = new Error('User not found for rating');
    err.status = 404;
    throw err;
  }

  const contractRes = await pool.query(
    `SELECT id
     FROM contracts
     WHERE client_id = $1 AND freelancer_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [fromUser.id, toUser.id],
  );

  if (!contractRes.rows.length) {
    const err = new Error('No contract found between client and freelancer');
    err.status = 400;
    throw err;
  }

  return createRating({
    contractId: contractRes.rows[0].id,
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    score,
    comment,
  });
}

async function getContractParties(contractId) {
  const { rows } = await pool.query(
    `SELECT c.*, cu.phone AS client_phone, cu.full_name AS client_name,
            fu.phone AS freelancer_phone, fu.full_name AS freelancer_name
     FROM contracts c
     JOIN users cu ON cu.id = c.client_id
     JOIN users fu ON fu.id = c.freelancer_id
     WHERE c.id = $1 LIMIT 1`,
    [contractId],
  );
  return rows[0] || null;
}

async function logSms({ phone, message, status = 'queued', providerMessageId = null, rawPayload = null }) {
  const { rows } = await pool.query(
    `INSERT INTO sms_logs (phone, message, status, provider_message_id, raw_payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [phone, message, status, providerMessageId, rawPayload],
  );
  return rows[0];
}

async function writeAudit({ actorType, actorId, action, payload }) {
  await pool.query(
    `INSERT INTO audit_logs (actor_type, actor_id, action, payload)
     VALUES ($1, $2, $3, $4)`,
    [actorType, actorId, action, payload || null],
  );
}

module.exports = {
  getUserByPhone,
  upsertUserByPhone,
  getOrCreateSkill,
  upsertUserSkillByName,
  findFreelancersBySkill,
  createJob,
  listOpenJobs,
  getJobById,
  createApplication,
  listApplicationsForJob,
  createContractFromApplication,
  getContractById,
  insertEscrowTx,
  markEscrowTxResult,
  setContractStatus,
  setJobStatusByJobId,
  upsertSession,
  getSession,
  deleteSession,
  createRating,
  createRatingByPhones,
  getContractParties,
  logSms,
  writeAudit,
};
