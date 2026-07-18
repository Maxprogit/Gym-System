const express = require('express');
const { asyncHandler } = require('../core/asyncHandler');
const { env } = require('../config/env');
const { positiveInteger, requiredText, normalizePhone } = require('../utils/validation');

const createAiRoutes = ({ aiService, repository, pdfService, whatsappService }) => {
  const router = express.Router();

  router.post('/generate', asyncHandler(async (request, response) => {
    const result = await aiService.generate({
      messages: request.body.messages,
      memberName: requiredText(request.body.memberName, 'Nombre', { min: 3, max: 200 }),
      memberId: positiveInteger(request.body.memberId, 'Atleta'),
      selectedExerciseIds: request.body.selectedExerciseIds,
    });
    response.json({ success: true, ...result });
  }));

  router.get('/plans/:memberId', asyncHandler(async (request, response) => {
    response.json(await repository.getPlanHistory(positiveInteger(request.params.memberId, 'Atleta'), 20));
  }));

  const savePlan = asyncHandler(async (request, response) => {
    await repository.savePlan({
      memberId: positiveInteger(request.body.memberId, 'Atleta'),
      planType: requiredText(request.body.planType, 'Tipo de plan', { min: 3, max: 50 }),
      planContent: requiredText(request.body.planContent, 'Contenido', { min: 20, max: 100000 }),
    });
    response.status(201).json({ success: true });
  });

  router.post('/plans', savePlan);
  router.post('/save-plan', savePlan);

  router.post('/send-whatsapp', asyncHandler(async (request, response) => {
    const memberName = requiredText(request.body.memberName, 'Nombre', { min: 3, max: 200 });
    const phone = normalizePhone(request.body.phone, env.defaultCountryCode);
    const plan = requiredText(request.body.plan || request.body.planContent, 'Plan', { min: 20, max: 100000 });
    await whatsappService.sendText(phone, `Plan de Entrenamiento\n\nHola *${memberName}*, aquí está tu plan:\n\n${plan}`);
    response.json({ success: true });
  }));

  const resolveMemberAndDocument = async (body) => {
    const memberId = Number(body.memberId);
    const member = Number.isInteger(memberId) && memberId > 0
      ? await repository.getMember(memberId)
      : {
        FullName: requiredText(body.memberName, 'Nombre', { min: 3, max: 200 }),
        Phone: body.phone ? normalizePhone(body.phone, env.defaultCountryCode) : null,
      };
    if (!member) return null;
    const planType = requiredText(body.planType, 'Tipo de plan', { max: 50 });
    const planContent = requiredText(body.planContent, 'Contenido', { min: 20, max: 100000 });
    const pdf = await pdfService.createPlan({ memberName: member.FullName, planType, planContent });
    const slug = planType.toLowerCase().includes('integral') ? 'integral' : planType.toLowerCase().includes('nutric') ? 'nutricion' : 'entrenamiento';
    return { member, memberId, planType, pdf, filename: `goliat-${slug}-${memberId || 'atleta'}.pdf` };
  };

  router.post('/plan-pdf', asyncHandler(async (request, response) => {
    const document = await resolveMemberAndDocument(request.body);
    if (!document) return response.status(404).json({ error: 'Atleta no encontrado' });
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    response.send(document.pdf);
  }));

  router.post('/send-plan-pdf', asyncHandler(async (request, response) => {
    const document = await resolveMemberAndDocument(request.body);
    if (!document) return response.status(404).json({ error: 'Atleta no encontrado' });
    await whatsappService.sendPdf(
      normalizePhone(document.member.Phone, env.defaultCountryCode),
      document.pdf,
      document.filename,
      `Hola ${document.member.FullName}, aquí tienes tu ${document.planType}.`,
    );
    response.json({ success: true });
  }));

  return router;
};

module.exports = { createAiRoutes };
