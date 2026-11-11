/**
 * Tarjetas reutilizables: objetivo, marcas, análisis, resumen semanal, pausa y zapatillas.
 */
import { DAYS, addDays, clamp, daysBetween, dow, esc, fdShort, fk, fm, fp, ft, monday, pd, today } from '../core/util.js';
import { KEY_TYPES, PHASE_N, TYPES } from '../model/constants.js';
import { state } from '../core/store.js';
import { describe } from '../model/workouts.js';
import { MARK_D, PR_NAME, bestMark, fdMark, markName, stravaPRs } from '../model/marks.js';
import { TRACK_CLS, goalInfo } from '../model/goal.js';
import { curWeek } from '../model/adapt.js';
import { analyze } from '../model/analysis.js';
import { PAUSE_R, inactive } from '../model/calendar.js';
import { PHASE_TIP, weekSummary } from '../model/weekly.js';
import { openSheet } from './router.js';

/* =========================================================
   Zapatillas (de Strava)
   ========================================================= */
export function shoesCard(){
  const g=state.strava&&state.strava.gear;if(!g) return '';
  const list=Object.values(g).filter(x=>!x.retired).sort((a,b)=>b.km-a.km);if(!list.length) return '';
  return `<section class="card stack" style="gap:0"><h3 style="margin-bottom:6px">Zapatillas</h3>${list.map(x=>{const pct=clamp(x.km/800,0,1),w=x.km>=800?['Cámbialas','q']:x.km>=600?['Pronto','w']:['Bien','ok'];
    return `<div class="zrow" style="flex-direction:column;align-items:stretch;gap:6px"><div class="row between"><b>${esc(x.name)}</b><span class="chip ${w[1]}">${w[0]}</span></div>
      <div class="bar"><i style="width:${pct*100}%;background:${x.km>=800?'var(--accent)':x.km>=600?'var(--warn)':'var(--good)'}"></i></div><span class="small muted num">${fk(x.km)} km de unos 700–800 de vida útil</span></div>`;}).join('')}</section>`;
}

export function marksCard(){
  const pr=state.profile,man=(pr.marks||[]),sp=stravaPRs(),b=bestMark(pr);
  const rows=[];
  MARK_D.forEach(([d,n])=>{
    const m=man.find(x=>Math.abs(x.d-d)<0.01),s=sp.find(x=>Math.abs(x.d-d)<0.01);
    const pick=[m&&{...m,src:'manual'},s].filter(Boolean).sort((a,b)=>a.t-b.t)[0];
    if(pick) rows.push(`<div class="zrow"><div><b>${n}</b><br><span class="small muted">${pick.src==='strava'?(pick.race?'Competición en Strava':'Mejor esfuerzo en Strava'):'Introducida por ti'}${pick.date?' · '+fdMark(pick.date):''}</span></div><span class="num zv">${ft(pick.t)}</span></div>`);
  });
  sp.filter(x=>x.d<5).sort((a,b)=>b.d-a.d).forEach(x=>rows.unshift(`<div class="zrow"><div><b>${PR_NAME[x.key]}</b><br><span class="small muted">Mejor esfuerzo en Strava · ${fdMark(x.date)}</span></div><span class="num zv">${ft(x.t)}</span></div>`));
  return `<section class="card stack" style="gap:0"><div class="row between" style="margin-bottom:6px"><h3>Tus mejores marcas</h3><button type="button" class="ghost" style="min-height:36px;padding:4px 12px;font-size:14px" data-act="wedit" data-step="marks">Editar</button></div>
    ${rows.join('')||'<p class="small muted">Aún no hay marcas. Añádelas en Perfil o conecta Strava.</p>'}
    ${b?`<p class="small muted" style="margin-top:8px">La marca que más pesa ahora es la de ${markName(b.d).toLowerCase()}${b.date?` (${fdMark(b.date)})`:''}. Las antiguas cuentan menos, y las de 1 km o 1 milla no se usan para calcular tu forma porque la sobrestiman. Tu forma estimada hoy: ${ft(state.fitness.p*5)} en 5 km.</p>`:''}</section>`;
}

export function goalCard(){
  const gi=goalInfo();if(!gi) return '';
  return `<section class="card stack" style="gap:8px">
    <div class="row between"><span class="eyebrow">Objetivo · ${gi.g.name} en ${ft(gi.target)}</span><span class="chip ${TRACK_CLS[gi.track]}">${gi.track[0].toUpperCase()+gi.track.slice(1)}</span></div>
    <div class="bar" style="height:10px;position:relative" role="img" aria-label="Progreso hacia el objetivo: ${Math.round(gi.prog*100)} %"><i style="width:${gi.prog*100}%"></i><span style="position:absolute;top:-3px;left:calc(${gi.progExp*100}% - 1px);width:3px;height:16px;background:var(--ink);border-radius:2px"></span></div>
    <div class="row between small"><span class="muted">Hoy harías</span><b class="num">${ft(gi.pred)}</b></div>
    <div class="row between small"><span class="muted">Si cumples el plan</span><b class="num">${ft(gi.forecast)}</b></div>
    <p class="small muted">Probabilidad ${gi.prob}. La raya negra marca dónde deberías estar a estas alturas.</p></section>`;
}

export function analysisHTML(s){
  const a=analyze(s);if(!a) return '';
  const mk=ok=>ok===true?'<span class="am ok" aria-label="bien">✓</span>':ok==='warn'?'<span class="am w" aria-label="mejorable">!</span>':'<span class="am q" aria-label="no cumplido">×</span>';
  const easyType=['easy','long','runwalk'].includes(s.type);
  const lapRows=a.laps&&a.laps.length?`<div class="laps"><table><thead><tr><th>${easyType?'Km':'#'}</th><th>Dist.</th><th>Ritmo</th><th>Pulso</th><th></th></tr></thead><tbody>${a.laps.map(l=>`<tr><td>${l.n}</td><td>${fm(l.km)}</td><td>${fp(l.pace)}</td><td>${l.hr?Math.round(l.hr):'–'}</td><td class="${l.st==='ok'?'ok':'w'}">${l.st==='ok'?'✓':l.st}</td></tr>`).join('')}</tbody></table></div>`:'';
  return `<section class="stack analysis" style="gap:8px"><div class="row between"><h3>Análisis</h3><span class="chip ${a.verdict[1]}">${a.verdict[0]}</span></div>
    <ul class="aitems">${a.items.map(i=>`<li>${mk(i.ok)}<div><b>${i.label}</b><br><span class="small">${esc(i.text)}</span></div></li>`).join('')}</ul>
    ${lapRows}
    ${a.notes.map(n=>`<p class="small muted">${esc(n)}</p>`).join('')}
    ${a.changes.length?`<div class="stack" style="gap:4px"><span class="eyebrow">Qué ha cambiado en tu plan</span>${a.changes.map(c=>`<p class="small">${esc(c)}</p>`).join('')}</div>`:''}
  </section>`;
}

export function pauseCard(){
  const P=state.pause;if(!P) return '';
  const d=daysBetween(P.from,today());
  const tip={lesion:'Descansa la zona y, si la molestia dura más de unos días, consulta a un fisioterapeuta. Puedes hacer bici o natación si no duele.',enfermedad:'Con fiebre o síntomas del cuello para abajo, nada de correr. Vuelve cuando lleves 24 horas sin fiebre.',viaje:'Si puedes, sal a trotar suave 20–30 minutos un par de veces: mantiene mucho.'}[P.reason];
  return `<section class="hero stack"><span class="eyebrow">Plan en pausa · ${PAUSE_R[P.reason]}</span><h2>${d===0?'Desde hoy':`Día ${d+1} de pausa`}${P.to?` · hasta el ${fdShort(P.to)}`:''}</h2>
    <p class="muted">${tip}</p><p class="small muted">Al volver ajusto la carga según los días que hayan pasado.</p>
    <button class="primary" data-act="resume">Retomar el plan hoy</button></section>`;
}

export function openPause(){
  openSheet(`<form id="pausef" class="stack" novalidate><h2>Pausar el plan</h2>
    <p class="muted">Las sesiones de esos días no contarán como saltadas. Al volver, ajusto la carga según el tiempo parado.</p>
    <div><label>Motivo</label><div class="seg" role="group">${Object.entries(PAUSE_R).map(([k,v],i)=>`<button type="button" data-act="preason" data-v="${k}" aria-pressed="${i===0}">${v}</button>`).join('')}</div></div>
    <div><label for="p-to">Vuelvo el día <span class="muted">(opcional)</span></label><input id="p-to" type="date" min="${addDays(today(),1)}"><div class="hint"><span id="p-to-h"></span> Si no lo sabes, déjalo vacío y pulsa «Retomar» cuando vuelvas.</div></div>
    <div class="grid2"><button type="button" class="ghost" data-act="close">Cancelar</button><button type="button" class="primary" data-act="pausego">Pausar</button></div></form>`);
}

export function summaryCard(dismissable){
  if(!state.plan) return '';
  const mon=monday(today()),prev=addDays(mon,-7);
  if(prev<monday(state.plan.created)) return '';
  if(dismissable&&state.adapt.summarySeen===mon) return '';
  const w=weekSummary(prev);if(!w) return '';
  const cw=curWeek(),c=state.plan.curve[cw];
  const next=state.sessions.filter(s=>s.date>=mon&&s.date<=addDays(mon,6)&&s.status==='pending'&&(KEY_TYPES.includes(s.type)||s.type==='race'));
  const kmNext=state.sessions.filter(s=>s.date>=mon&&s.date<=addDays(mon,6)&&!inactive(s)).reduce((a,s)=>a+s.km,0);
  return `<section class="card stack" style="gap:10px"><div class="row between"><span class="eyebrow">Resumen · semana del ${fdShort(w.mon)}</span>${dismissable?'<button class="ghost" style="min-height:34px;padding:4px 10px;font-size:13px" data-act="sumok">Entendido</button>':''}</div>
    <div class="tiles"><div class="tile"><div class="k">Sesiones</div><div class="v num">${w.done}/${w.total}</div></div><div class="tile"><div class="k">Kilómetros</div><div class="v num">${fk(w.kmDone)}</div><div class="k num">de ${fk(w.kmPlan)} previstos</div></div></div>
    <ul class="steps small">${w.quality.map(q=>`<li>${esc(q)}</li>`).join('')}${w.feel?`<li>Esfuerzo: ${w.feel}.</li>`:''}${w.evs?`<li>${w.evs} ajuste${w.evs>1?'s':''} del plan (míralos en Progreso).</li>`:''}</ul>
    ${c?`<div class="stack" style="gap:4px"><span class="eyebrow">Esta semana · ${PHASE_N[c.phase]}${c.down?' · descarga':''} · ${fk(kmNext)} km</span>
      ${next.map(s=>`<span class="small">${DAYS[dow(s.date)]} ${pd(s.date).getDate()}: <b>${TYPES[s.type].n}</b> · ${s.type==='runwalk'?describe(s).dur+' min':fk(s.km)+' km'}</span>`).join('')}
      <p class="small muted">${c.down?'Semana de descarga: menos volumen para asimilar lo trabajado.':PHASE_TIP[c.phase]}</p></div>`:''}
  </section>`;
}
