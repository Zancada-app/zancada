/**
 * Gráficas SVG sin dependencias (barras, líneas, forma).
 */
import { fdShort, fk, fp, ft, pd, today } from '../core/util.js';
import { state } from '../core/store.js';
import { loadSeries } from '../model/activities.js';
import { weeksSeries } from './screens/progreso.js';

/* ---------- Progreso ---------- */
export function niceMax(v){if(v<=0)return 10;const e=Math.pow(10,Math.floor(Math.log10(v)));const f=v/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;}

export function barChart(){
  const ws=weeksSeries();const W=340,H=170,L=30,B=22,T=8;const max=niceMax(Math.max(...ws.map(w=>Math.max(w.plan,w.done||0)),5));
  const bw=(W-L)/ws.length;const y=v=>T+(H-T-B)*(1-v/max);
  const ticks=[0,max/2,max];
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilómetros por semana, planificados y hechos">`;
  ticks.forEach(t=>{s+=`<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y(t)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fk(t)}</text>`;});
  ws.forEach((w,i)=>{
    const x=L+i*bw,iw=Math.min(14,(bw-6)/2);const cx=x+bw/2;
    const ph=H-B-y(w.plan);
    s+=`<rect x="${cx-iw-1}" y="${y(w.plan)}" width="${iw}" height="${Math.max(0,ph)}" rx="3" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="${w.future?'3 3':'0'}"/>`;
    if(w.done!=null){const dh=H-B-y(w.done);s+=`<rect x="${cx+1}" y="${y(w.done)}" width="${iw}" height="${Math.max(0,dh)}" rx="3" fill="var(--accent)"/>`;}
    if(i%2===0||ws.length<=7) s+=`<text x="${cx}" y="${H-6}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${fdShort(w.m)}</text>`;
    s+=`<rect class="hit" x="${x}" y="0" width="${bw}" height="${H-B}" fill="transparent" data-tip="Semana del ${fdShort(w.m)}: ${w.done!=null?fk(w.done)+' km hechos de ':''}${fk(w.plan)} km planificados"/>`;
  });
  s+=`<line x1="${L}" x2="${W}" y1="${H-B}" y2="${H-B}" stroke="var(--muted)" stroke-width="1"/></svg>`;
  return `<div class="chart"><div class="legend"><span><i style="border:1.5px solid var(--muted)"></i>Planificado</span><span><i style="background:var(--accent)"></i>Hecho</span></div>${s}<div class="tip" aria-live="polite">Toca una semana para ver el detalle.</div></div>`;
}

export function lineChart(){
  const h=state.fitness.history;
  if(h.length<2) return `<p class="muted small">Cuando registres un test de 5 km o sesiones de calidad con su ritmo, aquí verás cómo evoluciona tu marca estimada.</p>`;
  const W=340,H=150,L=44,B=22,T=12;
  const vals=h.map(x=>x.p*5);const mn=Math.min(...vals),mx=Math.max(...vals);const pad=Math.max(20,(mx-mn)*0.2);
  const lo=mn-pad,hi=mx+pad;
  const t0=pd(h[0].date).getTime(),t1=Math.max(pd(h[h.length-1].date).getTime(),pd(today()).getTime(),t0+864e5);
  const x=d=>L+(W-L-8)*((pd(d).getTime()-t0)/(t1-t0));
  const y=v=>T+(H-T-B)*((v-lo)/(hi-lo)); // menos tiempo = más arriba
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del tiempo estimado en 5 km">`;
  [lo+pad,hi-pad].forEach(v=>{s+=`<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${ft(v)}</text>`;});
  let path='';h.forEach((p,i)=>{const X=x(p.date),Y=y(p.p*5);path+=i?` H${X} V${Y}`:`M${X} ${Y}`;});
  path+=` H${W-8}`;
  s+=`<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  h.forEach((p,i)=>{const X=x(p.date),Y=y(p.p*5),last=i===h.length-1;s+=`<circle cx="${X}" cy="${Y}" r="${last?5:3.5}" fill="${last?'var(--accent)':'var(--surface)'}" stroke="var(--accent)" stroke-width="2"/><circle class="hit" cx="${X}" cy="${Y}" r="14" fill="transparent" data-tip="${fdShort(p.date)}: ${ft(p.p*5)} en 5 km (${fp(p.p)} /km)"/>`;});
  s+=`<text x="${L}" y="${H-6}" font-size="10.5" fill="var(--muted)">${fdShort(h[0].date)}</text><text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10.5" fill="var(--muted)">Hoy</text></svg>`;
  return `<div class="chart">${s}<div class="tip" aria-live="polite">Toca un punto para ver el detalle.</div></div>`;
}

export function formChart(){
  const ls=loadSeries().slice(-84);
  if(ls.length<28) return `<p class="muted small">Necesito al menos 4 semanas de carreras (de Strava o registradas aquí) para calcular tu forma y tu fatiga.</p>`;
  const W=340,H=150,L=30,B=22,T=10;
  const mx=niceMax(Math.max(...ls.map(x=>Math.max(x.ctl,x.atl)),10));
  const x=i=>L+(W-L-6)*(i/(ls.length-1)),y=v=>T+(H-T-B)*(1-v/mx);
  const path=k=>ls.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(' ');
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Forma y fatiga en las últimas semanas">`;
  [0,mx/2,mx].forEach(t=>{s+=`<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${L-6}" y="${y(t)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.round(t)}</text>`;});
  s+=`<path d="${path('atl')}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 3"/>`;
  s+=`<path d="${path('ctl')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  const li=ls.length-1;
  s+=`<circle cx="${x(li)}" cy="${y(ls[li].ctl)}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
  const step=Math.max(1,Math.floor(ls.length/12));
  ls.forEach((p,i)=>{if(i%step)return;const w=(W-L)/ls.length*step;s+=`<rect class="hit" x="${x(i)-w/2}" y="0" width="${w}" height="${H-B}" fill="transparent" data-tip="${fdShort(p.date)}: forma ${Math.round(p.ctl)} · fatiga ${Math.round(p.atl)} · balance ${p.tsb>0?'+':''}${Math.round(p.tsb)}"/>`;});
  s+=`<text x="${L}" y="${H-6}" font-size="10.5" fill="var(--muted)">${fdShort(ls[0].date)}</text><text x="${W-6}" y="${H-6}" text-anchor="end" font-size="10.5" fill="var(--muted)">Hoy</text></svg>`;
  return `<div class="chart"><div class="legend"><span><i style="background:var(--accent)"></i>Forma (42 días)</span><span><i style="border:2px dashed var(--muted)"></i>Fatiga (7 días)</span></div>${s}<div class="tip" aria-live="polite">La forma sube con semanas constantes; la fatiga refleja lo último. Toca la gráfica para ver un día.</div></div>`;
}
