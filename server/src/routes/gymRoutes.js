const express = require('express');
const { asyncHandler } = require('../core/asyncHandler');
const { env } = require('../config/env');
const {
  requiredText,
  positiveInteger,
  normalizePhone,
  paymentMethod,
} = require('../utils/validation');

const createGymRoutes = (repository) => {
  const router = express.Router();

  router.get('/plans', asyncHandler(async (_request, response) => {
    response.json(await repository.getPlans());
  }));

  router.get('/members', asyncHandler(async (_request, response) => {
    response.json(await repository.getMembers());
  }));

  router.post('/members', asyncHandler(async (request, response) => {
    const result = await repository.createMember({
      fullName: requiredText(request.body.fullName, 'Nombre', { min: 3, max: 200 }),
      phone: normalizePhone(request.body.phone, env.defaultCountryCode),
      planId: positiveInteger(request.body.planId, 'Plan'),
      method: paymentMethod(request.body.paymentMethod),
    });
    response.status(201).json({ success: true, ...result });
  }));

  router.put('/members/:id', asyncHandler(async (request, response) => {
    await repository.updateMember({
      memberId: positiveInteger(request.params.id, 'Atleta'),
      fullName: requiredText(request.body.fullName, 'Nombre', { min: 3, max: 200 }),
      phone: normalizePhone(request.body.phone, env.defaultCountryCode),
    });
    response.json({ success: true });
  }));

  router.delete('/members/:id', asyncHandler(async (request, response) => {
    await repository.archiveMember(positiveInteger(request.params.id, 'Atleta'));
    response.status(204).end();
  }));

  const renewMember = asyncHandler(async (request, response) => {
    const result = await repository.renewMember({
      memberId: positiveInteger(request.body.memberId, 'Atleta'),
      planId: positiveInteger(request.body.planId, 'Plan'),
      method: paymentMethod(request.body.paymentMethod),
    });
    response.status(201).json({ success: true, ...result });
  });

  router.post('/renewals', renewMember);
  router.post('/renew', renewMember);

  router.get('/payments', asyncHandler(async (_request, response) => {
    response.json(await repository.getPayments());
  }));

  router.get('/dashboard/stats', asyncHandler(async (_request, response) => {
    response.json(await repository.getDashboardStats());
  }));

  return router;
};

module.exports = { createGymRoutes };
