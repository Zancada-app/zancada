/**
 * Pantalla «Plan»: semanas desplegables y sesiones.
 */
import { DAYS, addDays, dow, fdShort, fk, fp, pd, today } from '../../core/util.js';
import { GOALS, PHASE_N } from '../../model/constants.js';
import { state } from '../../core/store.js';
import { describe, paceR } from '../../model/workouts.js';
import { strengthDays } from '../../model/strength.js';
import { curWeek } from '../../model/adapt.js';
import { analyze } from '../../model/analysis.js';
import { inactive } from '../../model/calendar.js';
import { app } from '../dom.js';
import { strengthRow } from '../strength.js';
import { chipFor } from './hoy.js';
import { xtIn } from '../../model/xtrain.js';
import { xtRow } from '../xtrain.js';

// semanas desplegadas en Plan: se recuerdan mientras usas la app
export let openWeeks=null;

export function renderPlan(){
  const plan=state.plan,cw=curWeek(),td=today();
  const weeks=plan.curve.map((c,i)=>{
    const ss=state.sessions.filter(s=>s.date>=addDays(plan.start,i*7)&&s.date<=addDays(plan.start,i*7+6));
    if(!ss.length&&i<cw) return '';
    const wkS=addDays(plan.start,i*7);
    const km=ss.filter(s=>!inactive(s)).reduce((a,s)=>a+s.km,0);
    const done=ss.filter(s=>s.status==='done').length;
    const strRows=strengthDays(wkS).map(x=>({date:x.date,html:strengthRow(x)})).concat(xtIn(wkS,addDays(wkS,6)).map(x=>({date:x.date,html:xtRow(x)})));
    const rows=ss.map(s=>{const d=describe(s),a=s.status==='done'?analyze(s):null;
      const timeBased=['runwalk','fartlek','cuestas'].includes(s.type);
      return `<button class="item" data-act="open" data-id="${s.id}">
      <span class="date">${DAYS[dow(s.date)]}<b class="num">${pd(s.date).getDate()}</b></span>
      <span class="grow"><span class="t">${d.title}</span><br><span class="s num">${timeBased?d.dur+' min':fk(s.status==='done'&&s.log&&s.log.km?s.log.km:s.km)+' km'}${s.type!=='cuestas'&&s.type!=='runwalk'?' · '+(s.status==='done'&&s.log&&s.log.km&&s.log.time?fp(s.log.time/s.log.km)+' /km':paceR(d.lo,d.hi)+' /km'):''}${s.moved||s.manual?' · movida':''}</span></span>
      ${s.status==='done'?`<span class="status d">${a&&a.verdict[1]!=='ok'?a.verdict[0]:'Hecha'}</span>`:s.status==='skipped'?'<span class="status s">Saltada</span>':s.status==='paused'?'<span class="status s">Pausa</span>':s.status==='rested'?'<span class="status s">Descanso</span>':chipFor(s)}
    </button>`;}).map((h,k)=>({date:ss[k].date,html:h})).concat(strRows).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).map(x=>x.html).join('');
    return `<details class="wk" data-w="${i}" ${(openWeeks?openWeeks.has(i):i===cw)?'open':''}>
      <summary><span class="grow" style="flex:1"><b style="font-family:var(--display);font-size:19px">Semana ${i+1}</b> <span class="small muted">${fdShort(wkS)} – ${fdShort(addDays(wkS,6))}</span><br><span class="small muted">${PHASE_N[c.phase]}${c.down?' · descarga':''}${i===cw?' · esta semana':''}</span></span>
      <span class="num" style="font-family:var(--display);font-weight:800;font-size:20px">${fk(km)}<span class="unit" style="font-size:15px">km</span></span></summary>
      ${i<=cw&&ss.length?`<div class="bar" style="margin-top:12px" aria-label="${done} de ${ss.length} sesiones hechas"><i style="width:${ss.length?done/ss.length*100:0}%"></i></div>`:''}
      <div class="list">${rows||'<p class="muted small" style="padding:12px 0">Sin sesiones.</p>'}</div>
    </details>`;}).join('');
  const g=GOALS[state.profile.goal];
  app.innerHTML=`<div class="stack-lg"><header class="stack" style="gap:6px"><div class="lanes" aria-hidden="true"></div><h1>Tu plan</h1><p class="muted">${plan.curve.length} semanas · ${g.name} · ${state.profile.days.map(d=>DAYS[d]).join(', ')}. Las semanas futuras se recalculan cada vez que registras algo.</p>
    <div class="grid2">${state.pause?'<button data-act="resume">Retomar el plan</button>':'<button data-act="pause">Pausar el plan</button>'}<a class="btn" href="#perfil" style="text-align:center;text-decoration:none">Cambiar días</a></div></header><div class="stack">${weeks}</div></div>`;
}

// Modificadores para que otros módulos puedan reasignar este estado compartido.
export function setOpenWeeks(v){openWeeks=v;}
