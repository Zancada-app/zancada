/**
 * Resumen de una semana y consejo según la fase.
 */
import { addDays } from '../core/util.js';
import { QUALITY, TYPES } from './constants.js';
import { state } from '../core/store.js';
import { activities } from './activities.js';
import { analyze } from './analysis.js';

/* =========================================================
   Resumen semanal
   ========================================================= */
export const PHASE_TIP={base:'Construir base: los rodajes, suaves de verdad. Es lo que más rinde a largo plazo.',desarrollo:'Llegan las sesiones de calidad: llega descansado a ellas y no conviertas los suaves en carreras.',pico:'Las semanas más exigentes: prioriza dormir bien y comer suficiente.','puesta a punto':'Menos volumen para llegar fresco a la carrera. No compenses entrenando de más.'};

export function weekSummary(mon){
  const end=addDays(mon,6);
  const ss=state.sessions.filter(s=>s.date>=mon&&s.date<=end&&s.status!=='paused');
  if(!ss.length) return null;
  const done=ss.filter(s=>s.status==='done');
  const kmDone=activities().filter(a=>a.date>=mon&&a.date<=end).reduce((a,x)=>a+x.km,0);
  const kmPlan=ss.filter(s=>!(s.status==='skipped'&&s.moved)).reduce((a,s)=>a+(s.snap&&s.snap.km||s.km),0);
  const an=done.map(analyze).filter(Boolean);
  const okQ=done.filter(s=>QUALITY.includes(s.type)).map(s=>[s,analyze(s)]);
  const feel=done.filter(s=>s.log&&s.log.rpeSrc!=='previsto'&&s.rpeExp).map(s=>s.log.rpe-s.rpeExp);
  const fAvg=feel.length?feel.reduce((a,b)=>a+b,0)/feel.length:null;
  const evs=state.adapt.events.filter(e=>e.date>mon&&e.date<=addDays(end,1)).length;
  return {mon,end,done:done.length,total:ss.filter(s=>s.status!=='pending'||s.date<=end).length,kmDone,kmPlan,
    quality:okQ.map(([s,a])=>`${TYPES[s.type].n}: ${a.verdict[0].toLowerCase()}`),
    feel:fAvg==null?null:fAvg>=1.5?'más duro de lo previsto':fAvg<=-1.5?'más fácil de lo previsto':'como estaba previsto',evs,cumplidas:an.filter(a=>a.verdict[1]==='ok').length};
}
