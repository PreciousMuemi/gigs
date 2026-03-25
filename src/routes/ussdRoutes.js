const express = require('express');
const { handleUssd } = require('../services/ussdStateMachine');

const router = express.Router();

router.post('/callback', async (req, res, next) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    const responseText = await handleUssd({ sessionId, phoneNumber, text });
    res.set('Content-Type', 'text/plain');
    return res.send(responseText);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
