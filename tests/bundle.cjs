// Une los módulos ES de js/ en un único script (sin import/export) para poder
// probar la lógica en Node sin navegador. Respeta el orden de evaluación real
// de los módulos (recorrido en profundidad desde main.js, como el navegador).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'js');

function order(entry = path.join(ROOT, 'main.js'), seen = new Set(), out = []) {
  if (seen.has(entry)) return out;
  seen.add(entry);
  const src = fs.readFileSync(entry, 'utf8');
  for (const m of src.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)) order(path.resolve(path.dirname(entry), m[1]), seen, out);
  out.push(entry);
  return out;
}

function bundle() {
  return '"use strict";\n' + order().map(f => {
    const src = fs.readFileSync(f, 'utf8')
      .replace(/^import\s[^;]*;\n/gm, '')
      .replace(/^export (?=function|const|let|async function)/gm, '');
    return `// ---- ${path.relative(ROOT, f)}\n${src}`;
  }).join('\n');
}

module.exports = { bundle, order };
if (require.main === module) process.stdout.write(bundle());
