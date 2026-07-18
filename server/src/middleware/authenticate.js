const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { AppError } = require('../core/AppError');

const authenticate = (request, _response, next) => {
  const header = request.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new AppError(401, 'La sesión es obligatoria'));

  try {
    request.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch (_error) {
    next(new AppError(401, 'La sesión venció o no es válida'));
  }
};

module.exports = { authenticate };
