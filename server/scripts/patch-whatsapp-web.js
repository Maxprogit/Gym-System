// Parche para el error de WhatsApp:
//   "Data passed to getter must include an id property (it's how we memoize) but got undefined"
// Bug de whatsapp-web.js 1.34.7 al enviar archivos (PDF, imágenes...) desde el cambio de
// WhatsApp Web del 17-18 de septiembre de 2026 (wwebjs/whatsapp-web.js issue #201922, PR #201923).
// El parche agrega `delete message.__x_id;` justo después de armar el mensaje saliente.
//
// Uso manual:   node scripts/patch-whatsapp-web.js
// Automático:   en server/package.json  "scripts": { "postinstall": "node scripts/patch-whatsapp-web.js" }
// Es seguro ejecutarlo varias veces: si ya está parchado, no hace nada.
const fs = require('node:fs');
const path = require('node:path');

const candidates = [
  path.resolve(process.cwd(), 'node_modules/whatsapp-web.js/src/util/Injected/Utils.js'),
  path.resolve(__dirname, '../node_modules/whatsapp-web.js/src/util/Injected/Utils.js'),
  path.resolve(__dirname, 'node_modules/whatsapp-web.js/src/util/Injected/Utils.js'),
];

const target = candidates.find((file) => fs.existsSync(file));
if (!target) {
  console.warn('[patch-whatsapp] No se encontró whatsapp-web.js en node_modules. Ejecuta este script desde la carpeta server.');
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
if (source.includes('delete message.__x_id')) {
  console.log('[patch-whatsapp] Ya estaba parchado. Nada que hacer.');
  process.exit(0);
}

const anchor = "// Bot's won't reply if canonicalUrl is set (linking)";
const index = source.indexOf(anchor);
const hasMessageBlock = source.includes('window.WWebJS.sendMessage = async') && source.includes('...mediaOptions,');
if (index === -1 || !hasMessageBlock) {
  console.error('[patch-whatsapp] La estructura de whatsapp-web.js cambió y no pude parchar automáticamente.');
  console.error('Actualiza la librería (npm i whatsapp-web.js@latest) por si ya incluye el arreglo.');
  process.exit(1);
}

const lineStart = source.lastIndexOf('\n', index) + 1;
const indent = source.slice(lineStart, index);
const patched = `${source.slice(0, lineStart)}${indent}// Parche #201923: el id interno del media model pisa el id real del mensaje.\n${indent}delete message.__x_id;\n\n${source.slice(lineStart)}`;

fs.writeFileSync(`${target}.bak`, source);
fs.writeFileSync(target, patched);
console.log('[patch-whatsapp] Parche aplicado en', target);