/**
 * Selectores tipo rueda para tiempos, ritmos y distancias.
 */
import { esc, pad, parseTime } from '../core/util.js';

/* =========================================================
   Campos de tiempo: solo números, los dos puntos se ponen solos
   ========================================================= */
export function fmtDigits(dg,kind){
  dg=dg.replace(/\D/g,'').replace(/^0+(?=\d{3})/,'').slice(0,kind==='pace'?4:6);
  if(dg.length<=2) return dg;
  if(kind==='pace'||dg.length<=4) return dg.slice(0,-2)+':'+dg.slice(-2);
  return dg.slice(0,-4)+':'+dg.slice(-4,-2)+':'+dg.slice(-2);
}

/* =========================================================
   Selectores de rueda (en el iPhone se abren como ruedas nativas)
   ========================================================= */
export const rng=(a,b,step)=>{const o=[];for(let i=a;i<=b;i+=step||1)o.push(i);return o;};

export function sel(part,label,opts,cur,ph){
  return `<select data-part="${part}" aria-label="${label}">${ph!=null?`<option value=""${cur===''||cur==null?' selected':''}>${ph}</option>`:''}${opts.map(([v,l])=>`<option value="${v}"${String(cur)===String(v)?' selected':''}>${l}</option>`).join('')}</select>`;
}

// valor guardado en un input oculto (con data-f para el asistente), compuesto desde las ruedas
export function pickerHTML(id,f,kind,val,optional){
  let parts='';
  if(kind==='dur'){
    const t=parseTime(val),h=t!=null?Math.floor(t/3600):'',m=t!=null?Math.floor(t%3600/60):'',s=t!=null?t%60:'';
    parts=sel('h','horas',rng(0,9).map(i=>[i,`${i} h`]),t!=null?h:'', '– h')+'<span class="sep">:</span>'+sel('m','minutos',rng(0,59).map(i=>[i,pad(i)]),m,'– min')+'<span class="sep">:</span>'+sel('s','segundos',rng(0,59).map(i=>[i,pad(i)]),s,'– s');
  }else if(kind==='pace'){
    const t=parseTime(val),m=t!=null?Math.floor(t/60):'',s=t!=null?t%60:'';
    parts=sel('m','minutos por km',rng(2,15).map(i=>[i,`${i}`]),m,'– min')+'<span class="sep">:</span>'+sel('s','segundos',rng(0,59).map(i=>[i,pad(i)]),s,'– s')+'<span class="pu">/km</span>';
  }else if(kind==='dist'){
    const v=val!==''&&val!=null?parseFloat(String(val).replace(',','.')):null,k=v!=null?Math.floor(v+1e-9):'',d=v!=null?Math.round((v-Math.floor(v+1e-9))*10)%10:'';
    parts=sel('k','kilómetros',rng(0,60).map(i=>[i,`${i}`]),k,'– km')+'<span class="sep">,</span>'+sel('d','décimas',rng(0,9).map(i=>[i,`${i}`]),d,'–')+'<span class="pu">km</span>';
  }
  return `<div class="picker${val?' set':''}" data-kind="${kind}" data-target="${id}">${parts}${optional?`<button type="button" class="pclear" data-act="pclear" aria-label="Borrar">×</button>`:''}<input type="hidden" id="${id}" ${f?`data-f="${f}"`:''} value="${esc(val||'')}"></div>`;
}

export function intPicker(id,f,a,b,step,val,unit,ph){
  return `<div class="picker one" data-kind="int" data-target="${id}">${sel('v',unit||'valor',rng(a,b,step).map(i=>[i,`${i}${unit?' '+unit:''}`]),val===''||val==null?'':val,ph!=null?ph:null)}<input type="hidden" id="${id}" ${f?`data-f="${f}"`:''} value="${esc(val==null?'':val)}"></div>`;
}

export function pickerValue(pk){
  const k=pk.dataset.kind,g=p=>{const s=pk.querySelector(`[data-part="${p}"]`);return s?s.value:'';};
  if(k==='int') return g('v');
  if(k==='dur'){const h=g('h'),m=g('m'),s=g('s');if(h===''&&m===''&&s==='')return '';const H=+h||0,M=+m||0,S=+s||0;if(!H&&!M&&!S)return '';return H?`${H}:${pad(M)}:${pad(S)}`:`${M}:${pad(S)}`;}
  if(k==='pace'){const m=g('m'),s=g('s');if(m===''&&s==='')return '';return `${+m||0}:${pad(+s||0)}`;}
  if(k==='dist'){const a=g('k'),d=g('d');if(a===''&&d==='')return '';const v=(+a||0)+(+d||0)/10;return v?String(v):'';}
  return '';
}

export function onPickerChange(sl){
  const pk=sl.closest('.picker');if(!pk) return;
  // al elegir una parte, las vacías pasan a 0 para que el valor quede completo y visible
  if(sl.value!=='') pk.querySelectorAll('select').forEach(o=>{if(o!==sl&&o.value===''){const z=[...o.options].find(x=>x.value==='0');if(z)o.value='0';}});
  const hid=pk.querySelector('input[type=hidden]');hid.value=pickerValue(pk);
  pk.classList.toggle('set',hid.value!=='');
  hid.dispatchEvent(new Event('input',{bubbles:true}));
}

export function clearPicker(btn){
  const pk=btn.closest('.picker');pk.querySelectorAll('select').forEach(o=>o.value='');
  const hid=pk.querySelector('input[type=hidden]');hid.value='';pk.classList.remove('set');
  hid.dispatchEvent(new Event('input',{bubbles:true}));
}

// compatibilidad: los campos de tiempo existentes pasan a ser ruedas
export function timeField(id,f,val,kind,ph,label){
  return `<label>${label}</label>${pickerHTML(id,f,kind,val,true)}`;
}
