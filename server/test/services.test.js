const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHistory, normalizePlanPayload } = require('../src/services/AiService');
const { PdfService, stripMarkdown, parsePlanContent, planSections } = require('../src/services/PdfService');
const { planFixture } = require('./fixtures/planFixture');

test('normalizeHistory combina roles consecutivos y comienza con usuario', () => {
  const result = normalizeHistory([
    { role: 'assistant', content: 'Hola' },
    { role: 'user', content: 'Necesito fuerza' },
    { role: 'user', content: 'Tres días' },
    { role: 'assistant', content: 'Perfecto' },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].role, 'user');
  assert.match(result[0].parts[0].text, /Tres días/);
});

test('stripMarkdown genera texto legible para PDF', () => {
  assert.equal(stripMarkdown('## **Día 1**'), 'Día 1');
  assert.equal(stripMarkdown('- Sentadilla'), '• Sentadilla');
});

test('el PDF distingue entrenamiento, nutrición e integral', () => {
  assert.deepEqual(planSections('Plan de entrenamiento'), { training: true, nutrition: false });
  assert.deepEqual(planSections('Plan de nutrición'), { training: false, nutrition: true });
  assert.deepEqual(planSections('Plan integral'), { training: true, nutrition: true });
  assert.equal(parsePlanContent(JSON.stringify(planFixture)).version, 2);
});

test('el Coach conserva ejercicios canónicos del Atlas', () => {
  const catalog = [{ id: '0001', name: 'barbell bench press', target: 'pectorals', equipment: 'barbell', bodyPart: 'chest' }];
  const normalized = normalizePlanPayload({ ...planFixture, training: { ...planFixture.training, sessions: [{ ...planFixture.training.sessions[0], exercises: [{ exerciseId: '0001', name: 'nombre inventado', sets: '4', reps: '8', rest: '90 s' }] }] } }, catalog, ['0001']);
  assert.equal(normalized.training.sessions[0].exercises[0].name, 'barbell bench press');
  assert.equal(normalized.training.sessions[0].exercises[0].exerciseId, '0001');
});

test('el motor genera un PDF estructurado', async () => {
  const buffer = await new PdfService().createPlan({ memberName: 'Atleta de prueba', planType: 'Plan integral', planContent: JSON.stringify(planFixture) });
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 5_000);
});
