/**
 * Motor de adaptación: crear/regenerar el plan, registrar sesiones, saltos y semanas perdidas.
 */
import { DAYS_L, addDays, clamp, daysBetween, dow, fk, fp, ft, monday, pd, r05, today, uid } from '../core/util.js';
import { GOALS, KEY_TYPES, LEVELS, QUALITY, RW, TYPES } from './constants.js';
import { state, stravaOn, syncFailed } from '../core/store.js';
import { ageNote, buildCurve, buildWeek } from './plan.js';
import { describe, hrBounds, refreshKm } from './workouts.js';
import { bestMark } from './marks.js';
import { gapFromElev } from './elevation.js';
import { goalCheck, goalEval } from './goal.js';
import { activities, hrMaxNow } from './activities.js';
import { applyEasyUntil, resumePlan } from './calendar.js';

/* =========================================================
   Motor de adaptación
   ========================================================= */
export function addEvent(kind,text){state.adapt.events.unshift({date:today(),kind,text});state.adapt.events=state.adapt.events.slice(0,60);}

export function sortSessions(){state.sessions.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);}

export function curWeek(){return Math.floor(daysBetween(state.plan.start,monday(today()))/7);}

export function createPlan(pr,keep){
  const td=today();
  const old=keep&&state.profile?state:null;
  if(pr.refDist&&pr.refTime&&!pr.marks) pr.marks=[{d:pr.refDist,t:pr.refTime,date:addDays(td,-30)}]; // datos de versiones anteriores
  const marksChanged=JSON.stringify(pr.marks||[])!==JSON.stringify((old&&old.profile.marks)||[]);
  const bm=bestMark(pr);
  let p=old?old.fitness.p:(bm?bm.p:LEVELS[pr.level].p);
  if(old&&marksChanged&&bm&&bm.src==='manual') p=bm.p; // marcas nuevas introducidas por el corredor
  if(old&&!bm&&old.profile.level!==pr.level&&!state.sessions.some(s=>s.status==='done')) p=LEVELS[pr.level].p;
  const hist=old?old.fitness.history.slice():[];
  if(!old||p!==old.fitness.p) hist.push({date:td,p});
  state.profile=pr;
  state.fitness={p,history:hist};
  state.adapt=old?Object.assign(old.adapt,{load:1,intensity:0,feelFrom:Date.now()}):{load:1,intensity:0,feelFrom:0,lastMissAdj:null,lastGapAdj:null,lastFastTip:null,lastFatigue:null,events:[]};
  const start=monday(td);
  // etapa de correr/andar alcanzada en el plan anterior, para continuar donde se quedó
  let rwStart=null;
  if(old&&old.plan&&old.plan.rw){const reached=(old.plan.rwStart||0)+Math.max(0,Math.min(curWeek(),old.plan.rwWeeks||0));if(reached<RW.length-2)rwStart=reached;}
  else if(pr.level==='nuevo'&&(pr.weeklyKm||0)<10) rwStart=0;
  const rw=rwStart!=null?rwStart:false;
  let curve=buildCurve(pr,pr.weeklyKm,start,rw);
  const G=goalEval(pr,p,curve.length);
  if(G&&G.needed>0.02) curve=buildCurve(pr,pr.weeklyKm,start,rw,clamp(G.needed,0,0.15)*0.8);
  state.plan={start,curve,rw:rw!==false,rwStart:rw===false?0:rw,rwWeeks:curve.rwWeeks,created:td,goal:G};
  state.sessions=old?state.sessions.filter(s=>s.status!=='pending'):[];
  state.plan.curve.forEach((_,i)=>state.sessions.push(...buildWeek(i)));
  sortSessions();
  const g=GOALS[pr.goal];
  addEvent('info',old?`Plan recalculado: ${state.plan.curve.length} semanas hacia ${g.name.toLowerCase()}. Tu historial se mantiene.`
    :`Plan creado: ${state.plan.curve.length} semanas, ${pr.days.length} días por semana, objetivo ${g.name.toLowerCase()}. Ritmo de referencia: ${fp(p)} /km en 5 km.`);
  if(G) addEvent(G.status==='poco realista'?'down':'info',{
    'ya':`Tu forma actual ya da para ${ft(pr.targetTime)} (harías unos ${ft(G.current)}). El plan te mantiene ahí; puedes ponerte un objetivo más ambicioso en Perfil.`,
    'alcanzable':`Objetivo ${ft(pr.targetTime)}: hoy harías ${ft(G.current)}. Hay que mejorar un ${(G.needed*100).toFixed(1).replace('.',',')} %, alcanzable en este plazo. Las sesiones de ritmo se harán a tu ritmo objetivo.`,
    'ambicioso':`Objetivo ${ft(pr.targetTime)}: hoy harías ${ft(G.current)}. Es ambicioso (${(G.needed*100).toFixed(1).replace('.',',')} %), así que el plan lleva más volumen${pr.days.length>=4&&pr.level!=='nuevo'?' y dos sesiones de calidad por semana':'. Con '+pr.days.length+' días por semana solo cabe una sesión de calidad: un cuarto día te acercaría más'}.`,
    'poco realista':`Objetivo ${ft(pr.targetTime)}: hoy harías ${ft(G.current)} y en este plazo lo razonable es unos ${ft(G.realistic)}. Entreno el ritmo de carrera con esa referencia y lo iré acercando si mejoras más rápido.`
  }[G.status]);
  if(ageNote(pr)&&!old) addEvent('info',ageNote(pr));
  const nW=state.plan.curve.length;
  if((pr.goal==='42k'&&(pr.weeklyKm<25&&nW<20||nW<12))||(pr.goal==='21k'&&pr.weeklyKm<10&&nW<12))
    addEvent('down',`Aviso: ${nW} semanas es poco margen para ${g.name.toLowerCase()} desde tu volumen actual. El plan sube la carga con prudencia y quizá no llegue al volumen ideal; si puedes, elige una carrera más corta o más lejana.`);
}

export function regenerate(){
  const td=today(),cw=curWeek();
  state.sessions=state.sessions.filter(s=>!(s.status==='pending'&&s.week>cw&&!s.moved));
  for(let i=Math.max(cw+1,0);i<state.plan.curve.length;i++) state.sessions.push(...buildWeek(i));
  state.sessions.forEach(s=>{
    if(s.status==='pending'&&s.week===cw&&s.date>td&&!['race','test','runwalk'].includes(s.type)&&s.load){
      const f=state.adapt.load/s.load;if(s.budget)s.budget=r05(s.budget*f);s.km=r05(s.km*f);s.load=state.adapt.load;
    }
  });
  applyEasyUntil(state.sessions);
  refreshKm();
  sortSessions();
}

export function setLoad(f){const ad=state.adapt,before=ad.load;ad.load=clamp(ad.load*f,0.6,1.25);return Math.round((ad.load/before-1)*100);}

export function setFitness(np,why,force){
  const old=state.fitness.p;
  if(np<old&&!force){
    // como mucho un 3 % de mejora por semana: los datos de GPS y las sesiones cortas engañan
    const lim=addDays(today(),-7),h=state.fitness.history;
    const before=h.filter(x=>x.date<lim);
    const base=before.length?before[before.length-1].p:(h.length?h[0].p:old);
    np=Math.max(np,base*0.97);
    if(np>=old-0.5) return false;
  }
  if(np>old&&!force) np=Math.min(np,old*1.02); // empeorar también va poco a poco
  if(Math.abs(np-old)<0.5) return false;
  state.fitness.p=np;
  state.fitness.history.push({date:today(),p:np,why:String(why).replace(/\.$/,'')});
  if(typeof refreshKm==='function'&&state.plan) refreshKm();
  const d=Math.round((old-np)*5);
  addEvent(np<old?'up':'down',`${why} Tu 5 km estimado pasa de ${ft(old*5)} a ${ft(np*5)} (${d>0?'−':'+'}${ft(Math.abs(d))}). Todos los ritmos se han actualizado.`);
  return true;
}

export function _logDone(s,log){
  const d=describe(s),ad=state.adapt,p=state.fitness.p,td=today();
  s.status='done';
  s.log=Object.assign({at:Date.now()},log);
  s.rpeExp=d.rpe;s.snap={title:d.title,lo:d.lo,hi:d.hi,rpe:d.rpe,km:s.km,main:d.blocks.filter(b=>b.k==='main').map(b=>({t:b.t,reps:b.reps||1,dist:b.dist||null,dur:b.dur||null,lo:b.lo,hi:b.hi}))};
  const pace=log.gap||(log.km&&log.time?gapFromElev(log.time,log.km,log.elev):null);
  // 1) Test o carrera: actualiza la forma directamente
  if((s.type==='test'||s.type==='race')&&log.time&&!log.noTest){
    const dist=log.km||(s.type==='test'?5:s.km);
    const np=log.time*Math.pow(5/dist,1.06)/5;
    if(np>150&&np<720) setFitness(np,s.type==='test'?'Test registrado.':'Carrera registrada.',true);
  }
  // 2) Calidad con ritmo de la parte fuerte
  else if(['series','tempo','ritmo'].includes(s.type)&&log.workPace&&d.pf){
    const implied=log.workPace/d.pf;
    if(implied<p*0.985&&log.rpe<=d.rpe+1){
      const np=Math.max(p*0.97,p-(p-implied)*0.5);
      setFitness(np,`Has ido más rápido de lo previsto en ${d.title.toLowerCase()} sin que te costara de más.`);
    }else if(implied>p*1.03&&log.rpe>=d.rpe+2){
      setFitness(p*1.015,`La sesión de ${d.title.toLowerCase()} salió más lenta y costó más de lo esperado.`);
    }
  }
  // 3) Rodajes demasiado rápidos
  const hm=hrMaxNow();
  const easyRun=s.type==='easy'||s.type==='long';
  const fastPace=easyRun&&pace&&pace<p*1.12&&log.rpe>=5;
  const z2=hrBounds(2),fastHR=easyRun&&log.hr&&z2&&log.hr>z2[1]*1.02;
  if((fastPace||fastHR)&&(!ad.lastFastTip||daysBetween(ad.lastFastTip,td)>=14)){
    ad.lastFastTip=td;
    addEvent('info',fastHR?`Tu rodaje suave salió con ${Math.round(log.hr)} ppm de media, por encima de tu zona suave (hasta ${z2[1]} ppm). Para que sea suave, quédate por debajo aunque tengas que ir más lento.`
      :`Tu rodaje fue a ${fp(pace)} /km, más rápido que tu zona suave (${fp(p*1.22)}–${fp(p*1.34)}). Ir más lento en los suaves te deja fuerzas para las sesiones de calidad.`);
  }
  // 4) Sesión muy dura: suaviza la siguiente de calidad
  if(log.rpe-d.rpe>=4){
    const nx=state.sessions.find(x=>x.status==='pending'&&x.date>td&&daysBetween(td,x.date)<=2&&QUALITY.includes(x.type)&&x.type!=='race');
    if(nx){addEvent('down',`La última sesión fue mucho más dura de lo previsto. Cambio ${TYPES[nx.type].n.toLowerCase()} del ${DAYS_L[dow(nx.date)]} por un rodaje suave.`);nx.type='easy';nx.converted=true;}
  }
  feelCheck();
}

export function newEvents(f){const out=[];for(const e of state.adapt.events){if(e===f)break;out.push(e.text);}return out;}

export function logDone(s,log){const f=state.adapt.events[0];_logDone(s,log);s.log.events=newEvents(f).reverse();}

export function feelCheck(){
  const ad=state.adapt;
  const recent=state.sessions.filter(x=>x.status==='done'&&x.log&&x.log.rpe&&x.log.at>ad.feelFrom&&x.rpeExp).sort((a,b)=>a.log.at-b.log.at).slice(-4);
  if(recent.length>=3){
    const avg=recent.reduce((a,x)=>a+(x.log.rpe-x.rpeExp),0)/recent.length;
    if(avg>=1.5){
      const pct=setLoad(0.9);ad.intensity=Math.max(-2,ad.intensity-1);ad.feelFrom=Date.now();
      addEvent('down',`Tus últimas ${recent.length} sesiones te han costado más de lo previsto. Bajo el volumen un ${Math.abs(pct)} % y suavizo las sesiones de calidad.`);
      regenerate();
    }else if(avg<=-1.5&&recent.length>=4&&adherence(21).ratio>=0.8){
      const pct=setLoad(1.05);ad.intensity=Math.min(1,ad.intensity+1);ad.feelFrom=Date.now();
      addEvent('up',`Estás asimilando bien la carga: tus últimas sesiones te resultaron fáciles. Subo el volumen un ${pct} % y añado algo de intensidad.`);
      regenerate();
    }
  }
}

export function rateSession(s,rpe){
  if(!s||!s.log) return;
  s.log.rpe=rpe;s.log.rpeSrc='tú';s.log.needsFeel=false;s.log.at=Date.now();
  const f=state.adapt.events[0];feelCheck();s.log.events=(s.log.events||[]).concat(newEvents(f).reverse());
}

export function adherence(days){
  const td=today(),from=addDays(td,-(days-1));
  const xs=state.sessions.filter(s=>s.date>=from&&s.date<=td&&(s.status==='done'||s.status==='skipped'));
  const done=xs.filter(s=>s.status==='done').length;
  return {done,total:xs.length,ratio:xs.length?done/xs.length:1};
}

export function skip(s,auto){
  const td=today(),ad=state.adapt;
  s.status='skipped';s.auto=!!auto;
  const msgs=[];
  const oldWeek=monday(s.date)<monday(td); // de una semana ya pasada: no se puede recolocar
  if(KEY_TYPES.includes(s.type)&&!s.moved&&!oldWeek){
    const wkEnd=addDays(monday(s.date),6);
    const from=s.date<td?td:addDays(s.date,1);
    const occ=new Set(state.sessions.filter(x=>x.status!=='skipped').map(x=>x.date));
    const cands=[];for(let d=from;d<=wkEnd;d=addDays(d,1)) if(!occ.has(d)) cands.push(d);
    const keyDates=state.sessions.filter(x=>x.status==='pending'&&KEY_TYPES.includes(x.type)).map(x=>x.date);
    const raceD=state.sessions.filter(x=>x.type==='race').map(x=>x.date);
    const ok=d=>!keyDates.some(k=>Math.abs(daysBetween(d,k))<=1)&&!raceD.some(k=>Math.abs(daysBetween(d,k))<=2);
    const target=cands.find(ok);
    const nm=TYPES[s.type].n.toLowerCase();
    if(target){
      state.sessions.push(Object.assign({},s,{id:uid(),date:target,status:'pending',moved:true,auto:false,log:null,from:s.date}));
      msgs.push(`No hiciste ${nm} del ${DAYS_L[dow(s.date)]}: la paso al ${DAYS_L[dow(target)]} ${pd(target).getDate()}.`);
    }else if(s.type==='long'){
      const e=state.sessions.find(x=>x.status==='pending'&&x.type==='easy'&&x.date>=td&&x.date<=wkEnd&&ok(x.date));
      if(e){e.type='long';e.km=r05(Math.max(e.km,s.km*0.8));e.converted=true;msgs.push(`No hiciste la tirada larga: convierto el rodaje del ${DAYS_L[dow(e.date)]} en una tirada de ${fk(e.km)} km.`);}
      else msgs.push('No hiciste la tirada larga y no queda hueco esta semana. Sin problema: seguimos con el plan.');
    }else msgs.push(`No hiciste ${nm}. No queda un hueco con descanso suficiente esta semana, así que la dejamos pasar.`);
  }
  msgs.forEach(m=>addEvent('info',m));
  const a=adherence(14);
  if(a.total>=3&&a.ratio<=0.6&&(!ad.lastMissAdj||daysBetween(ad.lastMissAdj,td)>=7)){
    ad.lastMissAdj=td;const pct=setLoad(0.9);ad.intensity=Math.max(-2,ad.intensity-1);
    addEvent('down',`Has completado ${a.done} de ${a.total} sesiones en dos semanas. Bajo la carga un ${Math.abs(pct)} % para que retomes sin riesgo de lesión.`);
  }
  regenerate();
}

export function processMissed(){
  const td=today();
  if(state.pause){
    if(state.pause.to&&state.pause.to<td){resumePlan();return true;}
    let ch=false;state.sessions.forEach(s=>{if(s.status==='pending'&&s.date<td&&s.date>=state.pause.from){s.status='paused';ch=true;}});
    return ch;
  }
  let changed=goalCheck();
  // si Strava no ha podido sincronizar, damos margen: la carrera de ayer puede no haber llegado aún
  const cutoff=stravaOn()&&syncFailed?addDays(td,-2):td;
  const missed=state.sessions.filter(s=>s.status==='pending'&&s.date<cutoff).sort((a,b)=>a.date<b.date?-1:1);
  missed.forEach(s=>{skip(s,true);changed=true;});
  const old=missed.filter(s=>monday(s.date)<monday(td)).length;
  if(old) addEvent('info',`${old} sesi${old===1?'ón':'ones'} de semanas anteriores sin registrar. Las doy por no hechas y el plan sigue desde hoy.`);
  const acts=activities().filter(a=>a.date<=td);
  const last=acts.length&&acts[acts.length-1].date>state.plan.created?acts[acts.length-1].date:state.plan.created;
  const ad=state.adapt;
  if(daysBetween(last,td)>=10&&(!ad.lastGapAdj||daysBetween(ad.lastGapAdj,td)>=10)&&daysBetween(state.plan.created,td)>=10){
    ad.lastGapAdj=td;const pct=setLoad(0.85);ad.intensity=Math.max(-2,ad.intensity-1);
    addEvent('down',`Llevas ${daysBetween(last,td)} días sin correr. Bajo la carga un ${Math.abs(pct)} % para volver poco a poco.`);
    if(daysBetween(last,td)>=14) setFitness(state.fitness.p*1.02,'Tras dos semanas o más sin correr se pierde algo de forma.');
    regenerate();changed=true;
  }
  refreshKm(); // los ritmos objetivo cambian con los días: los km mostrados se recalculan
  return changed;
}
