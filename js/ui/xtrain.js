/**
 * Otros entrenos en pantalla: elegir qué has hecho (correr u otra actividad), formulario de
 * registro y edición, filas para Hoy, Plan e Historial, y tarjeta de resumen en Progreso.
 */
import { DAYS, addDays, dow, esc, fdLong, fk, monday, pd, today } from '../core/util.js';
import { save, state } from '../core/store.js';
import { XT, XT_FOCUS, XT_GROUPS, addXt, deleteXt, xtIn, xtList, xtLoad, xtName, xtOf, xtType } from '../model/xtrain.js';
import { $, layer } from './dom.js';
import { RPE_OPTS } from './actions.js';
import { intPicker, pickerHTML } from './pickers.js';
import { closeSheet, openSheet, route } from './router.js';
import { toast } from './toast.js';

/** «+ Añadir entreno»: correr o cualquier otra actividad. */
export function openAddChooser() {
  openSheet(`<div class="stack"><h2>¿Qué has hecho?</h2>
    <button type="button" class="ocard" data-act="addrunform"><b>🏃 Correr</b><span>Una carrera fuera del plan, o una sesión que no se ha registrado sola</span></button>
    ${XT_GROUPS.map(([g, keys]) => `<div class="stack" style="gap:8px"><span class="eyebrow">${g}</span>
      <div class="xtg">${keys.map(k => `<button type="button" data-act="xtnew" data-v="${k}"><span aria-hidden="true">${XT[k].e}</span>${XT[k].n}</button>`).join('')}</div></div>`).join('')}
    <button type="button" class="ghost" data-act="close">Cancelar</button></div>`);
}

let xd = null; // borrador del formulario

export function openXtForm(type, id) {
  const x = id ? xtOf(id) : null;
  xd = x ? { ...x } : { type, date: today(), min: XT[type].min, rpe: null, km: null, focus: null, notes: '', name: '' };
  renderXtForm();
}

const STR_FOCUS = ['gym', 'fuerza', 'funcional', 'crossfit', 'hiit', 'pump', 'calistenia', 'kettlebell', 'otro'];

function renderXtForm() {
  const td = today(), T = XT[xd.type] || XT.otro;
  const dChips = [[td, 'Hoy'], [addDays(td, -1), 'Ayer'], [addDays(td, -2), 'Anteayer']];
  const html = `<div id="xtf" class="stack">
    <h2><span aria-hidden="true">${T.e}</span> ${xd.id ? esc(xtName(xd)) : T.n}</h2>
    ${xd.type === 'otro' ? `<div><label for="x-name">¿Qué actividad?</label><input id="x-name" type="text" maxlength="60" placeholder="Por ejemplo, trampolín" value="${esc(xd.name || '')}"></div>` : ''}
    <div><label>Día</label><div class="seg">${dChips.map(([d, l]) => `<button type="button" data-act="xtset" data-f="date" data-v="${d}" aria-pressed="${xd.date === d}">${l}</button>`).join('')}</div>
      <input type="date" id="x-date" style="margin-top:8px" max="${td}" value="${xd.date}"><div class="hint">${fdLong(xd.date)}</div></div>
    <div><label>Duración</label>${intPicker('x-min', '', 5, 480, 5, xd.min || T.min, 'min')}</div>
    ${T.dist ? `<div><label>Distancia <span class="muted">(opcional)</span></label>${pickerHTML('x-km', '', 'dist', xd.km || '', true)}</div>` : ''}
    ${STR_FOCUS.includes(xd.type) ? `<div><label>¿Qué has trabajado?</label><div class="seg">${Object.entries(XT_FOCUS).map(([k, [n]]) => `<button type="button" data-act="xtset" data-f="focus" data-v="${k}" aria-pressed="${xd.focus === k}">${n}</button>`).join('')}</div>
      <div class="hint">Si has hecho piernas, lo tengo en cuenta para la sesión de mañana.</div></div>` : ''}
    <div><label>¿Cómo te ha resultado?</label><div class="rpe" role="radiogroup">${RPE_OPTS.map(([v, l]) => `<button type="button" role="radio" data-act="xtset" data-f="rpe" data-v="${v}" aria-checked="${xd.rpe === v}"><b>${v}</b>${l}</button>`).join('')}</div></div>
    <div><label for="x-n">Notas <span class="muted">(opcional)</span></label><textarea id="x-n" rows="2" placeholder="Ejercicios, sensaciones…">${esc(xd.notes || '')}</textarea></div>
    <p class="err" id="xerr" role="alert"></p>
    <div class="grid2"><button type="button" class="ghost" data-act="${xd.id ? 'close' : 'xtback'}">${xd.id ? 'Cerrar' : 'Atrás'}</button><button type="button" class="primary" data-act="xtsave">Guardar</button></div>
    ${xd.id ? `<button type="button" class="danger" data-act="xtdel" data-id="${xd.id}">Borrar</button>` : ''}
    ${xd.src === 'strava' ? '<p class="src">Datos de actividad: Strava</p>' : ''}</div>`;
  const sh = layer.querySelector('.sheet');
  if (sh && sh.querySelector('#xtf')) { const y = sh.scrollTop; sh.innerHTML = '<div class="grab" aria-hidden="true"></div>' + html; sh.scrollTop = y; }
  else openSheet(html);
}

function readXt() {
  const v = id => { const e = $('#' + id); return e ? e.value : ''; };
  const m = +v('x-min'); if (m) xd.min = m;
  const k = parseFloat(v('x-km')); xd.km = k > 0 ? k : null;
  xd.notes = v('x-n'); if ($('#x-name')) xd.name = v('x-name').trim();
  const d = v('x-date'); if (d) xd.date = d;
}

export function xtSet(t) {
  readXt();
  const f = t.dataset.f, v = t.dataset.v;
  if (f === 'rpe') { xd.rpe = +v; xd.rpeManual = true; }
  else if (f === 'focus') xd.focus = xd.focus === v ? null : v;
  else xd[f] = v;
  renderXtForm();
}

export function saveXt() {
  readXt();
  const err = $('#xerr'), td = today();
  if (xd.date > td) { err.textContent = 'No puedes registrar un día futuro.'; return; }
  if (!(xd.min > 0)) { err.textContent = 'Elige la duración.'; return; }
  if (!xd.rpe) { err.textContent = 'Elige cómo te ha resultado.'; return; }
  if (xd.type === 'otro' && !xd.name) { err.textContent = 'Escribe qué actividad has hecho.'; $('#x-name').focus(); return; }
  const snap = JSON.stringify(state);
  if (xd.id) {
    const x = xtOf(xd.id); if (!x) return;
    Object.assign(x, { date: xd.date, min: xd.min, rpe: xd.rpe, km: xd.km || undefined, focus: xd.focus || undefined, notes: (xd.notes || '').trim().slice(0, 200) || undefined, name: xd.name || undefined, rpeManual: true });
  } else addXt(xd);
  const n = xtName(xd);
  xd = null;
  save(); closeSheet(); route();
  toast(`${n} apuntado. Cuenta para tu fatiga y tu forma.`, { undo: snap });
}

export function delXt(id) {
  const snap = JSON.stringify(state), x = xtOf(id); if (!x) return;
  deleteXt(id); save(); closeSheet(); route(); toast(`${xtName(x)} borrado.`, { undo: snap });
}

/* ---------- filas y tarjetas ---------- */
export function xtMeta(x) {
  return [`${x.min} min`, x.km ? `${fk(x.km)} km` : '', x.focus ? XT_FOCUS[x.focus][0].toLowerCase() : '', `esfuerzo ${x.rpe}/10`].filter(Boolean).join(' · ');
}

export function xtRow(x) {
  return `<button type="button" class="item" data-act="xtopen" data-id="${x.id}"><span class="date">${DAYS[dow(x.date)]}<b class="num">${pd(x.date).getDate()}</b></span>
    <span class="grow"><span class="t"><span aria-hidden="true">${xtType(x).e}</span> ${esc(xtName(x))}</span>${x.src === 'strava' ? ' <span class="src">Strava</span>' : ''}<br><span class="s num">${xtMeta(x)}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
}

/** Resumen corto de la semana para «Esta semana». */
export function xtWeekText(mon) {
  const l = xtIn(mon, addDays(mon, 6)); if (!l.length) return '';
  const min = l.reduce((t, x) => t + x.min, 0);
  return `+ ${l.length} ${l.length === 1 ? 'entreno' : 'entrenos'} de otro tipo (${min >= 90 ? (min / 60).toFixed(1).replace('.', ',') + ' h' : min + ' min'})`;
}

/** Tarjeta de Progreso: últimas 4 semanas. */
export function xtCard() {
  const td = today(), from = addDays(monday(td), -21), l = xtIn(from, td);
  if (!l.length) return `<section class="card stack" style="gap:6px"><div class="row between"><h3>Otros entrenos</h3><button type="button" class="ghost addbtn" data-act="addrun">+ Añadir</button></div>
    <p class="small muted">Gimnasio, pilates, barre, yoga, bici, natación, pádel… Apúntalos y los tendré en cuenta para tu fatiga y para no ponerte series al día siguiente de un entreno duro de piernas.</p></section>`;
  const by = {};
  l.forEach(x => { const g = (XT_GROUPS.find(([, ks]) => ks.includes(x.type)) || XT_GROUPS[5])[0]; (by[g] = by[g] || { min: 0, n: 0, load: 0 }); by[g].min += x.min; by[g].n++; by[g].load += xtLoad(x); });
  const tot = l.reduce((t, x) => t + x.min, 0), mx = Math.max(...Object.values(by).map(g => g.min));
  const rows = Object.entries(by).sort((a, b) => b[1].min - a[1].min).map(([g, v]) => `<div class="stack" style="gap:4px;padding:6px 0"><div class="row between small"><span>${g}</span><span class="muted num">${v.n} · ${v.min} min</span></div><div class="bar"><i style="width:${v.min / mx * 100}%"></i></div></div>`).join('');
  return `<section class="card stack" style="gap:6px"><div class="row between"><h3>Otros entrenos · 4 semanas</h3><button type="button" class="ghost addbtn" data-act="addrun">+ Añadir</button></div>
    <p class="small muted num">${l.length} entrenos · ${(tot / 60).toFixed(1).replace('.', ',')} h</p>${rows}
    <p class="small muted">Cuentan para tu carga, tu fatiga y tu forma, pero no para tus ritmos de carrera. Los de fuerza, gimnasio, pilates o barre cubren las sesiones de fuerza del plan.</p></section>`;
}

export const xtRecent = (n = 20) => [...xtList()].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, n);
