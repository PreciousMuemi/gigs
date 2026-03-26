/**
 * Minimal USSD Server for KaziLink
 * Handles Africa's Talking USSD requests
 *
 * POST /ussd
 * Body: { sessionId, phoneNumber, text }
 * Response: CON ... or END ...
 */

const express = require('express');
const path = require('path');
const { handleUssd } = require('./services/ussdStateMachine');
const repo = require('./repositories/platformRepository');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ussd-server' });
});

/**
 * USSD handler
 * Africa's Talking sends: { sessionId, phoneNumber, text }
 * We return plain text: CON ... or END ...
 */
app.post('/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;

    if (!sessionId || !phoneNumber) {
      return res.status(400).json({ error: 'Missing sessionId or phoneNumber' });
    }

    // Call state machine
    const response = await handleUssd({ sessionId, phoneNumber, text: text || '' });

    // Africa's Talking expects plain text response
    res.set('Content-Type', 'text/plain');
    res.send(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('USSD error:', error);
    res.set('Content-Type', 'text/plain');
    res.send('END Service error. Please try again.');
  }
});

/**
 * Optional: Simple admin API to view/test data
 */
app.get('/api/stats', async (req, res) => {
  try {
    const jobs = await repo.listOpenJobs(100);
    res.json({
      totalOpenJobs: jobs.length,
      jobs: jobs.slice(0, 5), // first 5
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
