const express = require('express');
const { handleUssd } = require('../services/ussdStateMachine');

const router = express.Router();

async function ussdHandler(req, res, next) {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    const responseText = await handleUssd({ sessionId, phoneNumber, text: text || '' });
    res.set('Content-Type', 'text/plain');
    return res.send(responseText);
  } catch (error) {
    return next(error);
  }
}

// Africa's Talking can be configured with either /ussd or /ussd/callback
router.post('/', ussdHandler);
router.post('/callback', ussdHandler);

module.exports = router;
