const express = require('express');
const { asyncHandler } = require('../core/asyncHandler');

const createWhatsAppRoutes = (service) => {
  const router = express.Router();
  router.get('/status', (_request, response) => response.json(service.getState()));
  router.post('/initialize', asyncHandler(async (_request, response) => {
    service.initialize();
    response.status(202).json(service.getState());
  }));
  router.post('/logout', asyncHandler(async (_request, response) => {
    await service.logout();
    response.json({ success: true });
  }));
  return router;
};

module.exports = { createWhatsAppRoutes };
