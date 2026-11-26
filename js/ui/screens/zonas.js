/**
 * Pantalla de zonas de ritmo y pulso.
 */
import { esc, fdShort, fp, ft } from '../../core/util.js';
import { state } from '../../core/store.js';
import { HR_Z, hrBounds, hrSource, paceR } from '../../model/workouts.js';
import { goalInfo, raceTime } from '../../model/goal.js';
import { hrMaxAge, hrMaxNow } from '../../model/activities.js';
import { easyByHR, z2Pace } from '../../model/easyhr.js';
import { app } from '../dom.js';

/* =========================================================
   Zonas
   ========================================================= */
export function paceZones(){
  const p=state.fitness.p,pr=state.profile,h=easyByHR({lo:p*1.25,hi:p*1.40});
  const z=[
    ['Recuperación',Math.max(p*1.40,h?h.lo*1.06:0),Math.max(p*1.52,h?h.hi*1.06:0),'Días muy suaves y vuelta a la calma'],
    h?['Suave',h.lo,h.hi,'Ajustado a tu pulso para no salir de Z2']:['Suave',p*1.25,p*1.40,'La mayoría de los km: rodajes y tiradas'],
    ['Maratón',raceTime(p,42.195)/42.195*0.99,raceTime(p,42.195)/42.195*1.01,'Ritmo sostenible durante horas'],
    ['Media maratón',raceTime(p,21.0975)/21.0975*0.99,raceTime(p,21.0975)/21.0975*1.01,''],
    ['Umbral',p*1.05,p*1.09,'Tempo: exigente pero controlado'],
    ['10 km',raceTime(p,10)/10*0.99,raceTime(p,10)/10*1.01,''],
    ['5 km',p*0.985,p*1.015,'Series largas'],
    ['Series cortas',p*0.94,p*0.97,'200–400 m y rectas']
  ];
  const gi=state.plan?goalInfo():null;
  if(gi) z.push([`Tu objetivo (${gi.g.name})`,gi.target/gi.g.dist,gi.target/gi.g.dist,`${ft(gi.target)} en meta`]);
  return z;
}

export function renderZonas(){
  const meas=(state.hrm&&state.hrm.max)||(state.strava&&state.strava.hrMax)||null,est=hrMaxAge();
  const hm=hrMaxNow(),src=state.profile.hrMax?'la que pusiste en tu perfil':state.strava&&state.strava.hrMaxUser?'la de tu perfil de Strava':meas&&(!est||meas>=est)?'la más alta medida en tus carreras':est&&meas?`estimada por tu edad (lo más alto que has medido es ${meas} ppm; si nunca has ido a tope, tu máxima real será más alta)`:est?'estimada por tu edad':'';
  const z2=z2Pace();
  const hs=hrSource(),H=state.hrm||{};
  const lastFit=[...state.fitness.history].reverse().find(h=>h.why);
  app.innerHTML=`<div class="stack-lg"><header class="stack" style="gap:6px"><div class="lanes" aria-hidden="true"></div><a href="#progreso" class="small" style="color:var(--accent);font-weight:600">‹ Progreso</a><h1>Tus zonas</h1>
    <p class="muted">Se recalculan solas con lo que mides en cada entreno: tests, carreras, series, tempos y la relación entre tu pulso y tu ritmo en los rodajes.</p></header>
    <section class="card stack" style="gap:6px"><span class="eyebrow">Tu forma ahora</span><div class="row between"><span>5 km estimado</span><b class="num zv">${ft(state.fitness.p*5)}</b></div>
      ${lastFit?`<p class="small muted">Última actualización: ${fdShort(lastFit.date)}. ${esc(lastFit.why)}.</p>`:'<p class="small muted">Aún sin actualizaciones: saldrán de tus próximos entrenos.</p>'}
      ${H.lthr?`<div class="row between"><span>Umbral de pulso</span><b class="num zv">${H.lthr} ppm</b></div><p class="small muted">Medido con tu ${esc(H.label)} del ${fdShort(H.date)}.</p>`:''}</section>
    <section class="card stack" style="gap:0"><h3 style="margin-bottom:6px">Ritmo</h3>${paceZones().map(([n,lo,hi,t])=>`<div class="zrow"><div><b>${n}</b>${t?`<br><span class="small muted">${t}</span>`:''}</div><span class="num zv">${paceR(lo,hi)} /km</span></div>`).join('')}</section>
    <section class="card stack" style="gap:0"><h3 style="margin-bottom:6px">Pulso</h3>
      ${hrBounds(1)?HR_Z.map(z=>{const b=hrBounds(z.n);return `<div class="zrow"><div><b>Z${z.n} · ${z.name}</b></div><span class="num zv">${z.n===1?`<${b[1]}`:!b[1]?`>${b[0]}`:`${b[0]}–${b[1]}`} ppm</span></div>`;}).join('')+`<p class="small muted" style="margin-top:8px">${hs==='lthr'?`Calculadas sobre tu umbral de pulso medido (${H.lthr} ppm). Se actualizan cuando hagas un tempo, un test o una carrera con pulsómetro.`:hs==='strava'?'Son tus zonas personalizadas de Strava. Cuando hagas un tempo, un test o una carrera con pulsómetro, las calcularé con tu umbral medido.':`Con una FC máxima de ${hm} ppm (${src}). Cuando hagas un tempo, un test o una carrera con pulsómetro, las calcularé con tu umbral medido.`}</p>`
      :'<p class="small muted">Pon tu FC máxima o tu edad en Perfil (o conecta Strava) para ver tus zonas de pulso.</p>'}
      ${z2?`<div class="zrow" style="border-top:1px solid var(--line);margin-top:6px"><div><b>Tu ritmo en Z2</b><br><span class="small muted">Según tu pulso en ${z2.n} rodajes de las últimas 6 semanas${z2.over?` (en ${z2.over} pasaste de Z2)`:''}</span></div><span class="num zv">≈ ${fp(z2.pace)} /km</span></div><p class="small muted">Si es más lento que tu ritmo suave, los rodajes y las tiradas se ponen a este ritmo. Se recalcula con cada rodaje que sincronizas.</p>`:''}</section>
    <section class="card stack"><h3>Cómo usarlas</h3><p class="small">El 80 % de los kilómetros deberían ir en zona suave. Si el ritmo y el pulso no cuadran (calor, cuestas, cansancio), manda el pulso en los días suaves y el ritmo en las series.</p></section></div>`;
}
