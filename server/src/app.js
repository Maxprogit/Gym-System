const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { isSqlServerReady } = require('./config/sqlServer');
const { authenticate } = require('./middleware/authenticate');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const dependencies = require('./dependencies');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createGymRoutes } = require('./routes/gymRoutes');
const { createExerciseRoutes } = require('./routes/exerciseRoutes');
const { createAiRoutes } = require('./routes/aiRoutes');
const { createWhatsAppRoutes } = require('./routes/whatsappRoutes');

const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/dataset', express.static(env.datasetRoot, { maxAge: '7d', immutable: true }));

  app.get('/api/healthz', (_request, response) => {
    response.json({ status: 'ok', sqlServer: isSqlServerReady() ? 'connected' : 'waiting_for_existing_env' });
  });

  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }));
  app.use('/api', createAuthRoutes(dependencies.authService));
  app.use('/api', authenticate);
  app.use('/api', createGymRoutes(dependencies.repository));
  app.use('/api/exercises', createExerciseRoutes(dependencies.exerciseCatalog));
  app.use('/api/ai', createAiRoutes(dependencies));
  app.use('/api/whatsapp', createWhatsAppRoutes(dependencies.whatsappService));

  app.use(notFound);
  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
