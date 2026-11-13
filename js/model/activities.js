/**
 * Historial de carreras (Strava + manuales): emparejado con el plan, esfuerzo, forma y fatiga.
 */
import { addDays, clamp, daysBetween, dow, fdShort, monday, today } from '../core/util.js';
import { QUALITY, TYPES } from './constants.js';
import { state, sv } from '../core/store.js';
import { describe } from './workouts.js';
import { fitnessFromHR, updateHR } from './heartrate.js';
import { loadOf } from './load.js';
import { goalCheck } from './goal.js';
import { addEvent, logDone, regenerate, setFitness, setLoad, sortSessions } from './adapt.js';
import { xtByDate } from './xtrain.js';

export const BE_NAMES={'1k':'1 km','1 mile':'1 milla','2 mile':'2 millas','5k':'5 km','10k':'10 km','15k':'15 km','10 mile':'10 millas','20k':'20 km','Half-Marathon':'media maratón','30k':'30 km','Marathon':'maratón'};

/* ---------- análisis de cada carrera ---------- */
export const hrMaxNow=()=>{const pr=state.profile||{},s=state.strava||{},H=state.hrm||{};return pr.hrMax||s.hrMaxUser||H.max||s.hrMax||(pr.age?Math.round(208-0.7*pr.age):null);};

export function rpeFromHR(hr){
  if(!hr) return null;
  if(state.hrm&&state.hrm.lthr){const f=hr/state.hrm.lthr;return f<0.81?3:f<0.85?4:f<0.89?5:f<0.93?6:f<0.97?7:f<1.0?8:9;}
  const hm=hrMaxNow();if(!hm) return null;
  const f=hr/hm;
  return f<0.70?3:f<0.77?4:f<0.82?5:f<0.87?6:f<0.90?7:f<0.93?8:9;
}

export function workPaceOf(r){
  const segs=r.laps.length>=3?r.laps:r.splits;
  if(!segs.length||!r.km) return null;
  const avg=r.sec/r.km;
  const fast=segs.filter(l=>l.km>=0.15&&l.sec/l.km<avg*0.95);
  if(!fast.length) return null;
  const km=fast.reduce((a,l)=>a+l.km,0),sec=fast.reduce((a,l)=>a+l.sec,0);
  return km>=0.6?sec/km:null;
}

export function runLog(r,x){
  const d=describe(x);
  const hrR=rpeFromHR(r.hr);
  const log={km:Math.round(r.km*100)/100,time:r.sec,hr:r.hr,strava:r.id,elev:r.elev,gap:r.gap||null,
    rpe:r.rpe||hrR||d.rpe,rpeSrc:r.rpe?'strava':hrR?'fc':'previsto',needsFeel:!r.rpe,
    workPace:QUALITY.includes(x.type)?workPaceOf(r):null};
  if(x.type==='test'){
    // el test son los 5 km cronometrados, no la sesión entera con calentamiento
    const b=r.be.find(b=>Math.abs(b.d-5000)<60);
    if(b){log.km=5;log.time=b.t;}
    else{const segs=(r.laps.length>=3?r.laps:r.splits),avg=r.sec/r.km,fast=segs.filter(l=>l.sec/l.km<avg*0.97),fk2=fast.reduce((a,l)=>a+l.km,0);
      if(fk2>=4.5){log.km=5;log.time=Math.round(fast.reduce((a,l)=>a+l.sec,0)/fk2*5);}else log.noTest=true;}
  }
  return log;
}

export function afterSync(){
  const s=sv();let matched=0;const names=[];
  if(state.plan){
    const td=today();
    const open=x=>x.status==='pending'||(x.status==='skipped'&&x.auto);
    s.runs.filter(r=>!r.sessionId&&!r.extra&&r.date>=state.plan.created&&r.date<=td).forEach(r=>{
      const manual=state.sessions.find(x=>x.status==='done'&&x.date===r.date&&x.log&&!x.log.strava);
      if(manual){ // ya registrada a mano: se completa con los datos de Strava, sin contarla dos veces
        Object.assign(manual.log,{km:Math.round(r.km*100)/100,time:r.sec,hr:r.hr,strava:r.id,elev:r.elev,gap:r.gap||null});
        if(!manual.log.workPace&&QUALITY.includes(manual.type)) manual.log.workPace=workPaceOf(r);
        r.sessionId=manual.id;matched++;return;
      }
      let cand=state.sessions.filter(x=>open(x)&&x.date===r.date);
      if(!cand.length) cand=state.sessions.filter(x=>open(x)&&monday(x.date)===monday(r.date)&&Math.abs(daysBetween(x.date,r.date))<=2);
      if(!cand.length){r.extra=true;return;}
      cand.sort((a,b)=>(a.date===r.date?0:1)-(b.date===r.date?0:1)||Math.abs(a.km-r.km)-Math.abs(b.km-r.km));
      const x=cand[0];
      if(x.status==='skipped'){
        const copy=state.sessions.find(y=>y.moved&&y.from===x.date&&y.type===x.type&&y.status==='pending');
        if(copy) state.sessions=state.sessions.filter(y=>y!==copy);
      }
      x.status='pending';
      if(x.date!==r.date){x.plannedDate=x.date;x.date=r.date;}
      r.sessionId=x.id;matched++;names.push(TYPES[x.type].n.toLowerCase());
      logDone(x,runLog(r,x));
    });
    sortSessions();
  }
  let fit=state.fitness?fitnessFromEfforts():null;
  if(state.adapt){updateHR();if(fitnessFromHR())fit=true;}
  const fat=state.plan?checkFatigue():null;
  if(state.plan) goalCheck();
  return {matched,names,fit,fat};
}

export function bestImplied(days){
  const s=state.strava;if(!s) return null;
  const from=addDays(today(),-days);let best=null;
  s.runs.filter(r=>r.date>=from).forEach(r=>{
    const c=r.be.filter(b=>b.d>=3000).map(b=>({p:b.t*Math.pow(5000/b.d,1.06)/5,n:BE_NAMES[b.n]||b.n,date:r.date}));
    if(r.race&&r.km>=3) c.push({p:r.sec*Math.pow(5/r.km,1.06)/5,n:'carrera',date:r.date});
    c.forEach(v=>{if(v.p>150&&(!best||v.p<best.p))best=v;});
  });
  return best;
}

export function fitnessFromEfforts(){
  const b=bestImplied(42),p=state.fitness.p;
  if(b&&b.p<p*0.99){
    return setFitness(Math.max(b.p,p*0.97),`Strava: tu mejor esfuerzo en ${b.n} (${fdShort(b.date)}) muestra que estás más en forma.`);
  }
  return false;
}

/* ---------- carga: forma (42 días) y fatiga (7 días) ---------- */
export function activities(){
  const out=[];
  const rpeOf=r=>{const x=r.sessionId?state.sessions.find(y=>y.id===r.sessionId):null;return x&&x.log&&x.log.rpeSrc!=='previsto'?x.log.rpe:r.rpe;};
  (state.strava?state.strava.runs:[]).forEach(r=>out.push({date:r.date,km:r.km,sec:r.sec,hr:r.hr,elev:r.elev,gap:r.gap||null,rpe:rpeOf(r),src:'strava',run:r}));
  state.sessions.filter(x=>x.status==='done'&&x.log&&!x.log.strava).forEach(x=>out.push({date:x.date,km:x.log.km||x.km,sec:x.log.time||null,hr:x.log.hr||null,elev:x.log.elev,gap:x.log.gap||null,rpe:x.log.rpe,src:'manual',session:x}));
  (state.manual||[]).forEach(m=>out.push({date:m.date,km:m.km,sec:m.time,hr:m.hr,elev:m.elev,gap:m.gap||null,rpe:m.rpe,src:'manual',manual:m}));
  return out.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
}

export function loadSeries(){
  const p=state.fitness?state.fitness.p:315,acts=activities(),by={};
  acts.forEach(a=>{by[a.date]=(by[a.date]||0)+loadOf(a,p);});
  // los otros entrenos (fuerza, bici, pilates…) también cansan: cuentan para la fatiga y la forma
  const xb=xtByDate();Object.entries(xb).forEach(([d,l])=>{if(d<=today())by[d]=(by[d]||0)+l;});
  const days=Object.keys(by).sort();
  if(!days.length) return [];
  const kC=1-Math.exp(-1/42),kA=1-Math.exp(-1/7);
  let ctl=0,atl=0;const out=[];
  for(let d=days[0];d<=today();d=addDays(d,1)){
    const l=by[d]||0;ctl+=(l-ctl)*kC;atl+=(l-atl)*kA;
    out.push({date:d,ctl,atl,tsb:ctl-atl,load:l});
  }
  return out;
}

export function formState(){
  const ls=loadSeries();if(ls.length<28) return null;
  const x=ls[ls.length-1];
  const lab=x.tsb>10?['Fresco','ok']:x.tsb>-10?['Equilibrado','']:x.tsb>-25?['Cargando','w']:['Fatiga alta','q'];
  return {ctl:x.ctl,atl:x.atl,tsb:x.tsb,label:lab[0],cls:lab[1],span:ls.length};
}

export function checkFatigue(){
  const f=formState(),ad=state.adapt,td=today();
  if(!f||f.span<42) return false;
  if(f.tsb<-25&&f.atl>f.ctl*1.4&&(!ad.lastFatigue||daysBetween(ad.lastFatigue,td)>=7)){
    ad.lastFatigue=td;const pct=setLoad(0.9);ad.intensity=Math.max(-2,ad.intensity-1);
    addEvent('down',`Tu carga de los últimos 7 días es mucho mayor que tu forma de base. Bajo el volumen un ${Math.abs(pct)} % esta semana para absorberla sin lesionarte.`);
    regenerate();return true;
  }
  return false;
}

export function stravaSummary(){
  const s=state.strava;if(!s||!s.runs.length) return null;
  const from=addDays(today(),-28);
  const rec=s.runs.filter(r=>r.date>=from);
  const km=rec.reduce((a,r)=>a+r.km,0)/4;
  const cnt=[0,0,0,0,0,0,0];rec.forEach(r=>cnt[dow(r.date)]++);
  const perWeek=Math.round(rec.length/4);
  const days=cnt.map((c,i)=>[c,i]).sort((a,b)=>b[0]-a[0]).slice(0,clamp(perWeek,2,6)).map(x=>x[1]).sort((a,b)=>a-b);
  const longest=rec.slice().sort((a,b)=>b.km-a.km)[0];
  const best=bestImplied(42)||bestImplied(120);
  return {km,perWeek,days:rec.length?days:null,longDay:longest?dow(longest.date):null,best,n:s.runs.length};
}
