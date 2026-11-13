/**
 * Asistente de configuración (8 pasos) y vista previa del plan.
 */
import { DAYS, DAYS_L, addDays, daysBetween, dow, esc, fdLong, fdShort, fk, ft, monday, parseTime, pd, today } from '../../core/util.js';
import { GOALS, LEVELS } from '../../model/constants.js';
import { save, setState, state, stravaOn } from '../../core/store.js';
import { ageAdj, ageNote } from '../../model/plan.js';
import { describe } from '../../model/workouts.js';
import { AGE_OPTS, MARK_D, PR_NAME, allMarks, bestMark, fdMark, markName, marksFromDraft, stravaPRs } from '../../model/marks.js';
import { ELEV, elevName, elevPen } from '../../model/elevation.js';
import { TARGET_PH, goalEval, raceTime } from '../../model/goal.js';
import { createPlan } from '../../model/adapt.js';
import { afterSync, stravaSummary } from '../../model/activities.js';
import { wxRefresh } from '../../services/weather.js';
import { $, app } from '../dom.js';
import { intPicker, pickerHTML, timeField } from '../pickers.js';
import { prefillFromStrava, stravaPrefillCard, stravaSection } from './perfil.js';
import { toast } from '../toast.js';
import { closeSheet, lastTab, openSheet, route, setLastTab } from '../router.js';
import { finishEval, finishTime, isFinish, needsLongPlan } from '../../model/finish.js';

export function draftP(d){
  if(state.fitness&&state.profile) {const bm=bestMark({marks:marksFromDraft(d)});return bm&&bm.src==='manual'&&bm.p<state.fitness.p*0.97?bm.p:state.fitness.p;}
  const b=bestMark({marks:marksFromDraft(d)});
  return b?b.p:LEVELS[d.level].p;
}

export function goalHint(d){
  const g=GOALS[d.goal];if(!g.dist) return '';
  const p0=draftP(d);
  const weeks=d.raceDate?Math.floor(daysBetween(monday(today()),monday(d.raceDate))/7)+1:+d.weeks||g.defWeeks;
  const pen=d.hasDate||true?0.001485*(+d.raceElev||0):0;
  const cur=`Con tu forma actual harías unos <b class="num">${ft(raceTime(p0,g.dist)*(1+pen))}</b>${pen>0.005?' en ese recorrido':''}.`;
  const T=parseTime(d.targetTime);
  const pr={goal:d.goal,level:d.level,weeklyKm:parseFloat(String(d.weeklyKm).replace(',','.'))||0,first:firstOf(d),targetTime:aimOf(d)==='time'?T:null,raceElev:+d.raceElev||0,age:+d.age||null};
  if(aimOf(d)==='finish') return finishText(pr,p0,weeks);
  const extra=needsLongPlan(pr)?' '+finishText(pr,p0,weeks):'';
  if(!T) return cur+' Escribe la marca que quieres hacer.';
  if(T/g.dist<150||T/g.dist>720) return 'Escribe la marca como 45:00 o 1:45:00.';
  const G=goalEval({goal:d.goal,level:d.level,targetTime:T,raceElev:+d.raceElev||0,age:+d.age||null},p0,weeks);
  const pct=(G.needed*100).toFixed(1).replace('.',',');
  return cur+' '+({
    'ya':'Tu forma ya da para esa marca: puedes ponerte un objetivo más ambicioso.',
    'alcanzable':`Mejorar un ${pct} % en ${weeks} semanas es alcanzable.`,
    'ambicioso':`Mejorar un ${pct} % en ${weeks} semanas es ambicioso: el plan tendrá más volumen y calidad.`,
    'poco realista':`Mejorar un ${pct} % en ${weeks} semanas es poco realista: lo razonable sería unos <b class="num">${ft(G.realistic)}</b>. Puedes mantenerlo, pero el ritmo de carrera se entrenará con una referencia alcanzable.`
  })[G.status]+extra;
}

const aimOf=d=>d.aim||(String(d.targetTime||'').trim()?'time':'finish');
const firstOf=d=>d.first===true||d.first==='1';
const the=g=>g.dist>40?'la maratón':g.dist>20?'la media maratón':`los ${g.name}`;

/** Texto de viabilidad para terminar (o para una primera media/maratón): tirada larga y semanas. */
export function finishText(pr,p,weeks){
  const g=GOALS[pr.goal],E=finishEval(pr,p,weeks);
  const T=finishTime(pr,p);
  let t=`${isFinish(pr)?`Hoy terminarías ${the(g)} en unos <b class="num">${ft(T)}</b> (con margen de prudencia).`:''}`;
  if(!E) return t+(isFinish(pr)?' El plan te prepara para llegar a meta entera.':'');
  t+=` La tirada larga irá de ${fk(E.L0)} a <b class="num">${fk(E.status==='corto'||E.status==='insuficiente'?E.reach:E.peak)} km</b>.`;
  t+=' '+({
    holgado:'Hay tiempo de sobra para prepararla con calma.',
    justo:'Hay el tiempo justo: la constancia será la clave.',
    corto:`Vas algo justo de semanas: la tirada más larga se quedará en unos ${fk(E.reach)} km (lo ideal son ${fk(E.peak)}). Se puede terminar, pero si puedes, elige una fecha más tarde (lo ideal: ${E.needWeeks} semanas).`,
    insuficiente:`Con ${weeks} semanas no da tiempo a prepararla con seguridad: harían falta unas <b>${E.needWeeks}</b>. ${pr.goal==='42k'?'Te recomiendo una fecha más tarde o empezar por una media maratón.':'Te recomiendo una fecha más tarde.'}`
  })[E.status];
  if(E.runWalk) t+=' A tu ritmo actual, te recomiendo hacerla corriendo y andando: el plan te enseña cómo.';
  return t;
}

export function markHint(d){
  const bm=bestMark({marks:marksFromDraft(d)});
  if(!bm) return 'Sin marcas, empiezo con una estimación según tu nivel y la ajusto con tus primeros entrenos.';
  return `Con ${allMarks({marks:marksFromDraft(d)}).length>1?'estas marcas':'esta marca'}, tu forma estimada hoy es <b class="num">${ft(bm.p*5)}</b> en 5 km y <b class="num">${ft(raceTime(bm.p,10))}</b> en 10 km. Se basa sobre todo en la de ${markName(bm.d).toLowerCase()}.`;
}

export let draft=null; // borrador del formulario de perfil

/* =========================================================
   Configuración paso a paso
   ========================================================= */
export let wiz=null; // {i, mode:'new'|'edit', key, dir}

export const GOAL_SUB={'5k':'Ganar velocidad','10k':'La distancia clásica','21k':'21,1 km de resistencia','42k':'42,2 km: el gran reto','forma':'Correr con constancia, sin carrera'};

export const REF_D=[['','Ninguna'],[5,'5 km'],[10,'10 km'],[21.0975,'Media'],[42.195,'Maratón']];

export function defaultDraft(){
  return {name:'',goal:'10k',hasDate:false,raceDate:'',weeks:10,targetTime:'',raceElev:2,level:'intermedio',weeklyKm:10,days:[1,3,6],longDay:6,maxMin:'',hills:true,hrMax:'',age:'',mt0:'',mt1:'',mt2:'',mt3:'',ma0:90,ma1:90,ma2:90,ma3:90};
}

export function draftFromProfile(p){
  const d={...defaultDraft(),...p,hasDate:!!p.raceDate,raceDate:p.raceDate||'',targetTime:p.targetTime?ft(p.targetTime):'',aim:p.targetTime||!GOALS[p.goal].dist?'time':'finish',first:!!p.first,raceElev:p.raceElev||2,maxMin:p.maxMin||'',hills:p.hills!==false,hrMax:p.hrMax||'',age:p.age||'',days:[...p.days]};
  let marks=p.marks||[];if(!marks.length&&p.refDist&&p.refTime) marks=[{d:p.refDist,t:p.refTime,date:addDays(today(),-30)}];
  MARK_D.forEach(([dist],i)=>{const m=marks.find(x=>Math.abs(x.d-dist)<0.01);if(m){d['mt'+i]=ft(m.t);const ago=m.date?daysBetween(m.date,today()):90;d['ma'+i]=(AGE_OPTS.find(([v])=>ago<=v*1.5)||AGE_OPTS[4])[0];}});
  return d;
}

export function wizSteps(){return wiz&&wiz.mode==='edit'?[wiz.key]:['strava','goal','when','level','marks','week','you','review'];}

export const STEP_N={goal:'Objetivo',when:'Tu carrera',level:'Tu nivel',marks:'Tus marcas',week:'Tu semana',you:'Sobre ti'};

export function renderSetup(){ // primera vez
  if(!wiz||wiz.mode!=='new') wiz={i:0,mode:'new',dir:1,anim:true};
  if(!draft) draft=prefillFromStrava(defaultDraft());
  renderWizard();
}

export function chipBtns(act,opts,cur,extra){
  return opts.map(([v,l])=>`<button type="button" class="opt" data-act="${act}" data-v="${v}" aria-pressed="${String(cur)===String(v)}" ${extra||''}>${l}</button>`).join('');
}

export function stepHTML(key){
  const d=draft,g=GOALS[d.goal];
  switch(key){
    case 'strava':
      if(stravaOn()) return {q:'Ya tengo tu historial',h:'He leído tus carreras en Strava y he rellenado los siguientes pasos. Revisa y ajusta lo que quieras.',body:stravaPrefillCard(),next:'Seguir'};
      return {q:'¿Usas Strava?',h:'Si conectas Strava, rellenaré estos pasos con tu historial real y tus carreras se registrarán solas. Es opcional.',body:stravaSection().replace('<h3>Conectar Strava</h3>',''),next:'Seguir sin Strava',ghostNext:true};
    case 'goal':
      return {q:'¿Cuál es tu objetivo?',h:'Podrás cambiarlo cuando quieras.',body:`<div class="cards" role="radiogroup">${Object.entries(GOALS).map(([k,v])=>`<button type="button" class="ocard" role="radio" data-act="wset" data-f="goal" data-v="${k}" aria-checked="${d.goal===k}"><b>${v.name}</b><span>${GOAL_SUB[k]}</span></button>`).join('')}</div>`};
    case 'when':{
      if(!g.dist) return {q:'¿Cuántas semanas?',h:'Al terminar el bloque podrás encadenar otro partiendo de tu nueva forma.',body:`<div class="seg big">${chipBtns('wset',[4,6,8,10,12].map(n=>[n,`${n} sem.`]),d.weeks,'data-f="weeks"')}</div>`};
      const wk=d.raceDate?Math.floor(daysBetween(monday(today()),monday(d.raceDate))/7)+1:null;
      return {q:`Tu ${g.name.toLowerCase()==='media maratón'?'media maratón':g.name.toLowerCase()==='maratón'?'maratón':'carrera de '+g.name}`,h:'Con fecha, el plan termina justo el día de la carrera. Si es tu primera vez o solo quieres llegar a meta, elige «Terminarla»: el plan se centra en que llegues entera.',body:`
        <div><label>¿Tienes fecha?</label><div class="seg">${chipBtns('wset',[['1','Sí, tengo fecha'],['0','Todavía no']],d.hasDate?'1':'0','data-f="hasDate"')}</div></div>
        ${d.hasDate?`<div><label for="f-race">Día de la carrera</label><input id="f-race" type="date" data-f="raceDate" value="${d.raceDate}" min="${addDays(today(),14)}"><div class="hint" id="datehint">${d.raceDate?`${fdLong(d.raceDate)} · ${wk} semanas de plan`:'Elige el día en el calendario.'}</div></div>`
          :`<div><label>Duración del plan</label><div class="seg">${chipBtns('wset',[6,8,10,12,16,20].map(n=>[n,`${n} sem.`]),d.weeks,'data-f="weeks"')}</div></div>`}
        <div><label>Perfil del recorrido</label><div class="seg">${chipBtns('wset',ELEV.map(([v,l])=>[v,l]),d.raceElev,'data-f="raceElev"')}</div><div class="hint">≈ ${Math.round((+d.raceElev||0)*g.dist/10)*10} m de desnivel positivo en total. Afecta a la predicción y a las sesiones de cuestas.</div></div>
        <div><label>¿Qué quieres conseguir?</label><div class="seg">${chipBtns('wset',[['finish','Terminarla'],['time','Hacer un tiempo']],aimOf(d),'data-f="aim"')}</div></div>
        <div><label>¿Es tu primera ${g.dist>40?'maratón':g.dist>20?'media maratón':'carrera de '+g.name}?</label><div class="seg">${chipBtns('wset',[['1','Sí, la primera'],['0','Ya he hecho alguna']],firstOf(d)?'1':'0','data-f="first"')}</div></div>
        ${aimOf(d)==='time'?`<div>${timeField('f-tt','targetTime',d.targetTime,'dur','Ej. '+TARGET_PH[d.goal],'Marca que quieres hacer')}<div class="hint" id="goalhint" aria-live="polite">${goalHint(d)}</div></div>`
          :`<div class="hint" id="goalhint" aria-live="polite" style="margin-top:-4px">${goalHint(d)}</div>`}`};}
    case 'level':
      return {q:'¿Cómo estás ahora?',h:'Así empiezo a una carga que puedas asumir. Si conectaste Strava, ya viene rellenado.',body:`
        <div class="cards" role="radiogroup">${Object.entries(LEVELS).map(([k,v])=>`<button type="button" class="ocard" role="radio" data-act="wset" data-f="level" data-v="${k}" aria-checked="${d.level===k}"><b>${v.name}</b><span>${v.sub}</span></button>`).join('')}</div>
        <div><label>Kilómetros por semana ahora mismo</label>${intPicker('f-km','weeklyKm',0,150,1,Math.round(parseFloat(String(d.weeklyKm).replace(',','.'))||0),'km')}<div class="hint">${stravaOn()&&stravaSummary()?`Según Strava, ${fk(stravaSummary().km)} km de media en las últimas 4 semanas.`:'0 si estás empezando.'}</div></div>`};
    case 'marks':{
      const sp=stravaPRs(),bm=bestMark({marks:marksFromDraft(d)});
      return {q:'Tus mejores marcas',h:'Pon todas las que recuerdes, aunque sean antiguas: tengo en cuenta cuándo las hiciste. Con varias marcas, tus ritmos salen más precisos.',body:`
        ${sp.length?`<section class="card stack" style="gap:0"><span class="eyebrow" style="margin-bottom:4px">Encontradas en Strava</span>${sp.map(m=>`<div class="zrow"><span>${PR_NAME[m.key]}<br><span class="small muted">${fdMark(m.date)}</span></span><b class="num zv">${ft(m.t)}</b></div>`).join('')}<p class="small muted" style="margin-top:6px">Ya las uso. Añade abajo solo las que no estén en Strava.</p></section>`:''}
        ${MARK_D.map(([dist,n],i)=>`<div class="mark"><label>${n}</label>${pickerHTML('m-t'+i,'mt'+i,'dur',d['mt'+i],true)}
          ${d['mt'+i]?`<div class="seg small-seg" style="margin-top:8px">${chipBtns('wset',AGE_OPTS,d['ma'+i],`data-f="ma${i}"`)}</div>`:''}</div>`).join('')}
        <p class="hint" id="markhint" aria-live="polite">${markHint(d)}</p>`};}
    case 'week':{
      const ld=[...d.days].sort((a,b)=>a-b);
      return {q:'¿Qué días puedes correr?',h:'Entre 3 y 5 días es lo ideal. Si un día concreto no puedes, luego podrás mover esa sesión.',body:`
        <div class="days" role="group" aria-label="Días">${DAYS.map((n,i)=>`<button type="button" class="dayb" data-act="wday" data-v="${i}" aria-pressed="${d.days.includes(i)}">${n}</button>`).join('')}</div>
        <p class="hint" id="dayshint">${d.days.length} día${d.days.length===1?'':'s'} por semana${d.days.length<3?' · con 3 progresarás mejor':d.days.length>5?' · deja algún día de descanso':''}</p>
        <div><label>Día de la tirada larga</label><div class="seg">${chipBtns('wset',ld.map(i=>[i,DAYS_L[i][0].toUpperCase()+DAYS_L[i].slice(1)]),d.longDay,'data-f="longDay"')}</div><div class="hint">Mejor un día con tiempo y sin prisas.</div></div>
        <div><label>Tiempo máximo los demás días</label><div class="seg">${chipBtns('wset',[['30','30 min'],['45','45 min'],['60','1 h'],['75','1 h 15'],['90','1 h 30'],['','Sin límite']],d.maxMin,'data-f="maxMin"')}</div><div class="hint">Ajusto las sesiones entre semana para que quepan en ese tiempo.</div></div>
        <div><label>¿Tienes cuestas cerca para entrenar?</label><div class="seg">${chipBtns('wset',[['1','Sí'],['0','No']],d.hills?'1':'0','data-f="hills"')}</div><div class="hint">Si no, cambio las sesiones de cuestas por otras de ritmo.</div></div>`};}
    case 'you':
      return {q:'Un poco sobre ti',h:'Todo opcional. La edad ajusta la recuperación del plan (a partir de 50 años sube la carga más despacio y descansa más a menudo) y, si no sabes tu FC máxima, sirve para estimarla.',body:`
        <div><label for="f-name">Nombre</label><input id="f-name" data-f="name" value="${esc(d.name)}" autocomplete="given-name" enterkeyhint="done" autocapitalize="words"></div>
        <div class="grid2"><div><label>FC máxima</label>${intPicker('f-hr','hrMax',120,220,1,d.hrMax,'ppm','Sin dato')}${state.strava&&state.strava.hrMax?`<div class="hint">En Strava: ${state.strava.hrMax} ppm</div>`:''}</div>
        <div><label>Edad</label>${intPicker('f-age','age',10,90,1,d.age,'años','Sin dato')}</div></div>
        <div><label>FC en reposo <span class="muted">(opcional)</span></label>${intPicker('f-hrr','hrRest',35,100,1,d.hrRest,'ppm','Sin dato')}<div class="hint">Tómatela al despertar, tumbado. Afina el cálculo de la carga con el pulso.</div></div>
        <div><label>Ciudad <span class="muted">(opcional, para ajustar los ritmos al calor)</span></label>
          ${d.city?`<div class="row between card" style="padding:10px 12px"><span><b>${esc(d.city.name)}</b><br><span class="small muted">${esc(d.city.area||'')}</span></span><button type="button" class="ghost" style="min-height:36px;padding:4px 10px" data-act="geoclear">Quitar</button></div>`
          :`<div class="row"><input id="f-cityq" placeholder="Escribe tu ciudad" autocomplete="address-level2" enterkeyhint="search"><button type="button" data-act="geosearch">Buscar</button></div><div id="georesults" class="seg" style="margin-top:8px"></div>`}
          <div class="hint">Consulto la previsión en Open-Meteo, un servicio gratuito, solo con la ciudad. No se envía nada más.</div></div>
        ${d.city?`<div><label>¿A qué hora sueles correr?</label><div class="seg">${chipBtns('wset',[['8','Mañana'],['13','Mediodía'],['19','Tarde'],['21','Noche']],d.runHour||'8','data-f="runHour"')}</div></div>`:''}
        <div><label>Fuerza y movilidad</label><div class="seg">${chipBtns('wset',[['1','Incluir 2 sesiones cortas a la semana'],['0','No']],d.strength===false?'0':'1','data-f="strength"')}</div><div class="hint">20 minutos sin material. Previenen lesiones y mejoran la economía de carrera.</div></div>
        <p class="hint" id="agehint" aria-live="polite">${ageNote({age:+d.age})||(d.age?'Con tu edad el plan sigue la progresión normal.':'')}${!d.hrMax&&d.age&&!(state.strava&&state.strava.hrMax)?` FC máxima estimada: ${Math.round(208-0.7*d.age)} ppm.`:''}</p>`};
    case 'review':{
      const pv=previewPlan();
      return {q:'Tu plan',h:'Revisa que todo esté bien. Puedes tocar cualquier fila para cambiarla.',body:`
        ${pv?`<section class="hero stack" style="gap:10px"><div class="tiles"><div class="tile"><div class="k">Duración</div><div class="v num">${pv.weeks} sem.</div></div><div class="tile"><div class="k">Volumen</div><div class="v num">${Math.round(pv.km0)}→${Math.round(pv.peak)}</div><div class="k">km por semana</div></div></div>
          ${pv.goalText?`<p>${pv.goalText}</p>`:''}
          <div class="stack" style="gap:4px"><span class="eyebrow">Tu primera semana</span>${pv.first.map(x=>`<span class="small">${DAYS[dow(x.date)]} ${pd(x.date).getDate()} · <b>${x.title}</b> · ${x.len}</span>`).join('')||'<span class="small muted">Empieza el lunes que viene.</span>'}</div></section>`:''}
        <div class="list card" style="padding:0 14px">${summaryRows('wgo')}</div>`,next:'Crear mi plan'};}
  }
}

export function summaryRows(act){
  const d=draft,g=GOALS[d.goal],T=parseTime(d.targetTime);
  const rows=[
    ['goal','Objetivo',g.name],
    ['when',g.dist?'Tu carrera':'Duración',g.dist?`${d.hasDate&&d.raceDate?fdShort(d.raceDate):`${d.weeks} semanas`} · ${elevName(d.raceElev).toLowerCase()}${aimOf(d)==='time'&&T?` · ${ft(T)}`:' · terminarla'}${firstOf(d)?' · la primera':''}`:`${d.weeks} semanas`],
    ['level','Nivel',`${LEVELS[d.level].name} · ${fk(parseFloat(String(d.weeklyKm).replace(',','.'))||0)} km/sem`],
    ['marks','Marcas',(()=>{const ms=MARK_D.map(([x,n],i)=>d['mt'+i]?`${n} ${d['mt'+i]}`:null).filter(Boolean);const sp=stravaPRs().filter(m=>m.d>=5).length;return ms.join(' · ')||(sp?`${sp} de Strava`:'Ninguna');})()],
    ['week','Semana',`${[...d.days].sort((a,b)=>a-b).map(i=>DAYS[i]).join(', ')} · larga el ${DAYS_L[d.longDay]}${d.maxMin?` · máx. ${d.maxMin} min`:''}`],
    ['you','Sobre ti',[d.name,d.hrMax?`FC máx ${d.hrMax}`:'',d.age?`${d.age} años`:'',d.city?d.city.name:'',d.strength===false?'sin fuerza':'con fuerza'].filter(Boolean).join(' · ')||'Sin datos']
  ];
  return rows.map(([k,l,v])=>`<button type="button" class="item" data-act="${act}" data-step="${k}"><span class="grow"><span class="s">${l}</span><br><span class="t">${esc(v)}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join('');
}

export function renderWizard(){
  const steps=wizSteps(),key=steps[wiz.i],st=stepHTML(key),edit=wiz.mode==='edit';
  const prog=edit?1:(wiz.i)/(steps.length-1);
  $('#tabs').hidden=true;
  const anim=wiz.anim?(wiz.dir>0?'slide-in':'slide-back'):'';wiz.anim=false;
  app.innerHTML=`<div class="wiz">
    <div class="wiz-top">${(wiz.i>0||edit)?`<button type="button" class="iconb" data-act="wback" aria-label="${edit?'Cancelar':'Atrás'}">‹</button>`:'<span class="iconb ghosticon"></span>'}
      ${edit?`<span class="eyebrow" style="flex:1;text-align:center">${STEP_N[key]}</span>`:`<div class="wprog" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${wiz.i+1}"><i style="width:${Math.max(4,prog*100)}%"></i></div><span class="small muted num">${wiz.i+1}/${steps.length}</span>`}</div>
    <div class="wiz-body stack-lg ${anim}">
      <header class="stack" style="gap:8px">${!edit&&wiz.i===0?'<div class="lanes" aria-hidden="true"></div><span class="eyebrow">Zancada · plan de carrera adaptativo</span>':''}<h1>${st.q}</h1><p class="muted">${st.h}</p></header>
      ${st.body}
    </div>
    <div class="wiz-foot"><p class="err" id="err" role="alert"></p><button type="button" class="${st.ghostNext?'':'primary'} block" data-act="${edit?'wsave':'wnext'}">${edit?'Guardar':st.next||'Siguiente'}</button></div>
  </div>`;
}

export function wizRerender(){const y=window.scrollY;renderWizard();window.scrollTo(0,y);}

export function readDraftInputs(){
  if(!draft) return;
  app.querySelectorAll('input[data-f],select[data-f]').forEach(el=>{draft[el.dataset.f]=el.value;});
}

export function validateStep(key){
  const d=draft,g=GOALS[d.goal];
  if(key==='when'&&g.dist){
    if(d.hasDate){
      if(!d.raceDate) return 'Elige el día de la carrera, o marca «Todavía no».';
      if(daysBetween(today(),d.raceDate)<14) return 'La carrera debe ser dentro de al menos 2 semanas.';
      if(daysBetween(today(),d.raceDate)>24*7) return 'Como mucho 24 semanas. Si es más tarde, empieza con un bloque de «Ponerme en forma».';
    }
    if(aimOf(d)==='time'&&!String(d.targetTime||'').trim()) return 'Escribe la marca que quieres hacer, o elige «Terminarla».';
    if(aimOf(d)==='time'&&String(d.targetTime||'').trim()){const t=parseTime(d.targetTime);if(!t||t/g.dist<150||t/g.dist>720) return `Esa marca no parece correcta para ${g.name}. Escríbela como ${TARGET_PH[d.goal]}.`;}
  }
  if(key==='level'){
    const km=parseFloat(String(d.weeklyKm).replace(',','.'));
    if(isNaN(km)||km<0||km>200) return 'Indica los kilómetros semanales (0 si estás empezando).';
  }
  if(key==='marks'){
    for(let i=0;i<MARK_D.length;i++){const t=parseTime(d['mt'+i]);if(t){const pc=t/MARK_D[i][0];if(pc<150||pc>720) return `La marca de ${MARK_D[i][1].toLowerCase()} no parece correcta. Revísala.`;}}
  }
  if(key==='week'&&d.days.length<2) return 'Elige al menos 2 días.';
  if(key==='you'){
    if(String(d.hrMax||'').trim()&&!(+d.hrMax>120&&+d.hrMax<230)) return 'La FC máxima suele estar entre 120 y 230.';
    if(String(d.age||'').trim()&&!(+d.age>=10&&+d.age<=90)) return 'Revisa la edad.';
  }
  return null;
}

export function profileFromDraft(){
  const d=draft,g=GOALS[d.goal];
  return {name:String(d.name||'').trim().slice(0,30),goal:d.goal,raceDate:g.dist&&d.hasDate&&d.raceDate?d.raceDate:null,weeks:+d.weeks||g.defWeeks,
    targetTime:g.dist&&aimOf(d)==='time'&&String(d.targetTime||'').trim()?parseTime(d.targetTime):null,first:!!g.dist&&firstOf(d),level:d.level,weeklyKm:parseFloat(String(d.weeklyKm).replace(',','.'))||0,
    marks:marksFromDraft(d),raceElev:g.dist?(+d.raceElev||0):0,maxMin:+d.maxMin||null,hills:d.hills!==false&&d.hills!=='0',
    days:[...d.days].sort((a,b)=>a-b),longDay:d.days.includes(+d.longDay)?+d.longDay:Math.max(...d.days),
    hrMax:+d.hrMax>120&&+d.hrMax<230?+d.hrMax:null,age:+d.age>=10&&+d.age<=90?+d.age:null,
    hrRest:+d.hrRest>=35&&+d.hrRest<=100?+d.hrRest:null,city:d.city||null,runHour:+d.runHour||8,strength:d.strength!==false};
}

export function previewPlan(){
  const saved=JSON.stringify(state);
  try{
    createPlan(profileFromDraft(),!!state.profile);
    const pl=state.plan,cw=0;
    const first=state.sessions.filter(s=>s.status==='pending'&&s.date<=addDays(monday(today()),6)).map(s=>{const d=describe(s);return {date:s.date,title:d.title,len:['runwalk','fartlek','cuestas'].includes(s.type)?d.dur+' min':fk(s.km)+' km'};});
    const G=pl.goal,g=GOALS[state.profile.goal];
    let goalText='';
    if(g.dist){
      const now=raceTime(state.fitness.p,g.dist)*(1+elevPen(state.profile));
      if(!G&&isFinish(state.profile)) goalText=finishText(state.profile,state.fitness.p,pl.curve.length);
      else goalText=G?`Hoy harías unos <b class="num">${ft(now)}</b> en ${g.name}${elevPen(state.profile)>0.005?' con ese desnivel':''}. Tu objetivo, <b class="num">${ft(state.profile.targetTime)}</b>, es <b>${G.status}</b>${G.status==='poco realista'?`: lo razonable sería unos ${ft(G.realistic)}`:''}.`:`Hoy harías unos <b class="num">${ft(now)}</b> en ${g.name}. El plan se adapta a cómo vayas mejorando.`;
    }
    return {weeks:pl.curve.length,km0:pl.curve[0].km,peak:Math.max(...pl.curve.map(c=>c.km)),first,goalText};
  }catch(e){return null;}
  finally{setState(JSON.parse(saved));}
}

export function wizNext(){
  readDraftInputs();
  const steps=wizSteps(),key=steps[wiz.i],err=validateStep(key);
  if(err){$('#err').textContent=err;return;}
  if(key==='review'){
    createPlan(profileFromDraft(),false);if(stravaOn())afterSync();draft=null;wiz=null;save();
    setLastTab(null);location.hash='#hoy';route();toast('Tu plan está listo. Esta es tu pantalla de cada día.');return;
  }
  wiz.i=Math.min(steps.length-1,wiz.i+1);wiz.dir=1;wiz.anim=true;renderWizard();window.scrollTo(0,0);
}

export function wizBack(){
  readDraftInputs();
  if(wiz.mode==='edit'){wiz=null;draft=null;setLastTab(null);route();return;}
  if(wiz.i>0){wiz.i--;wiz.dir=-1;wiz.anim=true;renderWizard();window.scrollTo(0,0);}
}

export function wizSave(){
  readDraftInputs();
  const key=wiz.key,err=validateStep(key);
  if(err){$('#err').textContent=err;return;}
  const pr=profileFromDraft();
  if(key==='you'&&ageAdj(pr).band===ageAdj(state.profile).band){
    const cityChanged=JSON.stringify(pr.city)!==JSON.stringify(state.profile.city)||pr.runHour!==state.profile.runHour;
    Object.assign(state.profile,{name:pr.name,hrMax:pr.hrMax,age:pr.age,hrRest:pr.hrRest,city:pr.city,runHour:pr.runHour,strength:pr.strength});
    if(cityChanged){state.wx=null;wxRefresh(true).then(ch=>{if(ch&&lastTab==='hoy')route();});}
    save();wiz=null;draft=null;setLastTab(null);route();toast('Guardado.');return;}
  openSheet(`<div class="stack"><h2>¿Recalcular el plan?</h2><p class="muted">Rehago el plan desde hoy con los cambios. Tu historial, tus ritmos y lo que la app ha aprendido de ti se mantienen.</p>
    <div class="grid2"><button class="ghost" data-act="close">Cancelar</button><button class="primary" data-act="wconfirm">Recalcular</button></div></div>`);
}

export function wizConfirm(){
  const snap=JSON.stringify(state);
  createPlan(profileFromDraft(),true);draft=null;wiz=null;save();closeSheet();setLastTab(null);location.hash='#hoy';route();
  toast('Plan recalculado.',{undo:snap});
}

// Modificadores para que otros módulos puedan reasignar este estado compartido.
export function setDraft(v){draft=v;}
export function setWiz(v){wiz=v;}
