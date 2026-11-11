// Carga toda la app en Node con un DOM mínimo simulado, para probar la lógica
// sin navegador. Devuelve un objeto con todo lo exportado por los módulos
// (las variables reasignables tienen getter y setter).
'use strict';
const fs = require('fs'), path = require('path');
const { bundle, order } = require('./bundle.cjs');

function fakeEl() {
  return { innerHTML: '', textContent: '', value: '', hidden: false, dataset: {}, style: {}, offsetWidth: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelectorAll: () => [], querySelector: () => null, appendChild() {}, remove() {},
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, closest: () => null, focus() {}, blur() {} };
}

function installDom() {
  global.window = { __TEST__: true, addEventListener() {}, scrollTo() {}, scrollY: 0 };
  global.document = { querySelector: () => fakeEl(), querySelectorAll: () => [], addEventListener() {}, getElementById: () => null,
    createElement: () => fakeEl(), documentElement: fakeEl(), body: fakeEl(), visibilityState: 'visible' };
  global.location = { hash: '', search: '', origin: 'https://example.github.io', pathname: '/zancada/', protocol: 'https:' };
  global.history = { replaceState() {} };
  global.localStorage = { getItem: () => null, setItem() {} };
  Object.defineProperty(global, 'navigator', { value: {}, configurable: true, writable: true });
  global.matchMedia = () => ({ matches: true });
  global.scrollTo = () => {};
}

function exportedNames() {
  const names = new Set(), lets = new Set();
  for (const f of order()) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^export (?:async )?(function|const|let) ([\s\S]*?)(?:[;({=]|$)/gm)) {
      if (m[1] === 'function') names.add(m[2].trim().split(/[\s(]/)[0]);
      else for (const n of m[2].split(',')) { const k = n.trim().split(/[\s=]/)[0]; if (/^[\w$]+$/.test(k)) { names.add(k); if (m[1] === 'let') lets.add(k); } }
    }
  }
  return { names: [...names], lets: [...lets] };
}

function loadApp() {
  installDom();
  const { names, lets } = exportedNames();
  const api = names.map(n => lets.includes(n) ? `get ${n}(){return ${n}},set ${n}(v){${n}=v}` : `${n}`).join(',\n');
  return new Function(bundle() + `\n;return {${api}};`)();
}

module.exports = { loadApp };
