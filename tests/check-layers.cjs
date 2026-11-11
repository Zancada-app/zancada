// Comprueba la dirección de las dependencias entre capas:
//   core   → no importa de model, services ni ui
//   model  → solo de core y model (la lógica no conoce la pantalla ni la red)
//   services → de core, model y services; de ui solo para avisar del progreso
//              (barra de sincronización, avisos)
'use strict';
const fs = require('fs'), path = require('path');
const JS = path.join(__dirname, '..', 'js');
const ALLOWED = { core: ['core'], model: ['core', 'model'], services: ['core', 'model', 'services', 'ui'], ui: ['core', 'model', 'services', 'ui'] };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const bad = [];
for (const f of walk(JS)) {
  const rel = path.relative(JS, f), layer = rel.split(path.sep)[0];
  if (!ALLOWED[layer]) continue;
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)) {
    const target = path.relative(JS, path.resolve(path.dirname(f), m[1])).split(path.sep)[0];
    if (!ALLOWED[layer].includes(target)) bad.push(`${rel} importa de ${target}/ (${m[1]})`);
  }
}
if (bad.length) { console.error('Dependencias entre capas no permitidas:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('capas OK');
