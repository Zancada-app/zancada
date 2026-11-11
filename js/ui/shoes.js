/**
 * Zapatillas en pantalla: tarjeta con el kilometraje, aviso en «Hoy», hoja para dar de alta o
 * editar un par y selector de zapatillas en cada carrera.
 */
import { clamp, esc, fdShort, fk } from '../core/util.js';
import { save, state } from '../core/store.js';
import { activities } from '../model/activities.js';
import { SHOE_KINDS, ackShoe, activeShoes, addShoe, defaultShoe, deleteShoe, retireShoe, shoeAlerts, shoeById, shoeKm, shoeLevel, shoeOfRef, shoes, unretireShoe, setShoeOfRef } from '../model/shoes.js';
import { $ } from './dom.js';
import { intPicker } from './pickers.js';
import { closeSheet, openSheet, route } from './router.js';
import { toast } from './toast.js';

const LEVEL = [['Bien', 'ok', 'var(--good)'], ['Pronto', 'w', 'var(--warn)'], ['Cámbialas', 'q', 'var(--accent)']];

function kmLine(sh, km) {
  const left = Math.round(sh.limit - km);
  return left > 0 ? `${fk(km)} de ${sh.limit} km recomendados · quedan unos ${left} km`
    : `${fk(km)} km · ${-left} km por encima de los ${sh.limit} recomendados`;
}

function shoeRow(sh, acts) {
  const km = shoeKm(sh, acts), lv = shoeLevel(sh, km), L = LEVEL[lv], isDef = defaultShoe() === sh;
  return `<button type="button" class="zrow shoe" data-act="shoeopen" data-id="${sh.id}">
    <div class="row between" style="gap:8px"><b>${esc(sh.name)}</b><span class="row" style="gap:6px">${isDef ? '<span class="chip">Por defecto</span>' : ''}<span class="chip ${L[1]}">${L[0]}</span></span></div>
    <div class="bar"><i style="width:${clamp(km / sh.limit, 0, 1) * 100}%;background:${L[2]}"></i></div>
    <span class="small muted num">${kmLine(sh, km)}</span></button>`;
}

/** Tarjeta de Progreso: todos los pares, con su desgaste. */
export function shoesCard() {
  const acts = activities(), act = activeShoes(), old = shoes().filter(s => s.retired);
  const strava = state.strava && state.strava.tokens;
  return `<section class="card stack" style="gap:0" id="shoes">
    <div class="row between" style="margin-bottom:6px"><h3>Zapatillas</h3><button type="button" class="ghost addbtn" data-act="shoeopen">+ Añadir</button></div>
    ${act.length ? act.map(s => shoeRow(s, acts)).join('')
      : `<p class="small muted">Añade las zapatillas con las que corres y te avisaré cuando lleguen a los kilómetros recomendados para cambiarlas.${strava ? ' Si en Strava eliges las zapatillas de cada actividad, se apuntan solas.' : ''}</p>`}
    ${act.length > 1 ? '<p class="small muted" style="margin-top:8px">Cada carrera se apunta al par por defecto. Puedes cambiarlo en la propia carrera.</p>' : ''}
    ${old.length ? `<details class="adv" style="margin-top:8px"><summary>Retiradas (${old.length})</summary>${old.map(s => `<button type="button" class="zrow shoe" data-act="shoeopen" data-id="${s.id}"><div class="row between"><b>${esc(s.name)}</b><span class="small muted num">${fk(shoeKm(s, acts))} km</span></div><span class="small muted">Retiradas el ${fdShort(s.retired)}</span></button>`).join('')}</details>` : ''}
  </section>`;
}

/** Aviso en «Hoy» cuando un par se acerca o pasa de su vida útil. */
export function shoeAlertCard() {
  const x = shoeAlerts()[0]; if (!x) return '';
  const { sh, km, level } = x;
  if (level === 2) return `<section class="card stack" style="gap:8px;border-color:var(--accent)">
    <span class="eyebrow">Zapatillas</span>
    <h3>Tus ${esc(sh.name)} han pasado los ${sh.limit} km recomendados</h3>
    <p class="small">Llevan <b class="num">${fk(km)} km</b>. A partir de aquí la amortiguación responde peor y aumenta el riesgo de molestias: es buen momento para cambiarlas.</p>
    <div class="grid2"><button type="button" class="ghost" data-act="shoeack" data-id="${sh.id}">Más adelante</button><button type="button" class="primary" data-act="shoeswap" data-id="${sh.id}">Ya las he cambiado</button></div>
  </section>`;
  return `<section class="card stack" style="gap:8px">
    <span class="eyebrow">Zapatillas</span>
    <h3>Tus ${esc(sh.name)} se acercan a su vida útil</h3>
    <p class="small">Llevan <b class="num">${fk(km)}</b> de ${sh.limit} km: les quedan unos ${Math.max(0, Math.round(sh.limit - km))} km. Ve pensando en el relevo; alternar el par nuevo y el viejo unas semanas hace el cambio más suave.</p>
    <button type="button" class="ghost" data-act="shoeack" data-id="${sh.id}">Entendido</button>
  </section>`;
}

/** Selector de zapatillas para un formulario (registro de sesión o entreno manual). */
export function shoePickHTML(cur) {
  const list = activeShoes(); if (!list.length) return '';
  const v = cur === undefined ? (defaultShoe() || {}).id || 'none' : cur || 'none';
  return `<div><label>Zapatillas</label><div class="seg" role="radiogroup" data-shoes>${list.map(s => `<button type="button" role="radio" data-act="shoepick" data-v="${s.id}" aria-pressed="${v === s.id}">${esc(s.name)}</button>`).join('')}<button type="button" role="radio" data-act="shoepick" data-v="none" aria-pressed="${v === 'none'}">Otras</button></div></div>`;
}

/** Valor elegido en el selector de un formulario ('none' si «Otras»), o undefined si no hay selector. */
export function readShoePick(root) {
  const b = root.querySelector('[data-shoes] [aria-pressed="true"]');
  return b ? b.dataset.v : undefined;
}

/** Selector para una carrera ya registrada: el cambio se guarda al momento. */
export function shoeSetHTML(ref) {
  const cur = shoeOfRef(ref), list = activeShoes().concat(cur && shoeById(cur) && shoeById(cur).retired ? [shoeById(cur)] : []);
  if (!list.length) return '';
  return `<div class="stack" style="gap:6px"><span class="small muted">Zapatillas</span><div class="seg" role="radiogroup">${list.map(s => `<button type="button" role="radio" data-act="shoeset" data-ref="${ref}" data-v="${s.id}" aria-pressed="${cur === s.id}">${esc(s.name)}</button>`).join('')}<button type="button" role="radio" data-act="shoeset" data-ref="${ref}" data-v="none" aria-pressed="${!cur}">Otras</button></div></div>`;
}

export function applyShoeSet(btn) {
  if (!setShoeOfRef(btn.dataset.ref, btn.dataset.v === 'none' ? null : btn.dataset.v)) return;
  btn.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  save();
  toast(btn.dataset.v === 'none' ? 'Carrera sin zapatillas asignadas.' : `Apuntada a ${shoeById(btn.dataset.v).name}.`);
}

/* ---------- Alta y edición ---------- */
let shoeDraft = null;

export function openShoe(id) {
  const sh = id ? shoeById(id) : null;
  shoeDraft = sh ? { id: sh.id, kind: sh.kind || 'diario', limitTouched: true } : { id: null, kind: 'diario', limitTouched: false };
  const kind = shoeDraft.kind, g = sh && sh.stravaId && state.strava && state.strava.gear && state.strava.gear[sh.stravaId];
  const isDef = sh ? defaultShoe() === sh : !defaultShoe();
  openSheet(`<div id="shoef" class="stack">
    <h2>${sh ? 'Tus zapatillas' : 'Añadir zapatillas'}</h2>
    <div><label for="sh-name">Nombre</label><input id="sh-name" type="text" maxlength="60" autocomplete="off" placeholder="Por ejemplo, Pegasus 41" value="${sh ? esc(sh.name) : ''}" enterkeyhint="done"></div>
    <div><label>Tipo</label><div class="seg" role="radiogroup">${Object.entries(SHOE_KINDS).map(([k, x]) => `<button type="button" role="radio" data-act="shoekind" data-v="${k}" aria-pressed="${kind === k}">${x.n}</button>`).join('')}</div></div>
    <div><label>Cambiarlas a los</label>${intPicker('sh-limit', '', 300, 1200, 50, sh ? sh.limit : SHOE_KINDS[kind].limit, 'km')}
      <div class="hint">Lo habitual: unos 700 km las de diario, 600 las de trail y 400–500 las ligeras. Si pesas más o pisas fuerte, mejor algo antes.</div></div>
    ${g ? `<p class="small muted">Kilómetros: los lleva Strava (${fk(g.km)} km), más las carreras que apuntes aquí a este par.</p>`
      : `<div><label>Kilómetros que ya llevan</label>${intPicker('sh-start', '', 0, 2000, 10, sh ? sh.startKm || 0 : 0, 'km')}<div class="hint">${sh ? 'A esto se suman las carreras apuntadas a este par.' : 'Si son nuevas, déjalo en 0. Desde hoy, tus carreras se apuntan solas al par por defecto.'}</div></div>`}
    ${sh && sh.retired ? '' : `<div><label>Usarlas por defecto</label><div class="seg" role="radiogroup"><button type="button" role="radio" data-act="shoedef" data-v="1" aria-pressed="${isDef}">Sí</button><button type="button" role="radio" data-act="shoedef" data-v="0" aria-pressed="${!isDef}">No</button></div></div>`}
    <p class="err" id="sherr" role="alert"></p>
    <div class="grid2"><button type="button" class="ghost" data-act="close">Cancelar</button><button type="button" class="primary" data-act="shoesave">Guardar</button></div>
    ${sh ? `<div class="grid2">${sh.retired ? `<button type="button" class="ghost" data-act="shoeunretire" data-id="${sh.id}">Volver a usarlas</button>` : `<button type="button" class="ghost" data-act="shoeretire" data-id="${sh.id}">Retirarlas</button>`}<button type="button" class="danger" data-act="shoedel" data-id="${sh.id}">Borrar</button></div>` : ''}
  </div>`);
  if (!sh) setTimeout(() => { const i = $('#sh-name'); if (i) i.focus(); }, 300);
}

/** Al cambiar el tipo, la vida útil sugerida cambia con él (salvo que se haya tocado a mano). */
export function pickShoeKind(btn) {
  shoeDraft.kind = btn.dataset.v;
  btn.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  if (!shoeDraft.limitTouched) {
    const pk = $('#sh-limit').closest('.picker'), v = SHOE_KINDS[shoeDraft.kind].limit;
    pk.querySelector('select').value = String(v); $('#sh-limit').value = String(v);
  }
}
export function touchShoeLimit() { if (shoeDraft) shoeDraft.limitTouched = true; }

export function saveShoe() {
  const f = $('#shoef'); if (!f || !shoeDraft) return;
  const name = $('#sh-name').value.trim(), err = $('#sherr');
  if (!name) { err.textContent = 'Ponles un nombre para reconocerlas.'; $('#sh-name').focus(); return; }
  const limit = +$('#sh-limit').value || SHOE_KINDS[shoeDraft.kind].limit;
  const st = $('#sh-start'), startKm = st ? +st.value || 0 : 0;
  const defB = f.querySelector('[data-act="shoedef"][aria-pressed="true"]'), makeDef = defB ? defB.dataset.v === '1' : false;
  const snap = JSON.stringify(state);
  let msg;
  if (shoeDraft.id) {
    const sh = shoeById(shoeDraft.id); if (!sh) return;
    sh.name = name.slice(0, 60); sh.kind = shoeDraft.kind; sh.limit = limit; if (st) sh.startKm = startKm;
    if (defB) { if (makeDef) state.shoeDefault = sh.id; else if (state.shoeDefault === sh.id) state.shoeDefault = null; }
    // si el nuevo límite ya no se ha alcanzado, el aviso vuelve a estar pendiente para cuando llegue
    const km = shoeKm(sh), lv = shoeLevel(sh, km);
    if (sh.ack && sh.ack.level > lv) sh.ack = { level: lv, km };
    msg = 'Zapatillas guardadas.';
  } else {
    const sh = addShoe({ name, kind: shoeDraft.kind, limit, startKm, makeDefault: makeDef });
    msg = `${sh.name} añadidas.${defaultShoe() === sh ? ' Tus próximas carreras se apuntarán a ellas.' : ''}`;
  }
  shoeDraft = null;
  save(); closeSheet(); route(); toast(msg, { undo: snap });
}

export function shoeAction(a, id) {
  const sh = shoeById(id); if (!sh) return;
  const snap = JSON.stringify(state);
  if (a === 'shoeack') { ackShoe(sh); save(); route(); return; }
  if (a === 'shoeretire') { retireShoe(sh); save(); closeSheet(); route(); toast(`${sh.name} retiradas.`, { undo: snap }); return; }
  if (a === 'shoeunretire') { unretireShoe(sh); save(); closeSheet(); route(); toast(`${sh.name} vuelven a estar en uso.`, { undo: snap }); return; }
  if (a === 'shoedel') { deleteShoe(sh); save(); closeSheet(); route(); toast(`${sh.name} borradas.`, { undo: snap }); return; }
  if (a === 'shoeswap') { retireShoe(sh); save(); route(); openShoe(null); toast(`${sh.name} retiradas. Añade las nuevas.`); }
}
