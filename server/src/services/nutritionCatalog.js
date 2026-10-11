const fs = require('node:fs');
const path = require('node:path');

const CATALOG_PATH = path.resolve(__dirname, '../data/nutricion/equivalentes.json');

let cache = null;

const normalizeKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const loadCatalog = () => {
  if (cache) return cache;
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (error) {
    console.error('[nutrition] No se pudo leer equivalentes.json:', error.message);
  }
  const groups = (Array.isArray(raw.grupos) ? raw.grupos : []).map((group) => ({
    id: String(group.id),
    name: String(group.nombre || group.id),
    reference: String(group.referencia || ''),
    note: String(group.nota || ''),
    foods: (Array.isArray(group.alimentos) ? group.alimentos : [])
      .map((food) => ({
        name: String(food.nombre || '').trim(),
        portion: String(food.porcion || '').trim(),
        level: food.nivel || null,
      }))
      .filter((food) => food.name),
  }));
  cache = { groups, byId: new Map(groups.map((group) => [group.id, group])) };
  return cache;
};

const LEVEL_LABEL = { muy_recomendado: 'muy recomendado', poco_recomendado: 'poco recomendado' };

// Versión estructurada del catálogo (se conserva por compatibilidad).
const catalogForPrompt = () => loadCatalog().groups.map((group) => ({
  id: group.id,
  nombre: group.name,
  referencia: group.reference,
  nota: group.note || undefined,
  alimentos: group.foods.map((food) => {
    const portion = food.portion ? ` = ${food.portion}` : '';
    const level = LEVEL_LABEL[food.level] ? ` [${LEVEL_LABEL[food.level]}]` : '';
    return `${food.name}${portion}${level}`;
  }),
}));

// Versión en texto plano, mucho más corta en tokens que JSON.stringify(catalogForPrompt()).
// [MR] = muy recomendado, [PR] = poco recomendado, sin marca = recomendado.
const LEVEL_MARK = { muy_recomendado: ' [MR]', poco_recomendado: ' [PR]' };

const catalogPromptText = () => loadCatalog().groups.map((group) => {
  const header = `## id="${group.id}" | ${group.name} | ${group.reference}${group.note ? ` | ${group.note}` : ''}`;
  const foods = group.foods
    .map((food) => `${food.name}${food.portion ? ` = ${food.portion}` : ''}${LEVEL_MARK[food.level] || ''}`)
    .join('; ');
  return `${header}\n${foods}`;
}).join('\n\n');

module.exports = { loadCatalog, catalogForPrompt, catalogPromptText, normalizeKey };