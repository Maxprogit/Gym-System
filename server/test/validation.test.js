const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, positiveInteger, paymentMethod } = require('../src/utils/validation');

test('normalizePhone agrega el código de México a números locales', () => {
  assert.equal(normalizePhone('464 123 45 67', '521'), '5214641234567');
});

test('normalizePhone conserva un número internacional válido', () => {
  assert.equal(normalizePhone('+52 464 123 4567', '52'), '524641234567');
});

test('positiveInteger rechaza identificadores decimales o negativos', () => {
  assert.throws(() => positiveInteger(-1, 'ID'));
  assert.throws(() => positiveInteger(1.5, 'ID'));
  assert.equal(positiveInteger('7', 'ID'), 7);
});

test('paymentMethod limita los valores permitidos', () => {
  assert.equal(paymentMethod('Tarjeta'), 'Tarjeta');
  assert.throws(() => paymentMethod('Criptomoneda'));
});
