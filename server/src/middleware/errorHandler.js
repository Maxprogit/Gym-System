const { AppError } = require('../core/AppError');

const notFound = (request, response) => {
  response.status(404).json({ error: `Ruta no encontrada: ${request.method} ${request.path}` });
};

const errorHandler = (error, request, response, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'Ocurrió un error interno';

  if (statusCode >= 500) {
    console.error(`[${request.method} ${request.path}]`, error);
  }

  response.status(statusCode).json({
    error: message,
    ...(error.details ? { details: error.details } : {}),
  });
};

module.exports = { notFound, errorHandler };
