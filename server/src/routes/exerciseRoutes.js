const express = require('express');
const { asyncHandler } = require('../core/asyncHandler');

const createExerciseRoutes = (catalog) => {
  const router = express.Router();
  router.get('/meta', (_request, response) => response.json(catalog.getMeta()));
  router.get('/', (request, response) => response.json(catalog.search(request.query)));
  router.get('/:id', asyncHandler(async (request, response) => {
    response.json(catalog.getById(request.params.id));
  }));
  return router;
};

module.exports = { createExerciseRoutes };
