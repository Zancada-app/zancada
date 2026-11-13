/**
 * Pantalla del entreno guiado: preparación (GPS o cinta), seguimiento en directo con voz, bloqueo de
 * pantalla, recuperación si el móvil cierra la app, resumen final y ajustes en Perfil.
 */
import { esc, fk, fp, ft, today } from '../core/util.js';
import { save, state, sv } from '../core/store.js';
import { logDone } from '../model/adapt.js';
import { buildSteps, finishText, kmh, midPace, paceCheck, sayDist, sayTime, stepCues, stepDone, stepIntro } from '../model/guide.js';
import { describe } from '../model/workouts.js';
import { Track, keepAwake, releaseAwake, startGps, stopGps, toGpx } from '../services/gps.js';
import { speak, stopVoice, voiceAvailable } from '../services/voice.js';
import { canUpload, stravaConnect, uploadGpx } from '../services/strava.js';
import { $, layer } from './dom.js';
import { RPE_OPTS } from './actions.js';
import { closeSheet, openSheet, route } from './router.js';
import { toast } from './toast.js';

const KEY = 'zancada.guide';
export const guidePrefs = () => state.guide || (state.guide = { rec: 'watch', upload: false });

let G = null;          // entreno en curso
let setupMode = 'gps';
let timer = null, gpsOff = null, hiddenAt = 0;

/* ---------- preparación ---------- */
export function openGuideSetup(id) {
  const s = state.sessions.find(x => x.id === id); if (!s) return;
  const d = describe(s);
  const stepsG = buildSteps(s, 'gps'), nWork = stepsG.filter(x => x.kind === 'main' && x.reps > 1).length;
  openSheet(`<div class="stack" id="gsetup"><span class="eyebrow">Entreno guiado</span><h2>${esc(d.title)}</h2>
    <p class="muted">${stepsG.length} partes${nWork ? ` · ${nWork} repeticiones` : ''} · unos ${d.dur} min. Te iré diciendo por los cascos cada parte, el ritmo y cuándo cambiar.</p>
    <div><label>¿Dónde corres?</label><div class="seg"><button type="button" data-act="gmode" data-v="gps" aria-pressed="${setupMode === 'gps'}">Al aire libre</button><button type="button" data-act="gmode" data-v="cinta" aria-pressed="${setupMode === 'cinta'}">En cinta</button></div>
      <div class="hint" id="gmodehint">${modeHint()}</div></div>
    <div class="card stack" style="gap:6px;padding:12px"><b class="small">Antes de salir</b>
      <ul class="steps small"><li>Lleva el móvil con <b>Zancada abierta y la pantalla encendida</b> (en el brazalete o la riñonera). Si el iPhone se bloquea, el GPS y la voz se paran: al volver a la app, sigo donde lo dejaste. Con «Bloquear» la pantalla se queda en negro y no se toca sin querer.</li>
      <li>${guidePrefs().rec === 'app' ? 'Zancada grabará la carrera y la apuntará como hecha.' : 'Sigue grabando con tu reloj: la carrera llegará por Strava como siempre. Yo solo te guío.'}</li>
      <li>Puedes llevar música: al hablar, el iPhone la baja o la pausa un momento, según la app de música.</li></ul></div>
    ${voiceAvailable() ? '' : '<p class="err">Este navegador no tiene voz: verás las indicaciones en pantalla.</p>'}
    <div class="grid2"><button type="button" class="ghost" data-act="gvoice">Probar la voz</button><button type="button" class="primary" data-act="gstart" data-id="${s.id}">Empezar</button></div>
    <button type="button" class="ghost" data-act="close">Cancelar</button></div>`);
}

function modeHint() {
  return setupMode === 'gps' ? 'Uso el GPS del móvil para la distancia y el ritmo.'
    : 'Todo por tiempo: te digo a qué velocidad poner la cinta en cada parte.';
}

export function setGuideMode(t) {
  setupMode = t.dataset.v;
  t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
  const h = $('#gmodehint'); if (h) h.textContent = modeHint();
}

export function testVoice() {
  if (!voiceAvailable()) { toast('Este navegador no tiene voz.'); return; }
  speak('Hola. Así sonarán los avisos: serie de 400 metros a 5 30 el kilómetro.', true);
}

/* ---------- en marcha ---------- */
const now = () => Date.now();
const elapsed = (t = now()) => G ? (t - G.t0 - G.pausedMs - (G.pauseAt ? t - G.pauseAt : 0)) / 1000 : 0;
function distKm() {
  if (!G) return 0;
  if (G.mode === 'gps') return G.track.dist / 1000;
  const st = G.steps[G.i], p = st && midPace(st), t = elapsed() - G.stepStartT;
  return G.cintaKm + (st && st.kind !== 'rec' && p ? t / p : st && st.kind === 'rec' && st.walk ? t / 600 : st && st.kind === 'rec' ? t / 450 : 0);
}

export function startGuide(id, resume) {
  const s = state.sessions.find(x => x.id === id); if (!s) return;
  const mode = resume ? resume.mode : setupMode;
  const steps = buildSteps(s, mode);
  if (!steps.length) { toast('Esta sesión no tiene partes que guiar.'); return; }
  G = { sid: id, mode, steps, i: 0, t0: now(), pausedMs: 0, pauseAt: null, stepStartT: 0, stepStartDist: 0, cintaKm: 0,
    track: new Track(), marks: {}, kmDone: 0, kmT: 0, lastSplit: null, outSince: null, lastAlert: null, gpsAcc: null, gpsErr: null,
    rec: [], done: false, n: 0, title: describe(s).title, lockTimer: null };
  if (resume) {
    Object.assign(G, { i: resume.i, t0: resume.t0, pausedMs: resume.pausedMs, pauseAt: resume.pauseAt || resume.at, stepStartT: resume.stepStartT,
      stepStartDist: resume.stepStartDist, cintaKm: resume.cintaKm || 0, marks: resume.marks || {}, kmDone: resume.kmDone || 0, kmT: resume.kmT || 0,
      track: new Track(resume.track), rec: resume.rec || [] });
  }
  closeSheet(true);
  // la primera frase tiene que salir de este toque para que el iPhone deje hablar
  speak(resume ? 'Entreno recuperado. Toca seguir cuando estés listo.' : stepIntro(G.steps, 0, G.mode), true);
  if (G.mode === 'gps') gpsOff = startGps(onPoint, e => { G && (G.gpsErr = e.code === 1 ? 'Sin permiso de ubicación: actívalo en Ajustes › Privacidad › Localización › Safari.' : 'Sin señal GPS.'); });
  keepAwake();
  document.addEventListener('visibilitychange', onVis);
  renderScreen();
  timer = setInterval(tick, 1000);
  persist();
}

function onPoint(p) {
  if (!G || G.done) return;
  G.gpsAcc = p.acc; G.gpsErr = null;
  if (G.pauseAt) { if (p.acc <= 35) G.track.last = p; return; } // en pausa no suma distancia
  if (G.track.add(p) && guidePrefs().rec === 'app') {
    const l = G.rec[G.rec.length - 1];
    if (!l || p.t - l.t >= 3000) G.rec.push({ lat: p.lat, lon: p.lon, ele: p.ele, t: p.t });
  }
}

function onVis() {
  if (!G || G.done) return;
  if (document.visibilityState === 'hidden') { hiddenAt = now(); return; }
  keepAwake();
  if (hiddenAt && now() - hiddenAt > 8000) speak('Seguimos.');
  hiddenAt = 0; tick();
}

function tick() {
  if (!G || G.done) return;
  if (G.pauseAt) { renderLive(); return; }
  const t = now(), el = elapsed(t), st = G.steps[G.i], stepT = el - G.stepStartT, sd = distKm() - G.stepStartDist;
  // parcial de cada kilómetro en tramos largos
  if (st.dist && st.dist >= 2 && st.reps <= 1) {
    const k = Math.floor(sd + 1e-6);
    if (k > G.kmDone) { G.lastSplit = (el - (G.kmT || G.stepStartT)) / Math.max(1, k - G.kmDone); G.kmT = el; G.kmDone = k; }
  }
  stepCues(st, { dist: sd, t: stepT, lastSplit: G.lastSplit }, G.marks).forEach(c => speak(c));
  if (G.mode === 'gps') {
    const pc = paceCheck(st, { pace: G.track.pace(t), outSince: G.outSince, lastAlert: G.lastAlert, now: t / 1000, stepT, count: G.marks.al || 0 });
    G.outSince = pc.outSince; G.lastAlert = pc.lastAlert; G.marks.al = pc.count; if (pc.say) speak(pc.say);
  }
  if (stepDone(st, { dist: sd, t: stepT })) nextStep();
  renderLive();
  if (++G.n % 5 === 0) persist();
}

function nextStep() {
  const el = elapsed();
  if (G.mode === 'cinta') G.cintaKm = distKm();
  G.i++;
  if (G.i >= G.steps.length) { finishGuide(); return; }
  G.stepStartT = el; G.stepStartDist = distKm(); G.marks = {}; G.kmDone = 0; G.kmT = el; G.outSince = null; G.lastSplit = null;
  speak(stepIntro(G.steps, G.i, G.mode), true);
  persist();
}

export function guideAction(a) {
  if (!G) return;
  if (a === 'gpause') {
    if (G.pauseAt) { G.pausedMs += now() - G.pauseAt; G.pauseAt = null; speak('Seguimos.', true); }
    else { G.pauseAt = now(); speak('En pausa.', true); }
    persist(); renderLive();
  } else if (a === 'gskip') { nextStep(); renderLive(); }
  else if (a === 'gend') {
    const b = $('#gend');
    if (b && b.dataset.sure) finishGuide(true);
    else if (b) { b.dataset.sure = '1'; b.textContent = '¿Terminar? Toca otra vez'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Terminar'; } }, 3000); }
  } else if (a === 'glock') {
    const l = document.createElement('div'); l.id = 'glock'; l.innerHTML = '<p>Mantén pulsado para desbloquear</p>';
    let tm = null;
    const down = () => { l.classList.add('hold'); tm = setTimeout(() => { l.remove(); }, 900); };
    const up = () => { l.classList.remove('hold'); clearTimeout(tm); };
    l.addEventListener('pointerdown', down); l.addEventListener('pointerup', up); l.addEventListener('pointercancel', up); l.addEventListener('pointerleave', up);
    document.body.appendChild(l);
  }
}

function finishGuide(early) {
  if (!G || G.done) return;
  if (G.mode === 'cinta') G.cintaKm = distKm();
  G.done = true; G.endT = elapsed(); G.km = G.mode === 'gps' ? G.track.dist / 1000 : G.cintaKm;
  clearInterval(timer); timer = null;
  if (gpsOff) { gpsOff(); gpsOff = null; } stopGps();
  releaseAwake(); document.removeEventListener('visibilitychange', onVis);
  try { localStorage.removeItem(KEY); } catch (e) {}
  speak(early ? 'Entrenamiento terminado antes de tiempo.' : finishText(G.km, G.endT), true);
  renderSummary(early);
}

function persist() {
  if (!G || G.done) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ sid: G.sid, mode: G.mode, i: G.i, t0: G.t0, pausedMs: G.pausedMs, pauseAt: G.pauseAt, stepStartT: G.stepStartT,
      stepStartDist: G.stepStartDist, cintaKm: G.cintaKm, marks: G.marks, kmDone: G.kmDone, kmT: G.kmT, track: G.track.save(), rec: G.rec.slice(-3000), at: now() }));
  } catch (e) {}
}

/* ---------- pantalla ---------- */
function stepAmount(st, sd, stepT) {
  if (st.dist) { const left = Math.max(0, st.dist - sd); return left >= 1 ? `${fk(left)} km` : `${Math.round(left * 1000 / 10) * 10} m`; }
  const left = Math.max(0, st.dur - stepT); return ft(left);
}
const target = (st, mode) => st.kind === 'rec' ? (st.walk ? 'Andando' : 'Suave') + (mode === 'cinta' && st.pace ? ` · ${String(kmh(st.pace)).replace('.', ',')} km/h` : '') : mode === 'cinta' && st.hillPace ? `Inclinación 6 % · ${String(kmh(st.hillPace)).replace('.', ',')} km/h` : st.lo && st.hi ? (mode === 'cinta' ? `${String(kmh(midPace(st))).replace('.', ',')} km/h` : `${fp(st.lo)}–${fp(st.hi)} /km`) : st.kind === 'strides' ? 'Rápido y relajado' : 'Por sensaciones';

function renderScreen() {
  let el = $('#guide');
  if (!el) { el = document.createElement('div'); el.id = 'guide'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Entreno guiado'); document.body.appendChild(el); }
  document.body.classList.add('guiding');
  el.innerHTML = `<div class="g-top"><span class="eyebrow">${esc(G.title)}</span><span class="small muted" id="g-pos"></span></div>
    <div class="g-main"><span class="g-label" id="g-label"></span><span class="g-target" id="g-target"></span><b class="g-left num" id="g-left"></b>
      <div class="bar g-bar"><i id="g-bar"></i></div><div class="g-pace"><span class="small muted" id="g-pacel"></span><b class="num" id="g-pace"></b></div></div>
    <div class="g-tot"><div><span class="small muted">Tiempo</span><b class="num" id="g-time"></b></div><div><span class="small muted">Distancia</span><b class="num" id="g-dist"></b></div></div>
    <p class="small muted g-next" id="g-next"></p><p class="small g-gps" id="g-gps"></p>
    <div class="g-btns"><button type="button" data-act="gpause" id="gpause" class="primary"></button><button type="button" data-act="gskip">Siguiente parte</button>
      <button type="button" data-act="glock">Bloquear</button><button type="button" data-act="gend" id="gend" class="danger">Terminar</button></div>`;
  renderLive();
}

function renderLive() {
  if (!G || G.done || !$('#guide')) return;
  const t = now(), el = elapsed(t), st = G.steps[G.i], stepT = el - G.stepStartT, sd = distKm() - G.stepStartDist;
  const set = (id, v) => { const e = $('#' + id); if (e && e.textContent !== v) e.textContent = v; };
  set('g-pos', `Parte ${G.i + 1} de ${G.steps.length}`);
  set('g-label', st.label); set('g-target', target(st, G.mode));
  set('g-left', stepAmount(st, sd, stepT));
  const frac = st.dist ? sd / st.dist : stepT / st.dur; const b = $('#g-bar'); if (b) b.style.width = Math.min(100, Math.max(0, frac * 100)) + '%';
  if (G.mode === 'gps') {
    const pc = G.track.pace(t); set('g-pacel', 'Ritmo actual'); set('g-pace', pc ? fp(pc) + ' /km' : '—');
    const pe = $('#g-pace'); if (pe) pe.className = 'num ' + (pc && st.lo && st.kind !== 'rec' ? (pc < st.lo - 5 ? 'fast' : pc > st.hi + 8 ? 'slow' : 'ok') : '');
  } else { set('g-pacel', st.kind === 'rec' ? '' : 'Cinta'); set('g-pace', st.kind !== 'rec' && midPace(st) ? `${String(kmh(midPace(st))).replace('.', ',')} km/h` : ''); }
  set('g-time', ft(el)); set('g-dist', `${fk(distKm())} km${G.mode === 'cinta' ? ' aprox.' : ''}`);
  const nx = G.steps[G.i + 1];
  set('g-next', nx ? `Después: ${nx.label}${nx.dist ? ' · ' + sayDist(nx.dist) : nx.dur ? ' · ' + sayTime(nx.dur) : ''}` : 'Es la última parte.');
  set('g-gps', G.mode !== 'gps' ? '' : G.gpsErr ? G.gpsErr : G.gpsAcc == null ? 'GPS: buscando señal…' : G.gpsAcc > 35 ? `GPS: señal débil (±${Math.round(G.gpsAcc)} m)` : `GPS: bien (±${Math.round(G.gpsAcc)} m)`);
  set('gpause', G.pauseAt ? 'Seguir' : 'Pausa');
}

function renderSummary(early) {
  const el = $('#guide'); if (!el) return;
  const s = state.sessions.find(x => x.id === G.sid), rec = guidePrefs().rec === 'app', km = G.km, sec = G.endT;
  const canSave = rec && s && s.status === 'pending' && km >= 0.3;
  el.innerHTML = `<div class="stack" style="gap:14px;max-width:520px;margin:0 auto;width:100%">
    <span class="eyebrow">${early ? 'Terminado antes de tiempo' : 'Entreno completado'}</span><h1>${esc(G.title)}</h1>
    <div class="tiles"><div class="tile"><div class="k">Distancia</div><div class="v num">${fk(km)} km</div>${G.mode === 'cinta' ? '<div class="k">aproximada</div>' : ''}</div>
      <div class="tile"><div class="k">Tiempo</div><div class="v num">${ft(sec)}</div>${km > 0.3 ? `<div class="k num">${fp(sec / km)} /km</div>` : ''}</div></div>
    <p class="small muted">${Math.min(G.i, G.steps.length)} de ${G.steps.length} partes hechas.</p>
    ${canSave ? `<div><label>¿Cómo te ha resultado?</label><div class="rpe" role="radiogroup" id="g-rpe">${RPE_OPTS.map(([v, l]) => `<button type="button" role="radio" data-act="grpe" data-v="${v}" aria-checked="false"><b>${v}</b>${l}</button>`).join('')}</div></div>
      ${guidePrefs().upload && G.mode === 'gps' ? `<p class="small muted">${canUpload() ? 'Al guardar, la subo también a Strava.' : sv().tokens ? 'Falta el permiso para subir a Strava: actívalo en Perfil › Entrenos guiados.' : 'Conecta Strava en Perfil para poder subirla.'}</p>` : ''}
      <p class="err" id="g-err" role="alert"></p>
      <button type="button" class="primary block" data-act="gsave">Guardar</button>`
    : `<p class="small">${rec ? (s && s.status !== 'pending' ? 'Esta sesión ya estaba registrada.' : 'Demasiado corta para guardarla.') : 'Tu reloj la habrá grabado: llegará por Strava y se apuntará sola al sincronizar.'}</p>`}
    <button type="button" class="${canSave ? 'ghost' : 'primary'} block" data-act="gclose">${canSave ? 'Salir sin guardar' : 'Cerrar'}</button></div>`;
}

export function pickGuideRpe(t) {
  t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === t)));
  G.rpe = +t.dataset.v;
}

export async function saveGuided() {
  if (!G || !G.done) return;
  if (!G.rpe) { const e = $('#g-err'); if (e) e.textContent = 'Elige cómo te ha resultado.'; return; }
  const s = state.sessions.find(x => x.id === G.sid);
  if (s && s.status === 'pending') {
    logDone(s, { rpe: G.rpe, km: Math.round(G.km * 100) / 100, time: Math.round(G.endT), notes: 'Entreno guiado con Zancada' + (G.mode === 'cinta' ? ' (cinta)' : '') });
    save();
  }
  const up = guidePrefs().upload && canUpload() && G.mode === 'gps' && G.rec.length > 10;
  const pts = G.rec, title = G.title;
  closeGuide();
  if (up) {
    toast('Guardado. Subiendo a Strava…');
    try { await uploadGpx(toGpx(pts, title), title + ' · Zancada'); toast('Subida a Strava.'); }
    catch (e) { toast(e.message); }
  } else toast('Entreno guardado.');
}

export function closeGuide() {
  if (G && !G.done) finishGuide(true);
  stopVoice();
  const el = $('#guide'); if (el) el.remove(); const l = $('#glock'); if (l) l.remove();
  document.body.classList.remove('guiding');
  G = null; route();
}

/* ---------- si el móvil cerró la app a mitad ---------- */
export function pendingGuide() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!g || now() - g.at > 3 * 3600e3) return null;
    const s = state.sessions.find(x => x.id === g.sid);
    return s && s.status === 'pending' ? { g, s } : null;
  } catch (e) { return null; }
}

export function resumeCard() {
  if (G) return '';
  const p = pendingGuide(); if (!p) return '';
  return `<section class="card stack" style="gap:8px;border-color:var(--accent)"><span class="eyebrow">Entreno guiado a medias</span>
    <p class="small">${esc(describe(p.s).title)}: ibas por la parte ${p.g.i + 1}. ¿Seguimos?</p>
    <div class="grid2"><button type="button" class="ghost" data-act="gdiscard">Descartar</button><button type="button" class="primary" data-act="gresume">Continuar</button></div></section>`;
}

export function resumeGuide() { const p = pendingGuide(); if (p) startGuide(p.s.id, p.g); }
export function discardGuide() { try { localStorage.removeItem(KEY); } catch (e) {} route(); }

export const guideActive = () => !!G;

/* ---------- botón en la sesión y ajustes ---------- */
export const guideButton = s => s.status === 'pending' && s.date === today() && !state.pause
  ? `<button type="button" class="guide-btn block" data-act="gopen" data-id="${s.id}"><span aria-hidden="true">▶</span> Empezar entrenamiento guiado</button>` : '';

export function guideSection() {
  const g = guidePrefs(), st = sv();
  return `<section class="card stack"><h3>Entrenos guiados</h3>
    <p class="small muted">En la sesión de hoy, «Empezar entrenamiento guiado» te va diciendo por los cascos cada parte, el ritmo y si vas rápido o lento.</p>
    <div><label>¿Quién graba la carrera?</label><div class="seg"><button type="button" data-act="grec" data-v="watch" aria-pressed="${g.rec !== 'app'}">Mi reloj (Strava)</button><button type="button" data-act="grec" data-v="app" aria-pressed="${g.rec === 'app'}">Zancada</button></div>
      <div class="hint">${g.rec === 'app' ? 'Zancada guarda la distancia, el tiempo y el recorrido, y apunta la sesión como hecha.' : 'Zancada solo te guía; la carrera llega desde el reloj por Strava.'}</div></div>
    ${g.rec === 'app' ? `<div><label>Subir a Strava</label><div class="seg"><button type="button" data-act="gup" data-v="0" aria-pressed="${!g.upload}">No</button><button type="button" data-act="gup" data-v="1" aria-pressed="${!!g.upload}">Sí</button></div>
      ${g.upload && st.tokens && !canUpload() ? '<p class="small">Falta darle permiso a Zancada para subir actividades.</p><button type="button" data-act="gperm">Dar permiso en Strava</button>' : ''}
      ${g.upload && !st.tokens ? '<p class="small muted">Conecta Strava para poder subirlas.</p>' : ''}</div>` : ''}
    <button type="button" class="ghost" data-act="gvoice">Probar la voz</button></section>`;
}

export function guidePref(a, t) {
  const g = guidePrefs();
  if (a === 'grec') g.rec = t.dataset.v;
  if (a === 'gup') g.upload = t.dataset.v === '1';
  if (a === 'gperm') { sv().wantWrite = true; save(); stravaConnect(); return; }
  save(); route();
}

