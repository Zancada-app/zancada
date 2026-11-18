// Comprueba que cada módulo importa todo lo que usa de otros módulos. En el navegador, un import
// olvidado solo falla al llegar a esa línea, así que conviene detectarlo antes.
// Usa el analizador de JavaScript que trae Node (node --expose-internals tests/check-imports.cjs).
'use strict';
const fs = require('fs'), path = require('path');
let acorn, walk;
try { acorn = require('internal/deps/acorn/acorn/dist/acorn'); walk = require('internal/deps/acorn/acorn-walk/dist/walk'); }
catch (e) { console.log('check-imports: ejecuta con «node --expose-internals». Omitido.'); process.exit(0); }
const ROOT = path.join(__dirname, '..', 'js'), files = [];
const rec = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? rec(path.join(d, e.name)) : files.push(path.join(d, e.name)));
rec(ROOT);
// --- análisis de ámbito: ¿está el identificador declarado localmente en algún ámbito que lo envuelve?
const patNames=(p,out=[])=>{if(!p)return out;switch(p.type){case 'Identifier':out.push(p.name);break;case 'ObjectPattern':p.properties.forEach(q=>patNames(q.type==='RestElement'?q.argument:q.value,out));break;case 'ArrayPattern':p.elements.forEach(e=>patNames(e,out));break;case 'RestElement':patNames(p.argument,out);break;case 'AssignmentPattern':patNames(p.left,out);break;}return out;};
const declCache=new WeakMap();
function declaredIn(node){
  if(declCache.has(node))return declCache.get(node);
  const set=new Set();
  const isFn=/Function/.test(node.type);
  if(isFn){node.params.forEach(p=>patNames(p).forEach(n=>set.add(n)));if(node.type==='FunctionExpression'&&node.id)set.add(node.id.name);
    // var hoisted + declaraciones del cuerpo
    const body=node.body;
    const scan=(n,top)=>{if(!n||typeof n!=='object')return;if(n!==node&&/Function/.test(n.type)){if(n.type==='FunctionDeclaration'&&top)set.add(n.id.name);return;}
      if(n.type==='VariableDeclaration'&&n.kind==='var')n.declarations.forEach(d=>patNames(d.id).forEach(x=>set.add(x)));
      for(const k in n){if(k==='type'||k==='start'||k==='end')continue;const v=n[k];if(Array.isArray(v))v.forEach(c=>c&&typeof c.type==='string'&&scan(c,false));else if(v&&typeof v.type==='string')scan(v,false);}};
    if(body.type==='BlockStatement')body.body.forEach(st=>{if(st.type==='FunctionDeclaration')set.add(st.id.name);});
    scan(body,true);
  }
  const stmts=node.type==='BlockStatement'||node.type==='StaticBlock'?node.body:node.type==='SwitchCase'?node.consequent:(node.type==='ForStatement'?[node.init]:(node.type==='ForInStatement'||node.type==='ForOfStatement')?[node.left]:[]);
  (stmts||[]).forEach(st=>{if(!st)return;if(st.type==='VariableDeclaration')st.declarations.forEach(d=>patNames(d.id).forEach(n=>set.add(n)));if(st.type==='FunctionDeclaration'||st.type==='ClassDeclaration')set.add(st.id.name);});
  if(node.type==='CatchClause'&&node.param)patNames(node.param).forEach(n=>set.add(n));
  if(node.type==='BlockStatement'&&false){}
  declCache.set(node,set);return set;
}
const shadowed=(name,anc)=>anc.slice(0,-1).some((a,i)=>i>0&&declaredIn(a).has(name));

const isRef=(node,anc)=>{const p=anc[anc.length-2];if(!p)return true;
 if(p.type==='MemberExpression'&&p.property===node&&!p.computed)return false;
 if((p.type==='Property'||p.type==='MethodDefinition')&&p.key===node&&!p.computed&&!p.shorthand)return false;
 if(p.type==='ImportSpecifier'||p.type==='ExportSpecifier'||p.type==='LabeledStatement'||p.type==='BreakStatement'||p.type==='ContinueStatement')return false;return true;};
const top = {}, asts = {};
for (const f of files) {
  const a = acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }); asts[f] = a;
  a.body.forEach(st => { const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st; if (!d) return;
    if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') top[d.id.name] = f;
    if (d.type === 'VariableDeclaration') d.declarations.forEach(x => patNames(x.id).forEach(n => top[n] = f)); });
}
const bad = [];
for (const f of files) {
  const a = asts[f], known = new Set();
  a.body.forEach(st => {
    if (st.type === 'ImportDeclaration') st.specifiers.forEach(s => known.add(s.local.name));
    const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st; if (!d) return;
    if (d.id && d.id.name) known.add(d.id.name);
    if (d.type === 'VariableDeclaration') d.declarations.forEach(x => patNames(x.id).forEach(n => known.add(n)));
  });
  walk.fullAncestor(a, (node, _s, anc) => {
    if (node.type !== 'Identifier' || !top[node.name] || known.has(node.name) || !isRef(node, anc) || shadowed(node.name, anc)) return;
    bad.push(`${path.relative(ROOT, f)}: usa «${node.name}» (de ${path.relative(ROOT, top[node.name])}) sin importarlo`);
  });
}
if (bad.length) { console.error([...new Set(bad)].join('\n')); process.exit(1); }
console.log(`imports OK (${files.length} módulos)`);
