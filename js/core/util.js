/**
 * Utilidades puras: fechas (ISO local), formato de ritmos/tiempos/distancias, parseo y escape HTML.
 */
/* =========================================================
   Utilidades de fecha y formato
   ========================================================= */
export const pad=n=>String(n).padStart(2,'0');

export const ds=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export const pd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};

export const addDays=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return ds(d);};

export const dow=s=>(pd(s).getDay()+6)%7; // 0 = lunes

export const monday=s=>addDays(s,-dow(s));

export const daysBetween=(a,b)=>Math.round((pd(b)-pd(a))/864e5);

export let TODAY_OVERRIDE=null;

export const today=()=>TODAY_OVERRIDE||ds(new Date());

export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const r05=v=>Math.max(0.5,Math.round(v*2)/2);

export const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);

export const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

export const DAYS_L=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

export const MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const MONTHS_L=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export const fk=v=>(Math.round(v*10)/10).toLocaleString('es-ES',{maximumFractionDigits:1});

export const fp=sec=>{sec=Math.round(sec);return `${Math.floor(sec/60)}:${pad(sec%60)}`;};

export const ft=sec=>{sec=Math.round(sec);const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`;};

export const fm=km=>km<1?`${Math.round(km*1000)} m`:`${fk(km)} km`;

export const fmin=m=>m%1?`${Math.floor(m)}:30 min`:`${m} min`;

export const fdShort=s=>{const d=pd(s);return `${d.getDate()} ${MONTHS[d.getMonth()]}`;};

export const fdLong=s=>{const d=pd(s);return `${DAYS_L[dow(s)]}, ${d.getDate()} de ${MONTHS_L[d.getMonth()]}`;};

export function parseTime(str){ // "25:30", "1:52:10", "52"
  if(!str) return null; const parts=String(str).trim().replace(/[.,']/g,':').split(':').filter(x=>x!=='').map(Number);
  if(!parts.length||parts.some(isNaN)) return null;
  if(parts.length===1) return parts[0]*60;
  if(parts.length===2) return parts[0]*60+parts[1];
  return parts[0]*3600+parts[1]*60+parts[2];
}

export function parsePace(str){const t=parseTime(str);return t&&t>120&&t<900?t:null;}

export const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Modificadores para que otros módulos puedan reasignar este estado compartido.
export function setTodayOverride(v){TODAY_OVERRIDE=v;}
