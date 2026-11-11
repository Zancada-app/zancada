/**
 * Calendario: mover sesiones, pausas (lesión, enfermedad, viaje) y vuelta progresiva.
 */
import { DAYS_L, addDays, daysBetween, dow, fdShort, monday, r05, today } from '../core/util.js';
import { KEY_TYPES, QUALITY, TYPES } from './constants.js';
import { state } from '../core/store.js';
import { addEvent, regenerate, setFitness, setLoad, sortSessions } from './adapt.js';

/* =========================================================
   Calendario: mover sesiones y pausas
   ========================================================= */
export const inactive=s=>s.status==='skipped'||s.status==='paused'||s.status==='rested';

export function moveOptions(s){
  const td=today(),mon=monday(td);
  if(s.status!=='pending'||s.type==='race'||monday(s.date)!==mon) return [];
  const out=[];
  for(let d=td;d<=addDays(mon,6);d=addDays(d,1)){
    const other=state.sessions.find(x=>x.date===d&&x.status==='pending'&&x.id!==s.id);
    const done=state.sessions.some(x=>x.date===d&&x.status==='done');
    out.push({d,cur:d===s.date,other,blocked:done||(other&&other.type==='race')});
  }
  return out;
}

export function moveSession(s,d){
  if(d===s.date) return null;
  const other=state.sessions.find(x=>x.date===d&&x.status==='pending'&&x.id!==s.id);
  const from=s.date;
  if(other){other.date=from;other.manual=true;}
  s.date=d;s.manual=true;sortSessions();
  const isKey=x=>KEY_TYPES.includes(x.type)||x.type==='race';
  const near=state.sessions.filter(x=>x.status==='pending'&&x.id!==s.id&&isKey(x)&&Math.abs(daysBetween(x.date,d))===1);
  const warn=isKey(s)&&near.length?`Ojo: queda pegada a ${TYPES[near[0].type].n.toLowerCase()} del ${DAYS_L[dow(near[0].date)]}. Si puedes, deja un día suave entre las dos.`:'';
  return (other?`Cambiadas: ${TYPES[s.type].n.toLowerCase()} pasa al ${DAYS_L[dow(d)]} y ${TYPES[other.type].n.toLowerCase()} al ${DAYS_L[dow(from)]}.`:`${TYPES[s.type].n} movida al ${DAYS_L[dow(d)]}.`)+(warn?' '+warn:'');
}

export const PAUSE_R={lesion:'Lesión o molestia',enfermedad:'Enfermedad',viaje:'Vacaciones o viaje'};

export function startPause(reason,to){
  state.pause={reason,from:today(),to:to||null};
  addEvent('info',`Plan en pausa (${PAUSE_R[reason].toLowerCase()})${to?` hasta el ${fdShort(to)}`:''}. Las sesiones de estos días no cuentan como saltadas.`);
}

export function resumePlan(){
  const P=state.pause;if(!P) return;
  const td=today(),days=Math.max(0,daysBetween(P.from,td)),ad=state.adapt;
  if(days===0){state.pause=null;addEvent('info','Pausa cancelada: el plan sigue igual.');return;}
  state.sessions.forEach(s=>{if(s.status==='pending'&&s.date>=P.from&&s.date<td){s.status='paused';}});
  state.pause=null;
  let f=1,easyDays=0,fit=0;
  if(days>=28){f=0.6;easyDays=14;fit=0.05;}
  else if(days>=14){f=0.7;easyDays=10;fit=0.03;}
  else if(days>=6){f=0.85;easyDays=6;fit=0.01;}
  else if(P.reason!=='viaje'){f=0.9;easyDays=4;}
  if(P.reason==='lesion'){f=Math.min(f,0.8);easyDays=Math.max(easyDays,7);}
  if(f<1) setLoad(f);
  if(easyDays){ad.easyUntil=addDays(td,easyDays-1);}
  if(fit) setFitness(state.fitness.p*(1+fit),`Tras ${days} días sin entrenar se pierde algo de forma.`,true);
  ad.feelFrom=Date.now();ad.lastGapAdj=td;
  addEvent('down',`Vuelves tras ${days} día${days===1?'':'s'} de pausa (${PAUSE_R[P.reason].toLowerCase()}). ${f<1?`Bajo la carga un ${Math.round((1-f)*100)} %`:'Mantengo la carga'}${easyDays?` y los próximos ${easyDays} días son solo rodajes suaves`:''}.${P.reason==='lesion'?' Si vuelve la molestia, para y consulta a un fisioterapeuta.':''}`);
  regenerate();
}

export function applyEasyUntil(list){
  const u=state.adapt&&state.adapt.easyUntil;if(!u) return list;
  list.forEach(s=>{if(s.status==='pending'&&s.date<=u&&s.date>=today()&&QUALITY.includes(s.type)&&s.type!=='race'){s.type='easy';s.converted=true;s.km=r05(Math.min(s.km,8));}});
  return list;
}
