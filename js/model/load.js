/**
 * Carga de entrenamiento (TRIMP/rTSS/sRPE), CTL/ATL, distribución de intensidad y predicción.
 */
import { addDays, clamp, today } from '../core/util.js';
import { state } from '../core/store.js';
import { describe, hrBounds } from './workouts.js';
import { lthrNow } from './heartrate.js';
import { gapFromElev } from './elevation.js';
import { raceTime } from './goal.js';
import { activities, hrMaxNow, loadSeries } from './activities.js';

/* =========================================================
   Carga de cada entreno: pulso (TRIMP), ritmo o esfuerzo percibido · impacto · reparto · rendimiento
   ========================================================= */
// Carga en las mismas unidades que el TSS (1 hora al umbral = 100), usando el mejor dato disponible
export function loadParts(a,p){
  if(!a||!a.km) return {load:0,src:null,impact:0};
  const sec=a.sec||a.km*p*1.32,min=sec/60,L=lthrNow(),hm=hrMaxNow(),rest=(state.profile&&state.profile.hrRest)||60;
  let load=0,src='';
  if(a.hr&&L&&hm&&hm>L){
    // TRIMP de Banister normalizado: 60 min al umbral = 100
    const tr=(h,m)=>{const x=clamp((h-rest)/(hm-rest),0,1);return m*x*0.64*Math.exp(1.92*x);};
    load=tr(a.hr,min)/tr(L,60)*100;src='pulso';
  }else if(a.sec){
    const pace=a.gap||gapFromElev(a.sec,a.km,a.elev),IF=clamp(p*1.07/pace,0.5,1.15);
    load=sec/3600*IF*IF*100;src='ritmo';
  }else if(a.rpe){
    load=a.rpe*min/(7.5*60)*100;src='esfuerzo';
  }else{load=sec/3600*0.6*100;src='estimada';}
  // impacto sobre piernas y articulaciones: km, más las subidas y bajadas
  const impact=a.km+(a.elev||0)/100;
  return {load,src,impact};
}

export function loadOf(a,p){return loadParts(a,p).load;}

export const sameDayAct=a=>a.session&&a.session.log?Object.assign({},a,{rpe:a.session.log.rpe}):a.manual?Object.assign({},a,{rpe:a.manual.rpe}):a;

export function weekLoadInfo(){
  const ls=loadSeries();if(ls.length<21) return null;
  const x=ls[ls.length-1],last7=ls.slice(-7).reduce((t,d)=>t+d.load,0);
  const base=x.ctl*7,lo=base*0.8,hi=base*1.3,ratio=base?last7/base:0;
  const st=ratio>=1.5?['Excesiva','q']:ratio>=1.3?['Alta','w']:ratio>=0.8?['Productiva','ok']:ratio>=0.5?['Mantenimiento','']:['Baja','w'];
  // carga prevista de los 7 días siguientes según el plan
  const td=today(),p=state.fitness.p;let planned=0;
  state.sessions.filter(s=>s.status==='pending'&&s.date>=td&&s.date<=addDays(td,6)).forEach(s=>{planned+=plannedLoad(s,p);});
  return {last7,lo,hi,ratio,st,planned,base};
}

export function plannedLoad(s,p){
  const d=describe(s);let tss=0;
  d.blocks.forEach(b=>{const n=b.reps||1,mid=b.lo&&b.hi?(b.lo+b.hi)/2:p*1.45,sec=b.dur||(b.dist||0)*mid,IF=clamp(p*1.07/mid,0.5,1.15);tss+=n*sec/3600*IF*IF*100;});
  return tss;
}

export function impactInfo(){
  const td=today(),acts=activities().filter(a=>a.date<=td);
  const sum=(from,to)=>acts.filter(a=>a.date>=from&&a.date<=to).reduce((t,a)=>t+loadParts(a,state.fitness.p).impact,0);
  const w=sum(addDays(td,-6),td),avg=sum(addDays(td,-34),addDays(td,-7))/4;
  return avg>5?{w,avg,ratio:w/avg}:null;
}

// tiempo en cada tipo de intensidad (4 semanas): suave Z1–Z2, moderado Z3, intenso Z4–Z5
export function intensityDist(){
  const td=today(),p=state.fitness.p,out=[0,0,0];
  const zOfHr=h=>{const b2=hrBounds(2),b3=hrBounds(3);if(!b2||!b3)return null;return h<=b2[1]?0:h<=b3[1]?1:2;};
  const zOfPace=pc=>pc>p*1.2?0:pc>p*1.03?1:2;
  activities().filter(a=>a.date>=addDays(td,-27)&&a.date<=td&&a.km).forEach(a=>{
    const r=a.run,segs=r?(r.splits.length?r.splits:r.laps):[];
    if(segs.length) segs.forEach(x=>{const z=x.hr!=null&&zOfHr(x.hr)!=null?zOfHr(x.hr):zOfPace(x.gap||x.sec/x.km);out[z]+=x.sec;});
    else if(a.sec){const z=a.hr&&zOfHr(a.hr)!=null?zOfHr(a.hr):zOfPace(a.gap||a.sec/a.km);out[z]+=a.sec;}
  });
  const tot=out.reduce((x,y)=>x+y,0);
  return tot>3600?{pct:out.map(v=>v/tot),hours:tot/3600}:null;
}

// relación pulso–velocidad de las últimas 4 semanas (la usan los ritmos y el rendimiento de cada carrera)
export function hrSpeedFit(){
  const L=lthrNow(),td=today();if(!L) return null;
  const pts=[];
  activities().filter(a=>a.date>=addDays(td,-28)&&a.date<=td&&a.hr&&a.km>=3&&a.sec).forEach(a=>{
    const r=a.run,segs=r?(r.laps.length>=3?r.laps:r.splits).filter(x=>x.hr&&x.km>=0.4):[];
    if(segs.length>=3){
      const pcs=segs.map(x=>x.gap||x.sec/x.km),m=pcs.reduce((x,y)=>x+y,0)/pcs.length,cv=Math.sqrt(pcs.reduce((x,y)=>x+(y-m)**2,0)/pcs.length)/m;
      if(cv<0.06){pts.push({x:a.hr/L,y:1000/(a.gap||gapFromElev(a.sec,a.km,a.elev)),w:a.sec});return;}
      const avg=a.sec/a.km;segs.filter(x=>x.sec/x.km<avg*0.97&&x.sec>=150).forEach(x=>pts.push({x:x.hr/L,y:1000/(x.gap||x.sec/x.km),w:x.sec}));
      return;
    }
    if(!r) pts.push({x:a.hr/L,y:1000/(a.gap||gapFromElev(a.sec,a.km,a.elev)),w:a.sec});
  });
  const P=pts.filter(q=>q.x>0.7&&q.x<1.08&&q.y>1.5&&q.y<7);
  if(P.length<6) return null;
  const W=P.reduce((a,q)=>a+q.w,0),mx=P.reduce((a,q)=>a+q.w*q.x,0)/W,my=P.reduce((a,q)=>a+q.w*q.y,0)/W;
  const sxx=P.reduce((a,q)=>a+q.w*(q.x-mx)**2,0)/W,sxy=P.reduce((a,q)=>a+q.w*(q.x-mx)*(q.y-my),0)/W,syy=P.reduce((a,q)=>a+q.w*(q.y-my)**2,0)/W;
  if(sxx<0.0009) return null;
  const b=sxy/sxx,a=my-b*mx,r2=sxy*sxy/(sxx*syy||1);
  if(b<=0||r2<0.5) return null;
  return {a,b,L,r2,maxX:Math.max(...P.map(q=>q.x))};
}

// rendimiento de una carrera frente a lo esperado con ese pulso (80–120 %)
export function perfOf(run){
  if(!run||!run.hr||!run.sec||!run.km) return null;
  const f=hrSpeedFit();if(!f) return null;
  const exp=f.a+f.b*run.hr/f.L,act=1000/(run.gap||gapFromElev(run.sec,run.km,run.elev));
  if(!(exp>0)) return null;
  const v=clamp(act/exp,0.8,1.2);
  return {v,label:v>=1.1?'excelente':v>=1.03?'bueno':v>=0.97?'normal':v>=0.9?'algo bajo':'bajo'};
}

// la fórmula de Riegel es optimista en media y maratón si faltan tiradas largas y volumen
export function endurancePen(dist){
  if(dist<20) return 0;
  const td=today(),acts=activities().filter(a=>a.date>=addDays(td,-42)&&a.date<=td);
  const Lr=Math.max(0,...acts.map(a=>a.km)),W=acts.reduce((t,a)=>t+a.km,0)/6;
  if(dist>40) return clamp((30-Lr)/30*0.08,0,0.08)+clamp((55-W)/55*0.06,0,0.06);
  return clamp((17-Lr)/17*0.04,0,0.04)+clamp((32-W)/32*0.03,0,0.03);
}

export const predictToday=(p,dist)=>raceTime(p,dist)*(1+endurancePen(dist));
