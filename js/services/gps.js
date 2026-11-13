/**
 * GPS del móvil para los entrenos guiados: posiciones filtradas (precisión y saltos), distancia,
 * ritmo suavizado y mantener la pantalla encendida. La parte de cálculo (Track) no usa el navegador.
 */

/** Distancia en metros entre dos puntos {lat, lon}. */
export function haversine(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Recorrido: acumula distancia ignorando puntos imprecisos, saltos imposibles y el temblor del GPS parado. */
export class Track {
  constructor(saved) {
    this.pts = []; this.dist = 0; this.last = null; this.fixes = 0;
    if (saved) { this.dist = saved.dist || 0; this.last = saved.last || null; }
  }
  /** p = { lat, lon, acc (m), t (ms), ele? } → true si se ha usado. */
  add(p) {
    if (!(p.acc <= 35)) return false;
    this.fixes++;
    if (!this.last) { this.last = p; this.pts.push(p); return true; }
    const d = haversine(this.last, p), dt = (p.t - this.last.t) / 1000;
    if (dt <= 0) return false;
    if (d / dt > 7.5) return false;                         // más de 27 km/h: salto del GPS
    if (d < Math.max(6, p.acc * 0.8)) return false; // parado o temblor: espera a alejarse de verdad del último punto
    this.dist += d; this.last = p; this.pts.push(p);
    if (this.pts.length > 4000) this.pts.splice(0, this.pts.length - 4000);
    return true;
  }
  /** Ritmo (s/km) de los últimos `win` segundos; null si no hay datos suficientes. */
  pace(now, win = 20) {
    const pts = this.pts; if (pts.length < 2) return null;
    let i = pts.length - 1; const end = pts[i];
    if (now - end.t > 12000) return null; // sin señal reciente
    let d = 0;
    while (i > 0 && end.t - pts[i - 1].t <= win * 1000) { d += haversine(pts[i - 1], pts[i]); i--; }
    const dt = (end.t - pts[i].t) / 1000;
    if (dt < win * 0.5 || d < 15) return null;
    return dt / (d / 1000);
  }
  save() { return { dist: this.dist, last: this.last }; }
}

let watchId = null;
export function startGps(onPoint, onError) {
  if (!('geolocation' in navigator)) { onError && onError({ code: 0 }); return () => {}; }
  watchId = navigator.geolocation.watchPosition(
    pos => onPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, ele: pos.coords.altitude, t: pos.timestamp || Date.now() }),
    err => onError && onError(err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  return stopGps;
}
export function stopGps() { if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); watchId = null; }

/* ---------- pantalla encendida ---------- */
let lock = null;
export async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); } } catch (e) { lock = null; }
}
export function releaseAwake() { try { if (lock) lock.release(); } catch (e) {} lock = null; }

/** Recorrido en formato GPX (para subirlo a Strava si se activa). */
export function toGpx(pts, name) {
  const esc = s => String(s).replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Zancada" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(name)}</name><type>running</type><trkseg>`
    + pts.map(p => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : ''}<time>${new Date(p.t).toISOString()}</time></trkpt>`).join('')
    + '</trkseg></trk></gpx>';
}
