/**
 * Pantalla «Hoy» y detalle de una sesión.
 */
import { DAYS, addDays, daysBetween, dow, esc, fdLong, fdShort, fk, fp, ft, monday, pd, today } from '../../core/util.js';
import { GOALS, PHASE_N, QUALITY, TYPES } from '../../model/constants.js';
import { state, stravaOn } from '../../core/store.js';
import { describe } from '../../model/workouts.js';
import { MOD_N } from '../../model/readiness.js';
import { strengthToday } from '../../model/strength.js';
import { curWeek } from '../../model/adapt.js';
import { activities } from '../../model/activities.js';
import { inactive, moveOptions } from '../../model/calendar.js';
import { wxRefresh } from '../../services/weather.js';
import { syncLine } from '../../services/strava.js';
import { app, layer } from '../dom.js';
import { blocksHTML } from '../blocks.js';
import { analysisHTML, goalCard, pauseCard, summaryCard } from '../cards.js';
import { checkinCard } from '../checkin.js';
import { strengthRow } from '../strength.js';
import { lastTab, openSheet, route } from '../router.js';
import { RPE_OPTS } from '../actions.js';
import { refOfSession } from '../../model/shoes.js';
import { shoeAlertCard, shoeSetHTML } from '../shoes.js';
import { cycleCard, cycleNoteHTML } from '../cycle.js';
import { xtIn } from '../../model/xtrain.js';
import { xtRow, xtWeekText } from '../xtrain.js';

export function chipFor(s){const t=TYPES[s.type];return `<span class="chip ${t.c}">${t.k}</span>`;}

/* ---------- Hoy ---------- */
export function renderHoy(){
  if(state.profile&&state.profile.city) wxRefresh().then(ch=>{if(ch&&lastTab==='hoy'&&!layer.querySelector('.sheet-bg'))route();});
  const td=today(),pr=state.profile,cw=curWeek(),plan=state.plan,c=plan.curve[cw];
  const g=GOALS[pr.goal];
  const tdS=state.sessions.filter(s=>s.date===td&&!inactive(s));
  const next=state.sessions.find(s=>s.status==='pending'&&s.date>td);
  const race=state.sessions.find(s=>s.type==='race'&&s.status==='pending');
  const ended=cw>=plan.curve.length||(!next&&!tdS.some(s=>s.status==='pending')&&state.sessions.every(s=>s.status!=='pending'));
  const mon=monday(td);
  const wkDays=[...Array(7)].map((_,k)=>{const d=addDays(mon,k);const ss=state.sessions.filter(s=>s.date===d);
    const s=ss.find(x=>x.status==='done')||ss.find(x=>x.status==='pending')||ss[0];
    let cls='r',lbl='·';
    if(s){lbl=s.status==='done'?'✓':s.status==='skipped'?'×':s.status==='paused'?'P':s.status==='rested'?'D':(s.type==='long'?'L':QUALITY.includes(s.type)?'C':'S');cls=s.status==='done'?'d':inactive(s)?'s':(QUALITY.includes(s.type)?'pq':'p');}
    return `<div class="wd ${d===td?'today':''}"><span>${DAYS[k]}</span><span class="dot ${cls}" aria-label="${s?TYPES[s.type].n+', '+({done:'hecha',skipped:'no hecha',pending:'pendiente',paused:'en pausa',rested:'descanso'}[s.status]):'descanso'}">${lbl}</span><span class="num">${pd(d).getDate()}</span></div>`;}).join('');
  const kmDone=activities().filter(a=>a.date>=mon&&a.date<=addDays(mon,6)).reduce((a,x)=>a+x.km,0);
  const kmPlan=state.sessions.filter(s=>s.date>=mon&&s.date<=addDays(mon,6)&&!inactive(s)).reduce((a,s)=>a+(s.status==='done'?(s.log?.km||s.km):s.km),0);
  const toRate=state.sessions.filter(s=>s.status==='done'&&s.log&&s.log.needsFeel&&daysBetween(s.date,td)<=7);
  const feelCard=toRate.length?`<section class="card stack"><h3>¿Cómo te sentiste?</h3><p class="small muted">Estas carreras llegaron de Strava sin tu valoración. Es el dato que más uso para adaptar el plan.</p>${toRate.map(s=>`<div class="stack" style="gap:6px"><div class="row between"><b>${(s.snap&&s.snap.title)||TYPES[s.type].n}</b><span class="small muted">${fdShort(s.date)} · ${fk(s.log.km)} km</span></div><div class="feel" role="group" aria-label="Esfuerzo">${RPE_OPTS.map(([v,l])=>`<button type="button" data-act="rate" data-id="${s.id}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}</section>`:'';
  const stravaBar=stravaOn()?`<div class="syncbar"><span id="syncline">${syncLine()}</span><button type="button" data-act="sync">Sincronizar</button></div>`
    :`<a href="#perfil" class="card row between" style="text-decoration:none;color:inherit;padding:12px 14px"><span class="small"><b>Conecta Strava</b> para importar las carreras y ajustar el plan solo.</span><span style="color:#FC5200;font-weight:700">›</span></a>`;
  let main='';
  if(state.pause){
    main=pauseCard();
  }else if(ended){
    main=`<section class="hero stack"><span class="eyebrow">Plan completado</span><h2>Has terminado este bloque</h2><p class="muted">Crea el siguiente bloque: partirá de tu forma actual (${ft(state.fitness.p*5)} en 5 km) y de tu volumen de las últimas semanas.</p><button class="primary" data-act="newblock">Crear siguiente bloque</button></section>`;
  }else if(tdS.length){
    main=tdS.map(s=>sessionCard(s,true)).join('');
  }else{
    main=`<section class="hero stack"><span class="eyebrow">Hoy</span><h2>Descanso</h2><p class="muted">El descanso es parte del entrenamiento: es cuando el cuerpo se adapta.</p>${next?`<div class="card stack" style="padding:12px"><div class="row between"><span class="small muted">Próxima sesión · ${fdLong(next.date)}</span>${chipFor(next)}</div><div class="row between"><b>${describe(next).title}</b><span class="num">${next.type==='runwalk'?describe(next).dur+' min':fk(next.km)+' km'}</span></div><button class="ghost" data-act="open" data-id="${next.id}">Ver detalles</button></div>`:''}</section>`;
  }
  const ev=state.adapt.events[0];
  app.innerHTML=`<div class="stack-lg">
    <header class="stack" style="gap:8px">
      <div class="lanes" aria-hidden="true"></div>
      <span class="eyebrow">${fdLong(td)}</span>
      <h1>${pr.name?`Hola, ${esc(pr.name.split(' ')[0])}`:'Tu entrenamiento'}</h1>
      <div class="row wrap" style="gap:6px">${c?`<span class="chip">Semana ${cw+1} de ${plan.curve.length}</span><span class="chip">${PHASE_N[c.phase]}</span>${c.down?'<span class="chip ok">Semana de descarga</span>':''}`:''}${race?`<span class="chip q">${(n=>n===0?`${g.name}: ¡hoy es el día!`:n===1?`${g.name} mañana`:`${g.name} en ${n} días`)(daysBetween(td,race.date))}</span>`:''}</div>
    </header>
    ${stravaBar}
    <section class="stack" style="gap:8px"><div class="row between"><h3>Esta semana</h3><button type="button" class="ghost addbtn" data-act="addrun" aria-label="Añadir entreno">+ Añadir entreno</button></div><div class="row between" style="margin-top:-4px"><span class="small muted num">${fk(kmDone)} de ${fk(kmPlan)} km</span>${(t=>t?`<span class="small muted">${t}</span>`:'')(xtWeekText(mon))}</div><div class="week">${wkDays}</div></section>
    ${feelCard}
    ${checkinCard()}
    ${cycleCard()}
    ${main}
    ${(x=>x?`<div class="list card" style="padding:0 14px">${strengthRow(x)}</div>`:'')(strengthToday())}
    ${(l=>l.length?`<div class="list card" style="padding:0 14px">${l.map(xtRow).join('')}</div>`:'')(xtIn(td,td))}
    ${shoeAlertCard()}
    ${summaryCard(true)}
    ${goalCard()}
    ${ev?`<section class="card stack" style="gap:6px"><span class="eyebrow">Último ajuste del plan · ${fdShort(ev.date)}</span><p>${esc(ev.text)}</p><a href="#progreso" class="small" style="color:var(--accent);font-weight:600">Ver todos los ajustes</a></section>`:''}
  </div>`;
}

/* ---------- Plan ---------- */
export function sessionCard(s,isToday){
  const d=describe(s),st=s.status,td=today();
  const showLog=st==='pending'&&s.date<=td&&!state.pause;
  const timeBased=['runwalk','fartlek','cuestas'].includes(s.type);
  const head=`<div class="row between"><span class="eyebrow">${isToday?'Hoy':fdLong(s.date)}${s.cyc&&!s.cyc.swap?' · movida por tu ciclo':s.moved||s.manual?' · cambiada de día':''}${s.converted?' · ajustada':''}</span>${chipFor(s)}</div>
    <h2>${d.title}</h2>
    <div class="row" style="gap:20px;align-items:flex-end">
      <div><span class="big num">${timeBased?d.dur:fk(s.km)}</span><span class="unit">${timeBased?'min':'km'}</span></div>
      <div class="small muted num" style="padding-bottom:4px">${timeBased?`≈ ${fk(d.estKm)} km`:`≈ ${d.dur} min`}<br>esfuerzo ${d.rpe}/10</div>
    </div>${d.wx&&st==='pending'?`<span class="small muted">${Math.round(d.wx.t)} °C a tu hora${d.wx.adj>0?` · ritmos +${(d.wx.adj*100).toFixed(1).replace('.',',')} % por calor`:''}</span>`:''}${s.mod&&st==='pending'?`<span class="chip w" style="align-self:flex-start">Ajustada: ${MOD_N[s.mod.kind]}</span>`:''}`;
  const plan=`${blocksHTML(d)}${d.tips.length?`<ul class="steps small">${d.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}`;
  let body='';
  if(st==='done'){
    body=`<div class="stack" style="gap:6px"><div class="row between"><span class="chip ok">Hecha${s.log.strava?' · Strava':''}</span><span class="small muted num">${s.log.km?fk(s.log.km)+' km':''}${s.log.time?' · '+ft(s.log.time):''}${s.log.km&&s.log.time?' · '+fp(s.log.time/s.log.km)+' /km':''}</span></div>
      <span class="small muted num">${s.log.hr?Math.round(s.log.hr)+' ppm de media · ':''}esfuerzo ${s.log.rpe}/10${s.log.rpeSrc==='fc'?' (estimado por pulso)':s.log.rpeSrc==='previsto'?' (sin valorar)':''}</span>
      ${s.log.strava?`<a class="small" style="color:#FC5200;font-weight:600" href="https://www.strava.com/activities/${s.log.strava}" target="_blank" rel="noopener">Ver en Strava</a>`:''}</div>
      ${analysisHTML(s)}
      <details class="adv"><summary>Ver el entreno previsto</summary>${plan}</details>`;
  }else{
    body=cycleNoteHTML(s)+plan+(st==='skipped'?'<span class="chip">No realizada</span>':st==='paused'?'<span class="chip">En pausa</span>':st==='rested'?'<span class="chip">Descanso</span>':'');
  }
  return `<section class="hero stack">${head}${body}
    ${showLog&&stravaOn()?'<p class="small muted">Si la grabas con el reloj, se registrará sola al sincronizar con Strava.</p>':''}
    ${showLog?`<div class="grid2"><button class="ghost" data-act="skip" data-id="${s.id}">No he podido</button><button class="primary" data-act="log" data-id="${s.id}">Registrar</button></div>`:''}
    ${st==='pending'&&s.type!=='race'&&!s.mod&&!state.pause?`<button type="button" class="linkb small" style="align-self:flex-start" data-act="n100open" data-id="${s.id}">No estoy al 100 %</button>`:''}
  </section>`;
}

export function moveHTML(s){
  const opts=moveOptions(s);if(!opts.length) return '';
  const td=today();
  return `<section class="card stack" style="gap:8px"><h3>Cambiar de día</h3>
    <div class="seg" role="group">${opts.map(o=>`<button type="button" data-act="move" data-id="${s.id}" data-d="${o.d}" aria-pressed="${o.cur}" ${o.blocked?'disabled':''}>${o.d===td?'Hoy':DAYS[dow(o.d)]+' '+pd(o.d).getDate()}${o.other&&!o.cur?` · ${TYPES[o.other.type].k.toLowerCase()}`:''}</button>`).join('')}</div>
    <p class="small muted">Si el día elegido ya tiene sesión, se intercambian. Para cambiar tus días habituales, ve a Perfil.</p></section>`;
}

export function openSession(id){
  const s=state.sessions.find(x=>x.id===id);if(!s)return;
  openSheet(`<div class="stack">${sessionCard(s,s.date===today())}${s.status==='pending'?moveHTML(s):''}
    ${s.status==='pending'&&s.date>today()?`<button class="ghost" data-act="skip" data-id="${s.id}">Sé que no podré hacerla</button>`:''}
    ${s.status==='done'?shoeSetHTML(refOfSession(s)):''}
    ${s.status==='done'?`<button class="ghost" data-act="unlog" data-id="${s.id}">${s.log&&s.log.strava?'Desvincular de Strava':'Borrar registro'}</button>`:''}
    <div class="grid2"><a class="btn" href="#zonas" data-act="close" style="text-align:center;text-decoration:none">Ver mis zonas</a><button class="ghost" data-act="close">Cerrar</button></div></div>`);
}
