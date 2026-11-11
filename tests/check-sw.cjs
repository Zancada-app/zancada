// Comprueba que el service worker guarda todos los archivos de la app,
// para que funcione sin conexión tras una actualización.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shell = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]));
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const needed = ['index.html', 'manifest.webmanifest', ...['css', 'js', 'icons'].flatMap(walk)];
const missing = needed.filter(f => !shell.has(f));
const extra = [...shell].filter(f => f && !fs.existsSync(path.join(ROOT, f)));
if (missing.length || extra.length) {
  console.error('sw.js desactualizado.\n  Faltan: ' + (missing.join(', ') || '—') + '\n  Sobran: ' + (extra.join(', ') || '—'));
  process.exit(1);
}
console.log(`sw.js OK (${shell.size - 1} archivos en caché)`);
