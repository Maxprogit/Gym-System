const express = require('express');
const { asyncHandler } = require('../core/asyncHandler');
const { loginPayload } = require('../utils/validation');

const createAuthRoutes = (authService) => {
  const router = express.Router();

  router.post('/login', asyncHandler(async (request, response) => {
    const result = await authService.login(loginPayload(request.body));
    response.json({ success: true, ...result });
  }));

  router.post('/admin/bootstrap', asyncHandler(async (request, response) => {
    const credentials = loginPayload(request.body);
    await authService.bootstrapAdmin({
      ...credentials,
      setupKey: String(request.body.setupKey || request.get('x-setup-key') || ''),
    });
    response.status(201).json({ success: true });
  }));

  return router;
};

module.exports = { createAuthRoutes };
