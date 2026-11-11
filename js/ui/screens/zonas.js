/**
 * Pantalla de zonas de ritmo y pulso.
 */
import { esc, fdShort, ft } from '../../core/util.js';
import { state } from '../../core/store.js';
import { HR_Z, hrBounds, hrSource, paceR } from '../../model/workouts.js';
import { goalInfo, raceTime } from '../../model/goal.js';
import { hrMaxNow } from '../../model/activities.js';
import { app } from '../dom.js';

/* =========================================================
   Zonas
   ========================================================= */
export function paceZones(){
  const p=state.fitness.p,pr=state.profile;
  const z=[
    ['Recuperación',p*1.40,p*1.52,'Días muy suaves y vuelta a la calma'],
    ['Suave',p*1.25,p*1.40,'La mayoría de los km: rodajes y tiradas'],
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
  const hm=hrMaxNow(),src=state.profile.hrMax?'la que pusiste en tu perfil':state.hrm&&state.hrm.max?'la más alta medida en tus carreras':state.strava&&state.strava.hrMax?'la más alta registrada en Strava':state.profile.age?'estimada por tu edad':'';
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
      :'<p class="small muted">Pon tu FC máxima o tu edad en Perfil (o conecta Strava) para ver tus zonas de pulso.</p>'}</section>
    <section class="card stack"><h3>Cómo usarlas</h3><p class="small">El 80 % de los kilómetros deberían ir en zona suave. Si el ritmo y el pulso no cuadran (calor, cuestas, cansancio), manda el pulso en los días suaves y el ritmo en las series.</p></section></div>`;
}
