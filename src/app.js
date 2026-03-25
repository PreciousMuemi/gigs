const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const ussdRoutes = require('./routes/ussdRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ussd-freelance-platform' });
});

app.use('/ussd', ussdRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
    },
  });
});

module.exports = app;
