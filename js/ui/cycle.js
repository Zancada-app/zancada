/**
 * Ciclo menstrual en pantalla: tarjeta «Tu ciclo» con la rueda de fases, configuración en Perfil,
 * nota en cada sesión y tarjeta de lo aprendido en Progreso.
 */
import { DAYS_L, addDays, daysBetween, dow, esc, fdLong, fdShort, today } from '../core/util.js';
import { save, state } from '../core/store.js';
import { regenerate } from '../model/adapt.js';
import { CYCLE_MODES, PHASES, addPeriodStart, cycle, cycleInsights, cycleLen, cycleOn, cycleNote, cycleSchedule, disableCycle, endPeriod, nextPeriod, periodLen, phaseOf, removePeriodStart, sensitiveDay, setupCycle } from '../model/cycle.js';
import { QUALITY } from '../model/constants.js';
import { $ } from './dom.js';
import { intPicker } from './pickers.js';
import { closeSheet, openSheet, route } from './router.js';
import { toast } from './toast.js';

/* ---------- rueda del ciclo ---------- */
function ring(p) {
  const L = p.len, P = cycle().mode === 'pildora' ? 0 : periodLen(), R = 40, C = 2 * Math.PI * R;
  const segs = cycle().mode === 'pildora'
    ? [['activa', 21], ['descanso', L - 21]]
    : [['regla', P], ['folicular', Math.max(0, L - 15 - P)], ['ovulacion', 3], ['lutea', Math.max(0, L - 4 - (L - 12))], ['premenstrual', 5]];
  // ajustar para que sumen L
  const tot = segs.reduce((t, s) => t + s[1], 0); segs[1][1] += L - tot;
  let off = 0;
  const arcs = segs.filter(s => s[1] > 0).map(([k, n]) => {
    const len = n / L * C, a = `<circle r="${R}" cx="50" cy="50" fill="none" stroke="${PHASES[k].c}" stroke-width="9" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)" opacity=".85"/>`;
    off += len; return a;
  }).join('');
  const ang = (Math.min(p.day, L) - 0.5) / L * 2 * Math.PI - Math.PI / 2, x = 50 + R * Math.cos(ang), y = 50 + R * Math.sin(ang);
  return `<svg viewBox="0 0 100 100" width="104" height="104" style="flex:0 0 104px;width:104px;height:104px" role="img" aria-label="Día ${p.day} de ${L} del ciclo">${arcs}
    <circle cx="${x}" cy="${y}" r="7" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/>
    <text x="50" y="47" text-anchor="middle" font-size="22" font-weight="700" fill="var(--ink)" class="num">${p.day}</text>
    <text x="50" y="63" text-anchor="middle" font-size="10" fill="var(--muted)">día</text></svg>`;
}

/** Tarjeta de Hoy. */
export function cycleCard() {
  const c = cycle(); if (!c || !c.on || c.mode === 'otro' || !state.plan) return '';
  const td = today(), p = phaseOf(td);
  if (!p) return `<section class="card stack" style="gap:8px"><span class="eyebrow">Tu ciclo</span>
    <p class="small">${c.starts.length ? 'Hace mucho que no registras la regla.' : 'Aún no sé cuándo fue tu última regla.'} Márcala cuando te baje y adapto el plan a tus fases.</p>
    <button type="button" class="primary" data-act="cycstart">${c.mode === 'pildora' ? 'Empiezo un blíster hoy' : 'Me ha bajado hoy'}</button></section>`;
  const ph = PHASES[p.phase], np = nextPeriod(td), late = p.late ? p.day - p.len - 1 : 0, due = !p.late && !p.projected && p.day === p.len + 1;
  const ses = state.sessions.find(s => s.date === td && s.status === 'pending');
  const hardToday = ses && (QUALITY.includes(ses.type) || ses.type === 'long') && ses.type !== 'race' && !ses.mod && p.inPeriod && p.day <= 2 && !(c.ok && c.ok[td]);
  let sub;
  if (late) sub = `Tu regla se retrasa ${late} día${late > 1 ? 's' : ''}. Los retrasos de unos días son normales; si es habitual o va a más, coméntalo con tu médico.`;
  else if (due) sub = c.mode === 'pildora' ? 'Hoy empieza tu blíster nuevo' : 'Tu regla debería llegar hoy';
  else if (p.inPeriod) sub = `${c.mode === 'pildora' ? 'Semana de descanso' : 'Regla'} · día ${p.day}`;
  else sub = np ? `Próxima regla hacia el ${DAYS_L[dow(np)]} ${fdShort(np)} (en ${daysBetween(td, np)} días)` : '';
  const btns = [];
  if (!p.inPeriod || late) btns.push(`<button type="button" class="${late ? 'primary' : 'ghost'}" data-act="cycstart">${c.mode === 'pildora' ? 'Empiezo un blíster hoy' : 'Me ha bajado hoy'}</button>`);
  if (p.inPeriod && c.mode !== 'pildora' && p.day >= 2 && !(c.ends && c.ends[p.start])) btns.push('<button type="button" class="ghost" data-act="cycend">Ya ha terminado</button>');
  return `<section class="card stack" style="gap:10px" id="cycle">
    <div class="row between"><span class="eyebrow">Tu ciclo</span><span class="chip" style="background:${ph.c}22;color:${ph.c};border-color:transparent">${ph.n}</span></div>
    <div class="row" style="gap:14px;align-items:center">${ring(p)}<div class="stack" style="gap:6px"><b class="small">${esc(sub)}</b><p class="small muted">${ph.e}</p></div></div>
    ${hardToday ? `<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:10px"><p class="small"><b>Hoy tienes una sesión exigente en tus primeros días de regla.</b> ¿Cómo te encuentras?</p>
      <div class="grid2"><button type="button" class="ghost" data-act="cycok">Bien, la hago</button><button type="button" class="primary" data-act="n100" data-id="${ses.id}" data-v="period">Mejor suave</button></div></div>` : ''}
    ${btns.length ? `<div class="${btns.length > 1 ? 'grid2' : 'stack'}">${btns.join('')}</div>` : ''}
  </section>`;
}

/** Nota de ciclo dentro de una sesión. */
export function cycleNoteHTML(s) {
  const n = cycleNote(s); if (!n) return '';
  const col = n.k === 'good' ? 'var(--good)' : n.k === 'soft' || n.k === 'moved' ? 'var(--warn)' : 'var(--muted)';
  return `<p class="small" style="border-left:3px solid ${col};padding:2px 0 2px 10px;margin:0"><b>${n.k === 'moved' ? 'Movida por tu ciclo. ' : 'Tu ciclo: '}</b>${esc(n.t)}</p>`;
}

/* ---------- Perfil ---------- */
export function cycleSection() {
  const c = cycle();
  if (!c || !c.on) return `<section class="card stack"><h3>Ciclo menstrual</h3>
    <p class="small muted">Opcional. Adapto el plan a tu ciclo: muevo las sesiones duras fuera de los días más delicados, te aviso de lo que puedes notar en cada fase y ajusto según tus síntomas. Con el tiempo aprendo cómo te sientan los entrenos en cada fase. Todo se queda en tu móvil.</p>
    <button type="button" data-act="cycopen">Activar</button></section>`;
  const td = today(), p = phaseOf(td), np = nextPeriod(td);
  const auto = c.mode === 'natural' && cycleLen() !== (c.len || 28);
  const rows = [['Situación', CYCLE_MODES[c.mode]]];
  if (c.mode === 'natural') rows.push(['Duración del ciclo', `${cycleLen()} días${auto ? ' (según tu historial)' : ''}`], ['Regla', `${periodLen()} días`]);
  if (np && c.mode !== 'otro') rows.push([c.mode === 'pildora' ? 'Próximo descanso' : 'Próxima regla', fdLong(np)]);
  if (c.mode !== 'otro') rows.push(['Adaptar el plan a las fases', c.adapt === false ? 'No' : 'Sí']);
  const starts = [...c.starts].reverse().slice(0, 6);
  return `<section class="card stack"><div class="row between"><h3>Ciclo menstrual</h3><button type="button" class="ghost addbtn" data-act="cycopen">Editar</button></div>
    <div>${rows.map(([a, b]) => `<div class="zrow"><span class="small muted">${a}</span><b class="small">${esc(b)}</b></div>`).join('')}</div>
    ${c.mode !== 'otro' ? `<div class="stack" style="gap:6px"><span class="small muted">${c.mode === 'pildora' ? 'Inicio de cada blíster' : 'Reglas registradas'}</span>
      ${starts.map(d => `<div class="zrow"><span class="small num">${fdLong(d)}${c.ends && c.ends[d] ? ` · ${daysBetween(d, c.ends[d]) + 1} días` : ''}</span><button type="button" class="linkb small" data-act="cycdel" data-v="${d}" aria-label="Borrar ${fdLong(d)}">Borrar</button></div>`).join('') || '<p class="small muted">Ninguna todavía.</p>'}
      <div class="row" style="gap:8px"><input type="date" id="cyc-add" max="${td}" aria-label="Añadir fecha" style="flex:1"><button type="button" data-act="cycadd">Añadir</button></div>
      <p class="hint">Puedes copiar aquí las fechas de tus últimas reglas desde Flo: con 2 o más aprendo la duración real de tu ciclo.</p></div>` : '<p class="small muted">Sin ciclo regular no uso fases: ajusto cada día según los síntomas que marques en el chequeo.</p>'}
    <button type="button" class="ghost" data-act="cycoff">Desactivar</button></section>`;
}

let cycDraft = null;
export function openCycle() {
  const c = cycle() || {}, mode = c.mode || 'natural';
  cycDraft = { mode, adapt: c.adapt !== false };
  const last = (c.starts || []).slice(-1)[0] || '';
  openSheet(`<div id="cycf" class="stack"><h2>Ciclo menstrual</h2>
    <div><label>Tu situación</label><div class="seg" role="radiogroup">${Object.entries(CYCLE_MODES).map(([k, n]) => `<button type="button" role="radio" data-act="cycmode" data-v="${k}" aria-pressed="${mode === k}">${n}</button>`).join('')}</div>
      <div class="hint" id="cyc-mhint">${modeHint(mode)}</div></div>
    <div data-cyc="natural pildora"><label for="cyc-last" id="cyc-lastl">${mode === 'pildora' ? 'Día que empezaste el blíster actual' : 'Primer día de tu última regla'}</label><input type="date" id="cyc-last" max="${today()}" value="${last}"></div>
    <div data-cyc="natural"><label>Duración habitual del ciclo</label>${intPicker('cyc-len', '', 21, 45, 1, c.len || 28, 'días')}<div class="hint">Desde el primer día de una regla hasta el día antes de la siguiente. Si no lo sabes, deja 28: lo aprendo de las fechas que registres.</div></div>
    <div data-cyc="natural"><label>Días de regla</label>${intPicker('cyc-plen', '', 2, 10, 1, c.plen || 5, 'días')}</div>
    <div data-cyc="natural pildora"><label>Adaptar el plan a las fases</label><div class="seg" role="radiogroup"><button type="button" role="radio" data-act="cycadapt" data-v="1" aria-pressed="${cycDraft.adapt}">Sí</button><button type="button" role="radio" data-act="cycadapt" data-v="0" aria-pressed="${!cycDraft.adapt}">No, solo avisos</button></div>
      <div class="hint">Muevo las series de tus 2 primeros días de regla y de los 2 previos a otro día de esa semana, y cualquier fase en la que aprenda que lo notas más.</div></div>
    <p class="err" id="cycerr" role="alert"></p>
    <div class="grid2"><button type="button" class="ghost" data-act="close">Cancelar</button><button type="button" class="primary" data-act="cycsave">Guardar</button></div></div>`);
  showModeFields();
}

function modeHint(m) {
  return m === 'natural' ? 'Sin anticonceptivos hormonales: uso las fases de tu ciclo.'
    : m === 'pildora' ? 'Las hormonas se mantienen estables; solo cuido los días de descanso.'
    : 'DIU hormonal, implante, lactancia, perimenopausia o menopausia: ajusto según tus síntomas de cada día.';
}

function showModeFields() {
  const m = cycDraft.mode;
  document.querySelectorAll('#cycf [data-cyc]').forEach(el => { el.hidden = !el.dataset.cyc.split(' ').includes(m); });
  const l = $('#cyc-lastl'); if (l) l.textContent = m === 'pildora' ? 'Día que empezaste el blíster actual' : 'Primer día de tu última regla';
  const h = $('#cyc-mhint'); if (h) h.textContent = modeHint(m);
}

export function cycleAction(a, t) {
  const td = today(), c = cycle();
  const snap = JSON.stringify(state);
  const done = (msg, undo = true) => { cycleSchedule(); save(); closeSheet(); route(); if (msg) toast(msg, undo ? { undo: snap } : undefined); };
  switch (a) {
    case 'cycopen': openCycle(); return;
    case 'cycmode': cycDraft.mode = t.dataset.v; t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); showModeFields(); return;
    case 'cycadapt': cycDraft.adapt = t.dataset.v === '1'; t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); return;
    case 'cycsave': {
      const last = $('#cyc-last').value;
      if (last && last > td) { $('#cycerr').textContent = 'La fecha no puede ser futura.'; return; }
      const wasOn = cycleOn();
      setupCycle({ mode: cycDraft.mode, last: cycDraft.mode === 'otro' ? null : last || null, len: +$('#cyc-len').value, plen: +$('#cyc-plen').value, adapt: cycDraft.adapt });
      if (state.plan) regenerate();
      return done(wasOn ? 'Ciclo actualizado.' : 'Listo: el plan ya tiene en cuenta tu ciclo.');
    }
    case 'cycstart': {
      if (!addPeriodStart(td)) { toast('Ya estaba apuntada.'); return; }
      if (c.mode !== 'pildora') c.lateAck = null;
      if (state.plan) regenerate();
      return done(c.mode === 'pildora' ? 'Blíster nuevo apuntado.' : 'Regla apuntada. He revisado las próximas sesiones.');
    }
    case 'cycend': endPeriod(td); return done('Apuntado el final de la regla.');
    case 'cycok': (c.ok = c.ok || {})[td] = true; Object.keys(c.ok).forEach(k => { if (k < addDays(td, -30)) delete c.ok[k]; }); return done('¡A por ella! Si cambias de idea, usa «No estoy al 100 %».', false);
    case 'cycdel': removePeriodStart(t.dataset.v); if (state.plan) regenerate(); return done('Fecha borrada.');
    case 'cycadd': {
      const v = $('#cyc-add').value;
      if (!v || v > td) { toast('Elige una fecha pasada.'); return; }
      if (!addPeriodStart(v)) { toast('Esa regla ya estaba apuntada.'); return; }
      if (state.plan) regenerate();
      return done('Fecha añadida.');
    }
    case 'cycoff':
      openSheet(`<div class="stack"><h2>Desactivar el ciclo</h2><p class="muted">El plan dejará de tener en cuenta tu ciclo.</p>
        <button type="button" class="primary" data-act="cycoff2" data-v="keep">Desactivar y guardar mis fechas</button>
        <button type="button" class="danger" data-act="cycoff2" data-v="wipe">Desactivar y borrar mis datos del ciclo</button>
        <button type="button" class="ghost" data-act="close">Cancelar</button></div>`); return;
    case 'cycoff2':
      disableCycle(t.dataset.v === 'wipe');
      state.sessions.forEach(s => { if (s.cyc) delete s.cyc; });
      if (state.plan) regenerate();
      return done(t.dataset.v === 'wipe' ? 'Datos del ciclo borrados.' : 'Ciclo desactivado.');
  }
}

/* ---------- Progreso: lo aprendido ---------- */
export function cycleInsightCard() {
  const c = cycle(); if (!c || !c.on || c.mode === 'otro') return '';
  const ins = cycleInsights();
  const order = c.mode === 'pildora' ? ['activa', 'descanso'] : ['regla', 'folicular', 'ovulacion', 'lutea', 'premenstrual'];
  if (!ins || !ins.ready) return `<section class="card stack" style="gap:6px"><h3>Tu ciclo y tus entrenos</h3>
    <p class="small muted">Comparo cómo de duro notas cada sesión (el esfuerzo que marcas) en cada fase. ${c.starts.length < 2 ? 'Necesito al menos dos reglas registradas' : `Llevo ${ins ? ins.n : 0} sesiones; con unas 6 empiezo a ver tu patrón`}.</p></section>`;
  const rows = order.filter(k => ins.phases[k]).map(k => {
    const g = ins.phases[k], w = Math.min(1, Math.abs(g.ex) / 2.5) * 50;
    const txt = Math.abs(g.ex) < 0.3 ? 'como siempre' : `${g.ex > 0 ? '+' : '−'}${Math.abs(g.ex).toFixed(1).replace('.', ',')} de esfuerzo`;
    return `<div class="stack" style="gap:4px;padding:6px 0"><div class="row between small"><span>${PHASES[k].n}${g.harder ? ' · <b>lo notas más</b>' : ''}</span><span class="muted num">${txt} · ${g.n} ses.</span></div>
      <div style="position:relative;height:8px;background:var(--line);border-radius:4px"><i style="position:absolute;top:0;bottom:0;${g.ex >= 0 ? 'left:50%' : `right:50%`};width:${w}%;background:${PHASES[k].c};border-radius:4px"></i><i style="position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:var(--muted)"></i></div></div>`;
  }).join('');
  const harder = order.filter(k => ins.phases[k] && ins.phases[k].harder).map(k => PHASES[k].n.toLowerCase());
  return `<section class="card stack" style="gap:6px"><h3>Tu ciclo y tus entrenos</h3>
    <p class="small muted">Esfuerzo que marcas frente a lo normal en ese tipo de sesión. A la derecha, más duro.</p>${rows}
    <p class="small ${harder.length ? '' : 'muted'}">${harder.length ? `En ${harder.join(' y ')} sueles notar más los entrenos: ${c.adapt === false ? 'si activas «Adaptar el plan a las fases», moveré ahí los rodajes.' : 'ahí coloco rodajes en vez de series cuando puedo.'}` : 'De momento no veo que ninguna fase te afecte de forma clara: el plan sigue igual en todas.'}</p></section>`;
}
