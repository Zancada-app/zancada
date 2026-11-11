"""Prueba de humo en un navegador real (Playwright + Chrome/Chromium).

Recorre el asistente completo en una pantalla pequeña (320 px), crea el plan,
visita todas las pestañas y comprueba que no hay errores de JavaScript ni
desbordamiento horizontal.

Uso:  pip install playwright && playwright install chromium
      python3 tests/e2e/smoke.py
"""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = 8790


class Handler(http.server.SimpleHTTPRequestHandler):
    """Sirve la app e inyecta tests/e2e/debug.js para poder manipular el estado."""
    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/index.html'):
            html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read().replace(
                '<script type="module" src="js/main.js">',
                '<script type="module" src="tests/e2e/debug.js"></script><script type="module" src="js/main.js">')
            body = html.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def log_message(self, *a):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    problems = []
    with sync_playwright() as p:
        chrome = os.environ.get('CHROME')
        b = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
        pg = b.new_page(viewport={'width': 320, 'height': 640}, device_scale_factor=2)
        pg.on('pageerror', lambda e: problems.append('error JS: ' + str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/')
        pg.evaluate("TODAY_OVERRIDE='2026-11-12'")
        for _ in range(6):
            pg.wait_for_timeout(500); pg.click('[data-act=wnext]')
        pg.wait_for_timeout(500); pg.fill('#f-name', 'Maximiliano Alejandro')
        for _ in range(2):
            pg.wait_for_timeout(500); pg.click('[data-act=wnext]')
        pg.wait_for_timeout(600)
        if not pg.evaluate('!!state.profile'):
            problems.append('no se ha creado el plan')
        for h in ['#hoy', '#plan', '#progreso', '#perfil', '#zonas']:
            pg.evaluate(f"closeSheet(true);location.hash='{h}'"); pg.wait_for_timeout(250)
            if pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth'):
                problems.append(f'{h}: desborda en horizontal')
            text = pg.inner_text('#app')
            for bad in ('NaN', 'undefined', 'Infinity'):
                if bad in text:
                    problems.append(f'{h}: muestra {bad}')
        b.close()
    srv.shutdown()
    print('\n'.join(problems) or 'smoke OK')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
