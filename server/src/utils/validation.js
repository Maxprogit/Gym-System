const { AppError } = require('../core/AppError');

const PAYMENT_METHODS = Object.freeze(['Efectivo', 'Tarjeta', 'Transferencia']);

const requiredText = (value, field, { min = 1, max = 200 } = {}) => {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (clean.length < min || clean.length > max) {
    throw new AppError(400, `${field} debe tener entre ${min} y ${max} caracteres`);
  }
  return clean;
};

const positiveInteger = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `${field} debe ser un entero positivo`);
  }
  return parsed;
};

const normalizePhone = (value, countryCode = '521') => {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = `${countryCode}${digits}`;
  if (digits.length < 11 || digits.length > 15) {
    throw new AppError(400, 'El teléfono debe incluir lada y tener entre 11 y 15 dígitos');
  }
  return digits;
};

const paymentMethod = (value) => {
  const method = requiredText(value || 'Efectivo', 'Método de pago', { max: 30 });
  if (!PAYMENT_METHODS.includes(method)) {
    throw new AppError(400, 'El método de pago no es válido');
  }
  return method;
};

const loginPayload = (body) => ({
  username: requiredText(body.username, 'Usuario', { min: 3, max: 100 }),
  password: requiredText(body.password, 'Contraseña', { min: 1, max: 128 }),
});

module.exports = {
  PAYMENT_METHODS,
  requiredText,
  positiveInteger,
  normalizePhone,
  paymentMethod,
  loginPayload,
};
