/**
 * Previsión del tiempo (Open-Meteo, solo si hay ciudad) y búsqueda de ciudad.
 */
import { save, state } from '../core/store.js';
import { refreshKm } from '../model/workouts.js';
import { heatAdj } from '../model/weather.js';

export let wxBusy=false;

export async function wxRefresh(force){
  const c=state.profile&&state.profile.city;if(!c||wxBusy) return false;
  if(!force&&state.wx&&state.wx.at&&Date.now()-state.wx.at<3*3600e3&&state.wx.key===c.lat+','+c.lon) return false;
  wxBusy=true;
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&hourly=temperature_2m,dew_point_2m&timezone=auto&forecast_days=8`);
    if(!r.ok) throw 0;
    const j=await r.json(),h=+(state.profile.runHour||8),days={};
    (j.hourly.time||[]).forEach((t,i)=>{if(+t.slice(11,13)===h){const T=j.hourly.temperature_2m[i],D=j.hourly.dew_point_2m[i];days[t.slice(0,10)]={t:T,td:D,adj:heatAdj(T,D)};}});
    state.wx={at:Date.now(),key:c.lat+','+c.lon,days};refreshKm();save();return true;
  }catch(e){return false;}
  finally{wxBusy=false;}
}

export async function geoSearch(q){
  const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`);
  if(!r.ok) throw 0;const j=await r.json();
  return (j.results||[]).map(x=>({name:x.name,area:[x.admin1,x.country].filter(Boolean).join(', '),lat:Math.round(x.latitude*100)/100,lon:Math.round(x.longitude*100)/100}));
}
