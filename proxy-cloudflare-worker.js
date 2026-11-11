// Proxy OPCIONAL para Zancada. Úsalo solo si al conectar Strava ves el aviso
// "El navegador no pudo hablar con Strava".
// Reenvía las peticiones a www.strava.com añadiendo las cabeceras CORS que el navegador necesita.
// No guarda nada. Despliégalo gratis en Cloudflare Workers (ver LEEME.md).

const ALLOWED_ORIGIN = 'https://TU-USUARIO.github.io'; // <- cambia esto por la dirección de tu app

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/oauth/token') && !url.pathname.startsWith('/api/v3/')) {
      return new Response('No permitido', { status: 404, headers: cors });
    }
    const target = 'https://www.strava.com' + url.pathname + url.search;
    const headers = new Headers();
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);
    const ct = request.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
    });
    const out = new Response(res.body, res);
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};
