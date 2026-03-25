const express = require('express');
const repo = require('../repositories/platformRepository');
const contracts = require('../services/contractService');

const router = express.Router();

router.get('/jobs/open', async (req, res, next) => {
  try {
    const jobs = await repo.listOpenJobs(50);
    res.json({ data: jobs });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId/applications', async (req, res, next) => {
  try {
    const apps = await repo.listApplicationsForJob(req.params.jobId);
    res.json({ data: apps });
  } catch (error) {
    next(error);
  }
});

router.post('/jobs/:jobId/accept', async (req, res, next) => {
  try {
    const { freelancerId } = req.body;
    const result = await contracts.acceptApplicationAndRequestEscrow({
      jobId: req.params.jobId,
      freelancerId,
    });

    res.status(201).json({
      message: 'Contract created and STK push initiated',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/contracts/:contractId/complete', async (req, res, next) => {
  try {
    const contract = await contracts.markWorkSubmitted(req.params.contractId);
    res.json({ message: 'Work submitted', data: contract });
  } catch (error) {
    next(error);
  }
});

router.post('/contracts/:contractId/confirm', async (req, res, next) => {
  try {
    const contract = await contracts.confirmAndRelease(req.params.contractId);
    res.json({ message: 'Escrow released', data: contract });
  } catch (error) {
    next(error);
  }
});

router.post('/contracts/:contractId/rate', async (req, res, next) => {
  try {
    const { fromUserId, toUserId, score, comment } = req.body;
    const rating = await repo.createRating({
      contractId: req.params.contractId,
      fromUserId,
      toUserId,
      score,
      comment,
    });

    res.status(201).json({ message: 'Rating submitted', data: rating });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
