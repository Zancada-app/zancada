/**
 * Marcas personales (manuales y de Strava), decaimiento con el tiempo y mejor referencia.
 */
import { addDays, clamp, daysBetween, fdShort, fk, parseTime, pd, today } from '../core/util.js';
import { state } from '../core/store.js';

/* =========================================================
   Mejores marcas (manuales y de Strava) y desnivel
   ========================================================= */
export const MARK_D=[[5,'5 km'],[10,'10 km'],[21.0975,'Media maratón'],[42.195,'Maratón']];

export const AGE_OPTS=[[30,'Este último mes'],[90,'Hace 1–3 meses'],[180,'Hace 3–6 meses'],[365,'Hace 6–12 meses'],[730,'Hace más de un año']];

export const PR_KEYS={'1k':1,'1 mile':1.609344,'5k':5,'10k':10,'Half-Marathon':21.0975,'Marathon':42.195};

export const PR_NAME={'1k':'1 km','1 mile':'1 milla','5k':'5 km','10k':'10 km','Half-Marathon':'Media maratón','Marathon':'Maratón'};

export const markP=(t,d)=>t*Math.pow(5/d,1.06)/5;

// una marca antigua cuenta menos: +1 % de ritmo por mes a partir del mes y medio, hasta un 10 %
export function decayP(p,date){const days=date?Math.max(0,daysBetween(date,today())):60;return p*(1+clamp((days/30.4-1.5)*0.01,0,0.10));}

/** Marca que da una carrera completa de la distancia (por si Strava no ha calculado sus mejores esfuerzos). */
export function summaryMark(r){
  if(!(r.km>0)||!(r.sec>0)) return null;
  const key=Object.keys(PR_KEYS).find(k=>PR_KEYS[k]>=5&&r.km>=PR_KEYS[k]*0.985&&r.km<=PR_KEYS[k]*1.05);
  return key?{key,t:Math.round(r.sec*Math.min(1,PR_KEYS[key]/r.km)),race:!!r.race}:null;
}

/** Guarda una marca de una actividad antigua (fuera del año que se guarda completo). */
export function archiveMark(s,key,t,date,id,o={}){
  if(!(key in PR_KEYS)||!(t>0)) return;
  const a=s.prArchive||(s.prArchive={}),cur=a[key];
  if(!cur||t<cur.t) a[key]={t,date,id,race:!!o.race,approx:!!o.approx};
}

export function stravaPRs(){
  const s=state&&state.strava;if(!s||!s.runs) return [];
  const best={};
  const put=(key,t,date,id,o={})=>{if(!(key in PR_KEYS)||!(t>0))return;const cur=best[key];if(!cur||t<cur.t)best[key]={key,d:PR_KEYS[key],t,date,id,src:'strava',race:!!o.race,approx:!!o.approx};};
  s.runs.forEach(r=>{
    (r.be||[]).forEach(b=>put(b.n,b.t,r.date,r.id));
    const sm=summaryMark(r);if(sm)put(sm.key,sm.t,r.date,r.id,{race:sm.race,approx:!sm.race});
  });
  Object.entries(s.prArchive||{}).forEach(([k,m])=>put(k,m.t,m.date,m.id,m));
  return Object.values(best).sort((a,b)=>a.d-b.d);
}

export function allMarks(pr){
  const out=[];
  ((pr&&pr.marks)||[]).forEach(m=>out.push({d:m.d,t:m.t,date:m.date,src:'manual'}));
  stravaPRs().forEach(m=>{if(m.d>=3)out.push(m);});
  return out.filter(m=>m.t>0&&m.t/m.d>150&&m.t/m.d<720);
}

export function bestMark(pr){
  let best=null;
  allMarks(pr).forEach(m=>{const p=decayP(markP(m.t,m.d),m.date);if(!best||p<best.p)best=Object.assign({},m,{p});});
  return best;
}

export function marksFromDraft(d){
  const out=[];
  MARK_D.forEach(([dist],i)=>{const t=parseTime(d['mt'+i]);if(t){out.push({d:dist,t,date:addDays(today(),-(+d['ma'+i]||90))});}});
  return out;
}

export const markName=d=>Math.abs(d-1.609344)<0.01?'1 milla':Math.abs(d-1)<0.01?'1 km':(MARK_D.find(x=>Math.abs(x[0]-d)<0.01)||[0,`${fk(d)} km`])[1];

export const fdMark=dt=>dt?fdShort(dt)+(pd(dt).getFullYear()!==pd(today()).getFullYear()?' '+pd(dt).getFullYear():''):'';
