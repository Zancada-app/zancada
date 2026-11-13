/**
 * Generación del plan: curva de carga por semanas (periodización, descarga, edad) y reparto semanal.
 */
import { addDays, clamp, daysBetween, dow, monday, r05, today, uid } from '../core/util.js';
import { GOALS, LEVELS, RW } from './constants.js';
import { state } from '../core/store.js';
import { describe } from './workouts.js';

// La edad cambia la recuperación: progresión más suave, descargas más frecuentes y menos intensidad acumulada
export function ageAdj(pr){
  const a=pr&&pr.age;
  if(a>=60) return {band:'60',ramp:1.06,downEvery:3,qMax:1,longMult:0.9,rateMult:0.7,peakMult:0.9};
  if(a>=50) return {band:'50',ramp:1.08,downEvery:3,qMax:n=>n>=5?2:1,longMult:0.95,rateMult:0.8,peakMult:0.95};
  if(a&&a<18) return {band:'joven',ramp:1.08,downEvery:4,qMax:1,longMult:0.8,rateMult:1,peakMult:0.75};
  return {band:null,ramp:1.1,downEvery:4,qMax:2,longMult:1,rateMult:1,peakMult:1};
}

export function ageNote(pr){
  const b=ageAdj(pr).band;
  return b==='60'?'Por tu edad, el plan sube la carga más despacio (6 % por semana como mucho), mete una semana de descarga cada tres y hace una sola sesión de calidad por semana.'
    :b==='50'?'Por tu edad, el plan sube la carga más despacio (8 % por semana como mucho) y mete una semana de descarga cada tres para que recuperes bien.'
    :b==='joven'?'Como aún estás creciendo, el plan limita el volumen y hace una sola sesión de calidad por semana.':'';
}

export function buildCurve(pr,startKm,start,rw,boost){
  const AG=ageAdj(pr);
  const g=GOALS[pr.goal],L=LEVELS[pr.level];
  let n;
  if(pr.raceDate&&g.dist) n=Math.floor(daysBetween(start,monday(pr.raceDate))/7)+1;
  else n=pr.weeks||g.defWeeks;
  n=clamp(n,3,24);
  const s=Math.max(startKm||0,g.minStart*L.mult*0.8);
  const t=n>=g.taper+3?g.taper:Math.min(g.taper,1);
  const b=n-t;
  // correr/andar: una etapa por semana desde la etapa de partida; si el plan es corto, sigue siendo correr/andar hasta el final
  const rwW=rw!==false&&rw!=null?Math.max(0,Math.min(RW.length-2-rw,b)):0;
  const s2=rwW?Math.max(s,12):s;
  let peak=(g.dist?Math.max(g.peak*L.mult,s2*1.1):s2*1.3)*(1+(boost||0));
  peak=Math.min(peak*AG.peakMult,s2*Math.pow(AG.ramp,Math.max(1,b-rwW-1)));
  const curve=[];
  for(let i=0;i<b;i++){
    let km;
    if(i<rwW) km=5+7*clamp((rw+i)/(RW.length-3),0,1);
    else{const bb=b-rwW;const frac=bb<=1?1:(i-rwW)/(bb-1);km=s2+(peak-s2)*frac;}
    const down=(i%AG.downEvery===AG.downEvery-1)&&i<b-1;
    if(down) km*=0.8;
    const phase=i<Math.ceil(b*0.4)?'base':(g.dist&&i>=b-2&&b>=5?'pico':'desarrollo');
    curve.push({km,phase,down});
  }
  ({1:[0.65],2:[0.75,0.55],3:[0.8,0.65,0.45]}[t]||[]).forEach(f=>curve.push({km:peak*f,phase:'puesta a punto',down:false}));
  curve.rwWeeks=rwW;
  return curve;
}

export function isRunWalk(i){
  const pr=state.profile;
  return !!state.plan.rw&&i<(state.plan.rwWeeks||0);
}

export function buildWeek(i){
  const pr=state.profile,plan=state.plan,g=GOALS[pr.goal],L=LEVELS[pr.level],ad=state.adapt;
  const c=plan.curve[i]; if(!c) return [];
  const wkStart=addDays(plan.start,i*7);
  const km=c.km*ad.load;
  const days=[...pr.days].sort((a,b)=>a-b);
  const n=days.length;
  const longDay=days.includes(pr.longDay)?pr.longDay:days[days.length-1];
  const isLast=i===plan.curve.length-1;
  const rw=isRunWalk(i);
  let qn=n>=5&&pr.level!=='nuevo'?2:n>=3?1:0;
  const AG=ageAdj(pr),qMax=typeof AG.qMax==='function'?AG.qMax(n):AG.qMax;
  const G=plan.goal;
  if(G&&G.needed>=0.03&&n>=4&&pr.level!=='nuevo'&&i>=2) qn=Math.max(qn,2);
  qn=Math.min(qn,qMax);
  if(pr.level==='nuevo'&&i<3) qn=0;
  if(c.down||c.phase==='puesta a punto') qn=Math.min(qn,1);
  if(ad.intensity<=-2) qn=Math.min(qn,1);
  if(rw) qn=0;
  const others=days.filter(d=>d!==longDay);
  const cd=(a,b)=>{const x=Math.abs(a-b);return Math.min(x,7-x);};
  const q=[];
  for(let k=0;k<qn;k++){
    let best=null,bs=-1;
    others.forEach(d=>{if(q.includes(d))return;const sc=Math.min(cd(d,longDay),...q.map(x=>cd(d,x)));if(sc>bs){bs=sc;best=d;}});
    if(best!=null&&bs>=2) q.push(best);
  }
  q.sort((a,b)=>a-b);
  let rot={base:['fartlek','cuestas'],desarrollo:['series','tempo'],pico:['ritmo','series'],'puesta a punto':['ritmo']}[c.phase];
  const hills=pr.hills!==false,hilly=(pr.raceElev||0)>=8&&g.dist;
  if(!hills) rot=rot.map(t=>t==='cuestas'?'tempo':t);
  else if(hilly&&(c.phase==='desarrollo'||c.phase==='pico')) rot=[rot[0],'cuestas',rot[1]]; // carrera con desnivel: cuestas también en las fases fuertes
  const qTypes=q.map((d,k)=>rot[(i+k)%rot.length]);
  if(c.down&&i>=3&&qTypes.length&&!isLast) qTypes[0]='test';
  const share={1:1,2:0.5,3:0.4,4:0.33,5:0.3,6:0.27,7:0.25}[n];
  let longKm=Math.min(km*share,g.longCap*L.longMult*AG.longMult);
  // tiempo disponible entre semana: limita los km de los días que no son la tirada larga
  const p=state.fitness.p,maxMin=+pr.maxMin||0;
  const capE=maxMin?maxMin*60/(p*1.32):99,capQ=maxMin?maxMin*60/(p*1.2):99;
  const qKm=qTypes.map(t=>Math.min(t==='test'?8:Math.max(5,km*0.18),capQ));
  const easyDays=others.filter(d=>!q.includes(d));
  const rem=km-longKm-qKm.reduce((a,b)=>a+b,0);
  let easyKm=easyDays.length?Math.min(Math.max(3,rem/easyDays.length),Math.max(3,longKm*0.8)):0;
  if(easyKm>capE){const lost=(easyKm-capE)*easyDays.length;easyKm=Math.max(2,capE);longKm=Math.min(longKm+lost*0.5,g.longCap*L.longMult*AG.longMult);}
  if(!easyDays.length&&rem>0) longKm=Math.min(longKm+rem*0.5,g.longCap*L.longMult*AG.longMult);
  if(plan.longs&&plan.longs[i]!=null&&!rw) longKm=plan.longs[i]*Math.min(1,ad.load); // progresión propia de la tirada larga
  const mk=(d,type,k,extra)=>Object.assign({id:uid(),date:addDays(wkStart,d),week:i,type,km:r05(k),status:'pending',load:ad.load},extra||{});
  let out=[];
  if(rw){
    days.forEach(d=>out.push(mk(d,'runwalk',d===longDay?Math.max(easyKm,3)*1.2:Math.max(easyKm,2.5),{rwLong:d===longDay})));
  }else{
    let stridesUsed=false;
    days.forEach(d=>{
      if(d===longDay) out.push(mk(d,'long',longKm,{rpFinish:c.phase==='pico'&&(pr.goal==='21k'||pr.goal==='42k')}));
      else if(q.includes(d)){const k=q.indexOf(d);out.push(mk(d,qTypes[k],qKm[k]));}
      else{
        const strides=!stridesUsed&&(c.phase==='base'||c.phase==='desarrollo')&&(pr.level!=='nuevo'||i>=4);
        if(strides) stridesUsed=true;
        out.push(mk(d,'easy',easyKm,{strides}));
      }
    });
  }
  if(isLast&&g.dist){
    const rd=pr.raceDate&&monday(pr.raceDate)===wkStart?pr.raceDate:addDays(wkStart,longDay);
    out=out.filter(s=>s.date<rd&&!(s.type==='long'));
    // día antes de la carrera: libre
    out=out.filter(s=>s.date!==addDays(rd,-1));
    out.push(mk(dow(rd),'race',g.dist,{date:rd}));
    out[out.length-1].date=rd;
  }
  // los km mostrados son la suma real de los bloques (calentamiento, series, recuperaciones…)
  out.forEach(s=>{s.budget=s.km;if(['series','tempo','ritmo','fartlek','cuestas','test'].includes(s.type))s.km=r05(describe(s).estKm);});
  return out.filter(s=>s.date>=today());
}
