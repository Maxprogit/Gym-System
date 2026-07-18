const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../..');
const repositorySource = fs.readFileSync(
  path.join(projectRoot, 'server/src/repositories/GymRepository.js'),
  'utf8',
);
const whatsappServiceSource = fs.readFileSync(
  path.join(projectRoot, 'server/src/services/WhatsAppService.js'),
  'utf8',
);
const whatsappRoutesSource = fs.readFileSync(
  path.join(projectRoot, 'server/src/routes/whatsappRoutes.js'),
  'utf8',
);
const whatsappPageSource = fs.readFileSync(
  path.join(projectRoot, 'client/src/features/whatsapp/WhatsAppPage.tsx'),
  'utf8',
);

test('la entrega no contiene esquemas, migraciones ni archivos SQL', () => {
  assert.equal(fs.existsSync(path.join(projectRoot, 'database')), false);
  assert.equal(fs.readdirSync(projectRoot).some((file) => file.endsWith('.sql')), false);
});

test('las consultas respetan las columnas originales', () => {
  assert.doesNotMatch(repositorySource, /Plans[^\n]+IsActive|IsActive[^\n]+Plans/i);
  assert.doesNotMatch(repositorySource, /Payments\s*\([^)]*PlanID/i);
  assert.doesNotMatch(repositorySource, /pay\.PlanID/i);
  assert.doesNotMatch(repositorySource, /SubscriptionID/i);
});

test('archivar un atleta conserva su identidad, pagos e historial', () => {
  const archiveBlock = repositorySource.slice(
    repositorySource.indexOf('async archiveMember'),
    repositorySource.indexOf('async getPayments'),
  );
  assert.match(archiveBlock, /UPDATE Subscriptions SET IsActive = 0/);
  assert.doesNotMatch(archiveBlock, /DELETE FROM Payments/i);
  assert.doesNotMatch(archiveBlock, /DELETE FROM Members/i);
  assert.doesNotMatch(archiveBlock, /DELETE FROM AthletsPlans/i);
});

test('WhatsApp persiste la sesión sin recopilar dispositivo, IP ni ubicación', () => {
  assert.match(whatsappServiceSource, /new LocalAuth\(\{ dataPath:/);
  assert.doesNotMatch(whatsappServiceSource, /recordPanelContext|x-forwarded-for|remoteAddress|userAgent|latitude|longitude|\.runtime/);
  assert.doesNotMatch(whatsappRoutesSource, /session-context/);
  assert.doesNotMatch(whatsappPageSource, /geolocation|session-context|IP del panel|Registrar ubicación|Origen autorizado/);
});
