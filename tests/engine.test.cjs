// Prueba de robustez del motor: simula 60 corredores distintos durante 160 días
// (entrenos hechos, saltados, movidos, pausas, chequeos, calor, Strava...) y
// comprueba invariantes del plan y que ninguna pantalla muestre NaN/undefined.
// Uso: node tests/engine.test.cjs  → termina con código 1 si hay problemas.
const E=require('./harness.cjs').loadApp();
E.setT=d=>{E.TODAY_OVERRIDE=d;};
let seed=1;const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};const pick=a=>a[Math.floor(R()*a.length)];
const problems=[];
function check(tag){
  const S=E.state;
  for(const s of S.sessions){
    if(!(s.km>0)||!isFinite(s.km)) problems.push(`${tag}: km inválido ${s.type} ${s.km}`);
    if(!/^\d{4}-\d\d-\d\d$/.test(s.date)) problems.push(`${tag}: fecha ${s.date}`);
    const d=E.describe(s);
    if(!d.blocks.length) problems.push(`${tag}: sin bloques ${s.type}`);
    for(const b of d.blocks){ if(b.lo!=null&&!(b.lo>100&&b.lo<1200)) problems.push(`${tag}: ritmo raro ${s.type} ${b.t} ${b.lo}`); if(b.dist!=null&&!(b.dist>0)) problems.push(`${tag}: bloque dist ${s.type} ${b.t} ${b.dist}`);}
    if(!(d.dur>0&&d.dur<600)) problems.push(`${tag}: duración ${s.type} ${d.dur}`);
    if(s.mod&&s.mod.kind==='short'&&s.status==='pending'&&!['race','runwalk'].includes(s.type)&&d.dur>36) problems.push(`${tag}: sesión acortada dura ${d.dur} min (${s.type})`);
    const mm=S.profile.maxMin;if(mm&&s.status==='pending'&&!['long','race','test','runwalk'].includes(s.type)&&d.dur>mm*1.25+5) problems.push(`${tag}: ${s.type} dura ${d.dur} min con máximo ${mm}`);
    if(S.profile.hills===false&&s.status==='pending'&&s.type==='cuestas') problems.push(`${tag}: cuestas sin cuestas`);
    if(['series','tempo','ritmo','fartlek','test'].includes(s.type)&&s.status==='pending'&&Math.abs(d.estKm-s.km)>0.6) problems.push(`${tag}: km ${s.type} ${s.km} vs bloques ${d.estKm.toFixed(1)}`);
    if(s.status==='done') E.analyze(s);
  }
  // como mucho una sesión pendiente por día
  const byDay={};S.sessions.filter(s=>s.status==='pending').forEach(s=>{byDay[s.date]=(byDay[s.date]||0)+1;});
  for(const k in byDay) if(byDay[k]>1) problems.push(`${tag}: ${byDay[k]} sesiones pendientes el ${k}`);
  if(!(S.fitness.p>150&&S.fitness.p<720)) problems.push(`${tag}: p=${S.fitness.p}`);
  if(S.plan&&S.plan.longs){const peak=Math.max(...S.plan.longs.filter(x=>x!=null));if(!(peak>0&&peak<=33))problems.push(`${tag}: tirada máxima ${peak}`);}
  const sh=E.shoes();sh.forEach(x=>{const k=E.shoeKm(x);if(!(k>=0&&isFinite(k)))problems.push(`${tag}: km zapatilla ${k}`);});
  const ls=E.loadSeries();if(ls.some(x=>!isFinite(x.ctl)||!isFinite(x.atl)))problems.push(`${tag}: carga no finita`);
  if(!(S.adapt.load>=0.6&&S.adapt.load<=1.25)) problems.push(`${tag}: load ${S.adapt.load}`);
  for(const f of ['renderHoy','renderPlan','renderProgreso','renderZonas','renderPerfil']){
    E[f]();const h=E.app.innerHTML;
    if(/NaN|undefined|Infinity|\[object/.test(h)) problems.push(`${tag}: ${f} contiene ${h.match(/.{40}(NaN|undefined|Infinity|\[object).{20}/)?.[0]}`);
  }
}
const goals=Object.keys(E.GOALS),levels=Object.keys(E.LEVELS);
for(let run=0;run<60;run++){
  seed=run+7;
  E.setT('2026-11-11');E.state=E.blankState();
  const goal=pick(goals),level=pick(levels),nd=2+Math.floor(R()*5);
  const days=[...new Set(Array.from({length:nd},()=>Math.floor(R()*7)))].sort();
  if(days.length<2) days.push((days[0]+3)%7);
  const pr={name:'',goal,level,weeklyKm:Math.floor(R()*50),days:days.sort((a,b)=>a-b),longDay:days[days.length-1],weeks:pick([6,8,10,12,16]),
    raceDate:E.GOALS[goal].dist&&R()<0.5?E.addDays('2026-11-11',30+Math.floor(R()*120)):null,refDist:null,refTime:null,
    targetTime:E.GOALS[goal].dist&&R()<0.6?Math.round(E.GOALS[goal].dist*(240+R()*240)):null,hrMax:R()<0.5?185:null,age:R()<0.3?Math.floor(15+R()*60):null,
    marks:R()<0.6?[{d:5,t:Math.round(5*(230+R()*200)),date:E.addDays('2026-11-11',-Math.floor(R()*700))},{d:10,t:Math.round(10*(240+R()*200)),date:E.addDays('2026-11-11',-Math.floor(R()*400))}]:[],
    raceElev:pick([0,2,8,15,30]),maxMin:pick([null,30,45,60,90]),hills:R()<0.7,first:R()<0.4,strength:R()<0.8};
  const tag=`#${run} ${goal}/${level}/${days.join('')}`;
  try{
    // funciones opcionales: ciclo, zapatillas
    const useCycle=R()<0.4,useShoes=R()<0.5;
    if(useCycle){E.setupCycle({mode:pick(['natural','natural','pildora','otro']),last:E.addDays('2026-11-11',-Math.floor(R()*28)),len:24+Math.floor(R()*10),plen:4+Math.floor(R()*3),adapt:R()<0.8});}
    if(useShoes){E.addShoe({name:'A',startKm:Math.floor(R()*600)});if(R()<0.5)E.addShoe({name:'B',kind:'ligeras'});}
    E.createPlan(pr,false);check(tag+' inicio');
    if(pr.goal!=='forma'&&!E.state.sessions.some(x=>x.type==='race')) problems.push(tag+': sin sesión de carrera');
    // wizard/preview render
    E.setDraft(E.draftFromProfile(E.state.profile));E.setWiz({i:6,mode:'new',dir:1});E.renderWizard();
    let d='2026-11-11';
    for(let k=0;k<160;k++){
      E.setT(d);E.processMissed();
      const todayS=E.state.sessions.find(x=>x.date===d&&x.status==='pending');
      const r=R();
      if(E.state.pause){ if(r<0.15) E.resumePlan(); }
      else if(todayS){
        if(r<0.65){const ds=E.describe(todayS);E.logDone(todayS,{rpe:pick([2,4,6,8,10]),km:todayS.km*(0.8+R()*0.4),time:todayS.km*ds.lo*(0.95+R()*0.2),workPace:ds.pf&&R()<0.5?E.state.fitness.p*ds.pf*(0.95+R()*0.1):null});}
        else if(r<0.8) E.skip(todayS,false);
        else if(r<0.9){const o=E.moveOptions(todayS).filter(x=>!x.blocked);if(o.length)E.moveSession(todayS,pick(o).d);}
      }
      if(R()<0.01&&!E.state.pause) E.startPause(pick(['lesion','enfermedad','viaje']),R()<0.5?E.addDays(d,5+Math.floor(R()*20)):null);
      if(R()<0.005){const p2={...E.state.profile,weeklyKm:20,days:[1,3,5,6],longDay:6};E.createPlan(p2,true);}
      if(R()<0.3){E.state.checkins=E.state.checkins||{};E.state.checkins[d]={sleep:1+Math.floor(R()*3),legs:1+Math.floor(R()*3),stress:1+Math.floor(R()*3),pain:R()<0.1?1:R()<0.2?2:3};
        const rd=E.readiness(d),ts=E.state.sessions.find(x=>x.date===d&&x.status==='pending');if(rd&&ts&&rd.v!=='go'&&R()<0.7)E.applyMod(ts,rd.v,'test');}
      if(R()<0.03){const ts=E.state.sessions.find(x=>x.date>=d&&x.status==='pending'&&x.type!=='race');if(ts&&!E.state.pause)E.doNot100(ts,pick(['tired','time','ache','sick']));}
      if(R()<0.2){E.state.wx={at:Date.now(),key:'x',days:{}};for(let j=0;j<7;j++)E.state.wx.days[E.addDays(d,j)]={t:15+R()*20,td:5+R()*15,adj:E.heatAdj(15+R()*20,5+R()*15)};E.refreshKm();}
      if(k%7===0){E.strengthDays(E.addDays(d,-((new Date(d).getDay()+6)%7)));E.weekLoadInfo();E.intensityDist();E.predictToday(E.state.fitness.p,42.195);}
      if(R()<0.05){E.state.manual=E.state.manual||[];E.state.manual.push({id:'m'+k,date:d,type:'easy',km:5+R()*5,time:1800+R()*900,rpe:4,elev:Math.floor(R()*200),hr:null,gap:null});}
      const done=E.state.sessions.find(x=>x.status==='done'&&x.log&&!x.log.rpeSrc);if(done&&R()<0.05)E.rateSession(done,6);
      if(R()<0.15){const t=pick(Object.keys(E.XT));E.addXt({type:t,date:d,min:15+Math.floor(R()*120),rpe:pick([2,4,6,8,10]),focus:R()<0.3?pick(Object.keys(E.XT_FOCUS)):null,name:t==='otro'?'X':null});}
      if(useCycle&&E.state.cycle&&E.state.cycle.on){
        const ph=E.phaseOf(d);
        if((!ph||ph.day>=E.cycleLen()-1)&&R()<0.4){if(E.addPeriodStart(d))E.regenerate();}
        if(E.askSymptoms(d)&&E.state.checkins&&E.state.checkins[d])E.state.checkins[d].cyc=1+Math.floor(R()*3);
        if(R()<0.02){const ts=E.state.sessions.find(x=>x.date===d&&x.status==='pending');if(ts)E.doNot100(ts,'period');}
        E.cycleSchedule();E.cycleInsights();
        // ninguna sesión movida por el ciclo cae antes de hoy ni fuera de su semana
        E.state.sessions.filter(x=>x.cyc&&!x.cyc.swap&&x.status==='pending').forEach(x=>{if(E.monday(x.date)!==E.monday(x.cyc.from))problems.push(tag+': movida por ciclo a otra semana');});
      }
      if(useShoes&&R()<0.05)E.ackShoe(E.activeShoes()[0]||E.shoes()[0]);
      if(R()<0.01&&E.activeShoes().length>1)E.retireShoe(E.activeShoes()[0]);
      E.strengthDoneOn(d);E.shoeAlerts();E.finishInfo();
      if(k%7===0) check(tag+' '+d);
      d=E.addDays(d,1);
    }
  }catch(e){problems.push(`${tag}: EXCEPCIÓN ${e.stack.split('\n').slice(0,3).join(' | ')}`);}
}
const uniq=[...new Set(problems.map(p=>p.replace(/#\d+ \S+ /,'').replace(/\d{4}-\d\d-\d\d/g,'D').slice(0,140)))];
console.log('problemas:',problems.length);uniq.slice(0,40).forEach(p=>console.log(' -',p));
const S=E.state;console.log('última simulación:',S.profile.goal,'sesiones',S.sessions.length,'hechas',S.sessions.filter(s=>s.status==='done').length,'saltadas',S.sessions.filter(s=>s.status==='skipped').length,'pausa',S.sessions.filter(s=>s.status==='paused').length,'eventos',S.adapt.events.length,'html',E.app.innerHTML.length);
E.renderHoy();console.log(E.app.innerHTML.slice(0,300).replace(/\s+/g,' '));
// casos límite
const edge=[
  ['domingo de inicio','2026-11-15',{goal:'10k',level:'intermedio',weeklyKm:20,days:[0,2,4,6],longDay:6,weeks:8}],
  ['carrera a 14 días','2026-11-11',{goal:'5k',level:'avanzado',weeklyKm:40,days:[1,3,5,6],longDay:6,raceDate:'2026-11-25',targetTime:1200}],
  ['7 días','2026-11-11',{goal:'21k',level:'avanzado',weeklyKm:60,days:[0,1,2,3,4,5,6],longDay:6,weeks:12,targetTime:5400}],
  ['principiante maratón','2026-11-11',{goal:'42k',level:'nuevo',weeklyKm:0,days:[1,3,6],longDay:6,raceDate:'2027-04-18',targetTime:5*3600}],
  ['forma 2 días','2026-11-11',{goal:'forma',level:'nuevo',weeklyKm:0,days:[2,5],longDay:5,weeks:4}],
  ['larga entre semana','2026-11-11',{goal:'10k',level:'intermedio',weeklyKm:25,days:[0,2,3],longDay:2,weeks:6}],
];
for(const [n,t,p] of edge){
  try{E.setT(t);E.state=E.blankState();E.createPlan(Object.assign({name:'',refDist:null,refTime:null,raceDate:null,targetTime:null,hrMax:null,age:null},p),false);check(n);
    const S=E.state;console.log(n.padEnd(22),S.plan.curve.length+' sem','| 1ª:',S.sessions.filter(s=>s.week===0).map(s=>s.type+':'+s.km).join(' '),'| última:',S.sessions.filter(s=>s.week===S.plan.curve.length-1).map(s=>s.date.slice(5)+' '+s.type+':'+s.km).join(' '));
  }catch(e){console.log('ERROR',n,e.stack.split('\n').slice(0,3).join(' | '));}
}
// Strava: emparejado y análisis con vueltas reales de series
E.setT('2026-11-11');E.state=E.blankState();
E.createPlan({name:'',goal:'10k',level:'intermedio',weeklyKm:30,days:[1,3,6],longDay:6,weeks:10,raceDate:null,refDist:10,refTime:2900,targetTime:null,hrMax:185,age:null},false);
const sv=E.sv();sv.tokens={access:'x',refresh:'y',expiresAt:9e9};
const series=E.state.sessions.find(s=>s.type==='series'||s.type==='fartlek'||s.type==='cuestas');
const ds=E.describe(series);const mb=ds.blocks.find(b=>b.k==='main');
const laps=[{km:2,sec:2*360,hr:140}];for(let i=0;i<(mb.reps||5);i++){laps.push({km:mb.dist||0.25,sec:Math.round((mb.dist||0.25)*(mb.lo||270)*(i>3?1.04:1)),hr:170});laps.push({km:0.3,sec:120,hr:150});}laps.push({km:1.5,sec:1.5*370,hr:140});
const tk=laps.reduce((a,l)=>a+l.km,0),ts=laps.reduce((a,l)=>a+l.sec,0);
sv.runs.push({id:99,date:series.date,name:'Series',km:tk,sec:ts,hr:158,hrMax:180,elev:0,rpe:null,race:false,type:'Run',detail:true,be:[],laps,splits:[],sessionId:null,extra:false});
E.setT(series.date);const res=E.afterSync();
const a=E.analyze(series);console.log('\nemparejada:',res.matched,'| veredicto:',a&&a.verdict[0]);a&&a.items.forEach(i=>console.log('  ',i.ok,i.label,'-',i.text));
console.log('  vueltas de trabajo:',a&&a.laps&&a.laps.length,'previstas',mb.reps);
// datos guardados por versiones anteriores de la app
E.setT('2026-11-11');E.state=E.blankState();
E.createPlan({name:'',goal:'10k',level:'intermedio',weeklyKm:25,days:[1,3,6],longDay:6,weeks:10,raceDate:null,refDist:null,refTime:null,targetTime:null},false);
E.setT('2026-11-20');E.state.sessions.filter(s=>s.date<'2026-11-20').forEach((s,i)=>{if(i%2)E.logDone(s,{rpe:5,km:s.km,time:s.km*360});});
const old=JSON.parse(JSON.stringify(E.state));
delete old.profile.hrMax;delete old.profile.age;delete old.profile.targetTime;delete old.plan.goal;delete old.plan.rwStart;delete old.plan.rwWeeks;delete old.adapt.lastFatigue;delete old.adapt.summarySeen;delete old.strava;
old.sessions.forEach(s=>{if(s.snap){delete s.snap.main;delete s.snap.rpe;delete s.snap.km;}if(s.log){delete s.log.events;delete s.log.rpeSrc;}});
E.state=old;
try{E.processMissed();check('versión antigua');E.setDraft(E.draftFromProfile(E.state.profile));E.setWiz({mode:'edit',key:'when',i:0,dir:1});E.renderWizard();console.log('versión antigua OK');}catch(e){console.log('versión antigua ERROR',e.stack.split('\n').slice(0,3).join(' | '));}
if(problems.length) process.exit(1);
