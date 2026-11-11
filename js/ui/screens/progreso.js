/**
 * Pantalla «Progreso»: predicciones, carga, distribución y evolución.
 */
import { DAYS, addDays, clamp, daysBetween, dow, esc, fdShort, fk, fp, ft, monday, pd, today } from '../../core/util.js';
import { GOALS, TYPES } from '../../model/constants.js';
import { state, stravaOn } from '../../core/store.js';
import { impactInfo, intensityDist, predictToday, weekLoadInfo } from '../../model/load.js';
import { TRACK_CLS, goalInfo } from '../../model/goal.js';
import { adherence } from '../../model/adapt.js';
import { activities, formState } from '../../model/activities.js';
import { app } from '../dom.js';
import { marksCard, shoesCard, summaryCard } from '../cards.js';
import { barChart, formChart, lineChart } from '../charts.js';
import { MAN_TYPES } from './manual.js';

export function racePrediction(){
  const pr=state.profile,g=GOALS[pr.goal];
  const race=state.sessions.find(s=>s.type==='race'&&s.status==='pending');
  if(!g.dist||!race) return '';
  const gi=goalInfo();
  if(gi) return `<div class="card stack" style="gap:6px;background:var(--bg)"><div class="row between"><span class="eyebrow">${g.name} · ${fdShort(race.date)}</span><span class="chip ${TRACK_CLS[gi.track]}">${gi.track[0].toUpperCase()+gi.track.slice(1)}</span></div>
    <div class="row between"><span>Tu objetivo</span><b class="num" style="font-family:var(--display);font-size:22px">${ft(gi.target)}</b></div>
    <div class="row between"><span>Si corrieras hoy</span><b class="num" style="font-family:var(--display);font-size:22px">${ft(gi.pred)}</b></div>
    <div class="row between"><span>Si cumples el plan</span><b class="num" style="font-family:var(--display);font-size:22px;color:var(--accent)">${ft(gi.forecast)}</b></div>
    <p class="small muted">Probabilidad de lograrlo: ${gi.prob}. Cada dos semanas reviso si vas en camino y ajusto la calidad del plan.</p></div>`;
  const p=state.fitness.p,h=state.fitness.history.filter(x=>x.date>=addDays(today(),-56));
  let rate=0;
  if(h.length>=2&&daysBetween(h[0].date,today())>=21){const wk=daysBetween(h[0].date,today())/7;rate=clamp((h[0].p-p)/h[0].p/wk,0,0.006);}
  const wks=daysBetween(today(),race.date)/7;
  const pf=p*(1-Math.min(0.05,rate*wks));
  const T=d=>d*5*Math.pow(g.dist/5,1.06)/5;
  return `<div class="card stack" style="gap:6px;background:var(--bg)"><span class="eyebrow">${g.name} · ${fdShort(race.date)}</span>
    <div class="row between"><span>Si corrieras hoy</span><b class="num" style="font-family:var(--display);font-size:22px">${ft(T(p*5))}</b></div>
    <div class="row between"><span>Previsión para el día de la carrera</span><b class="num" style="font-family:var(--display);font-size:22px;color:var(--accent)">${ft(T(pf*5))}</b></div>
    <p class="small muted">${rate>0?`Calculada con tu ritmo de mejora de las últimas semanas (${(rate*100).toFixed(1).replace('.',',')} % por semana), con un límite prudente.`:'Aún no hay mejora medida: la previsión es tu forma actual. Se afinará con los tests y las carreras de Strava.'}</p></div>`;
}

export function loadCard(){
  const w=weekLoadInfo();if(!w) return '';
  const im=impactInfo(),max=Math.max(w.hi*1.25,w.last7,w.planned)||1,X=v=>clamp(v/max*100,0,100);
  return `<section class="card stack" style="gap:8px"><div class="row between"><h3>Carga semanal</h3><span class="chip ${w.st[1]}">${w.st[0]}</span></div>
    <div class="lbar" role="img" aria-label="Carga de 7 días ${Math.round(w.last7)}, rango recomendado ${Math.round(w.lo)} a ${Math.round(w.hi)}"><span class="rng" style="left:${X(w.lo)}%;width:${X(w.hi)-X(w.lo)}%"></span><i style="width:${X(w.last7)}%"></i><b style="left:${X(w.planned)}%"></b></div>
    <div class="row between small"><span>Últimos 7 días: <b class="num">${Math.round(w.last7)}</b></span><span class="muted">Recomendado: ${Math.round(w.lo)}–${Math.round(w.hi)}</span></div>
    <p class="small muted">La raya negra es la carga prevista para los próximos 7 días según el plan (${Math.round(w.planned)}). ${w.ratio>=1.5?'Estás muy por encima de lo que tu cuerpo está acostumbrado: riesgo de lesión.':w.ratio>=1.3?'Algo por encima de lo recomendado: vigila las sensaciones.':w.ratio<0.8?'Por debajo de tu base: estás manteniendo o perdiendo algo de forma.':'Dentro del rango que mejora tu forma sin pasarte.'}</p>
    ${im&&im.ratio>1.3?`<p class="small" style="color:var(--warn)">El impacto de esta semana (km y desnivel) es un ${Math.round((im.ratio-1)*100)} % mayor que tu media: cuida las piernas.</p>`:''}</section>`;
}

export function distCard(){
  const d=intensityDist();if(!d) return '';
  const [e,m,h]=d.pct,P=v=>Math.round(v*100);
  return `<section class="card stack" style="gap:8px"><h3>Reparto de intensidad · 4 semanas</h3>
    <div class="dbar" role="img" aria-label="Suave ${P(e)} %, moderado ${P(m)} %, intenso ${P(h)} %"><i style="width:${e*100}%;background:var(--good)"></i><i style="width:${m*100}%;background:var(--warn)"></i><i style="width:${h*100}%;background:var(--accent)"></i></div>
    <div class="legend"><span><i style="background:var(--good)"></i>Suave ${P(e)} %</span><span><i style="background:var(--warn)"></i>Moderado ${P(m)} %</span><span><i style="background:var(--accent)"></i>Intenso ${P(h)} %</span></div>
    <p class="small muted">${e<0.7?'Demasiado tiempo a ritmo medio o fuerte. Lo que más mejora a largo plazo es que el 75–80 % sea suave: baja el ritmo en los rodajes.':m>0.2?'Mucho tiempo en zona moderada, que cansa pero mejora poco. Haz los suaves más suaves y los fuertes de verdad fuertes.':'Buen reparto: la mayoría suave y la intensidad concentrada en las sesiones de calidad.'} ${fk(d.hours)} h en total.</p></section>`;
}

export function renderProgreso(){
  const p=state.fitness.p,acts=activities();
  const totalKm=acts.reduce((a,x)=>a+x.km,0);
  const a=adherence(28),f=formState(),ad=state.adapt;
  const pred=[['5 km',5],['10 km',10],['Media',21.0975],['Maratón',42.195]].map(([n,d])=>`<div><b class="num">${ft(predictToday(p,d))}</b><span>${n}</span></div>`).join('');
  const evs=state.adapt.events.map(e=>`<div class="ev"><span class="mk ${e.kind}" aria-hidden="true"></span><div><span class="small muted">${fdShort(e.date)} · ${e.kind==='up'?'Sube':e.kind==='down'?'Baja':'Ajuste'}</span><p>${esc(e.text)}</p></div></div>`).join('');
  const hist=acts.slice().reverse().slice(0,20).map(x=>{
    const ses=x.session||(x.run&&x.run.sessionId?state.sessions.find(s=>s.id===x.run.sessionId):null);
    const title=ses?((ses.snap&&ses.snap.title)||TYPES[ses.type].n):x.manual?(MAN_TYPES.find(m=>m[0]===x.manual.type)||MAN_TYPES[5])[1]:(x.run?esc(x.run.name)||'Carrera':'Carrera');
    const rpe=ses&&ses.log?ses.log.rpe+'/10':'';
    const act=ses?`data-act="open" data-id="${ses.id}"`:x.manual?`data-act="manopen" data-id="${x.manual.id}"`:'';
    return `<${act?'button':'div'} class="item" ${act}><span class="date">${DAYS[dow(x.date)]}<b class="num">${pd(x.date).getDate()}</b></span><span class="grow"><span class="t">${title}</span>${x.src==='strava'?' <span class="src">Strava</span>':''}${!ses&&state.plan&&x.date>=state.plan.created?' <span class="src">fuera del plan</span>':''}<br><span class="s num">${fk(x.km)} km${x.sec?' · '+ft(x.sec)+' · '+fp(x.sec/x.km)+' /km':''}${x.elev>=30?' · +'+Math.round(x.elev)+' m':''}${x.hr?' · '+Math.round(x.hr)+' ppm':''}</span></span><span class="status num">${rpe||(x.manual?x.manual.rpe+'/10':'')}</span></${act?'button':'div'}>`;}).join('');
  app.innerHTML=`<div class="stack-lg">
   <header class="stack" style="gap:6px"><div class="lanes" aria-hidden="true"></div><h1>Progreso</h1></header>
   <div class="tiles">
     <div class="tile"><div class="k">5 km estimado</div><div class="v num">${ft(p*5)}</div><div class="k num">${fp(p)} /km</div></div>
     <div class="tile"><div class="k">Estado de forma</div><div class="v">${f?f.label:'—'}</div><div class="k num">${f?`balance ${f.tsb>0?'+':''}${Math.round(f.tsb)}`:'faltan datos'}</div></div>
     <div class="tile"><div class="k">Cumplimiento (4 sem.)</div><div class="v num">${a.total?Math.round(a.ratio*100)+' %':'—'}</div><div class="k num">${a.done} de ${a.total} sesiones</div></div>
     <div class="tile"><div class="k">Carga del plan</div><div class="v num">${Math.round(ad.load*100)} %</div><div class="k">${ad.load>1.01?'por encima del plan base':ad.load<0.99?'reducida para recuperar':'según el plan base'}</div></div>
   </div>
   ${summaryCard(false)}
   <a href="#zonas" class="card row between" style="text-decoration:none;color:inherit"><span><b>Tus zonas de ritmo y pulso</b><br><span class="small muted">Suave, umbral, ritmo de carrera, series…</span></span><span style="color:var(--accent);font-weight:800">›</span></a>
   ${marksCard()}
   <section class="card stack"><h3>Predicciones</h3>${racePrediction()}<div class="pred">${pred}</div><p class="small muted">Tiempos posibles hoy según tu forma. En media y maratón tienen en cuenta tus tiradas largas y tu volumen de las últimas 6 semanas: sin ellos, la fórmula clásica es demasiado optimista.</p></section>
   ${loadCard()}
   ${distCard()}
   <section class="card stack"><h3>Kilómetros por semana</h3>${barChart()}</section>
   <section class="card stack"><h3>Forma y fatiga</h3>${formChart()}</section>
   <section class="card stack"><h3>Tu 5 km estimado</h3>${lineChart()}</section>
   ${shoesCard()}
   <section class="card stack" style="gap:4px"><h3>Cómo se ha adaptado tu plan</h3>${evs||'<p class="muted small">Aún no hay ajustes.</p>'}</section>
   <section class="card stack" style="gap:0"><div class="row between" style="margin-bottom:6px"><h3>Historial · ${fk(totalKm)} km</h3><button type="button" class="ghost addbtn" data-act="addrun">+ Añadir</button></div>${hist||'<p class="muted small">Todavía no hay carreras.</p>'}${stravaOn()?'<p class="src" style="margin-top:8px">Datos de actividad: Strava</p>':''}</section>
  </div>`;
}

export function weeksSeries(){
  const acts=activities();
  const cw=monday(today());
  const firstS=state.sessions.length?monday(state.sessions[0].date):cw;
  const firstA=acts.length?monday(acts[0].date):cw;
  let first=firstS<firstA?firstS:firstA;
  if(daysBetween(first,cw)>77) first=addDays(cw,-77);
  const out=[];
  for(let m=first;m<=addDays(cw,14);m=addDays(m,7)){
    const end=addDays(m,6);
    const inW=state.sessions.filter(s=>s.date>=m&&s.date<=end);
    out.push({m,plan:inW.reduce((a,s)=>a+(s.status==='done'&&s.log&&s.log.km?s.log.km:s.km)*(s.status==='paused'||(s.status==='skipped'&&s.moved)?0:1),0),
      done:m<=cw?acts.filter(a=>a.date>=m&&a.date<=end).reduce((a,x)=>a+x.km,0):null,future:m>cw});
  }
  return out.slice(-12);
}
