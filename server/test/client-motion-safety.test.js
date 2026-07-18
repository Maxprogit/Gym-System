const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const clientRoot = path.resolve(__dirname, '../../client/src');

const sourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(target);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
});

const clientSource = sourceFiles(clientRoot).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const membersSource = fs.readFileSync(path.join(clientRoot, 'features/members/MembersPage.tsx'), 'utf8');

test('los efectos de React no son async ni devuelven promesas implícitas', () => {
  assert.doesNotMatch(clientSource, /useEffect\(\s*async\b/);
  assert.doesNotMatch(clientSource, /useEffect\(\s*\(\)\s*=>\s*(?:api\.|fetch\()/);
});

test('GSAP no recibe selectores de texto sin verificar como objetivos', () => {
  assert.doesNotMatch(clientSource, /gsap\.(?:to|from|fromTo|set)\(\s*['"]/);
  assert.doesNotMatch(clientSource, /\.(?:to|from|fromTo|set)\(\s*['"]\.[a-z]/);
});

test('los objetivos que fallaron ya no se animan de forma directa', () => {
  assert.doesNotMatch(clientSource, /gsap\.[^(]+\([^\n]*\.recharts-area-curve/);
  assert.doesNotMatch(clientSource, /gsap\.[^(]+\([^\n]*\.page-header-action/);
  assert.doesNotMatch(clientSource, /gsap\.[^(]+\([^\n]*\.coach-panel/);
});

test('Atletas no inicia una animación GSAP cuando el filtro deja cero nodos', () => {
  assert.match(membersSource, /const nodes = selectAll<HTMLElement>\(root, '\.athlete-node'\);\s*if \(!nodes\.length\) return;\s*gsap\.fromTo\(nodes,/);
});

test('los filtros de Atletas no compiten con una segunda animación de entrada', () => {
  assert.doesNotMatch(membersSource, /dependencies:\s*\[loading, page, filter, sort\]/);
  assert.match(membersSource, /gsap\.killTweensOf\(nodes\);/);
  assert.match(membersSource, /gsap\.set\(nextNodes, \{ autoAlpha: 1 \}\);/);
  assert.match(membersSource, /clearProps: 'opacity,visibility,transform,zIndex,width,height,position,left,top'/);
});

test('el inspector de Atletas flota fuera de la cuadrícula sin desplazar nodos', () => {
  assert.match(membersSource, /createPortal\(/);
  assert.match(membersSource, /member-inspector member-inspector--floating/);
  assert.doesNotMatch(membersSource, /member-inspector--inline/);
  assert.doesNotMatch(membersSource, /<Fragment/);
  assert.match(membersSource, /aria-controls=\{isSelected \? `member-actions-/);
});
