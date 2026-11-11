# Pruebas

Sin dependencias para las pruebas de lógica (solo Node ≥ 18):

```sh
node tests/engine.test.cjs   # 60 corredores simulados durante 160 días
node tests/check-sw.cjs      # el service worker incluye todos los archivos
```

En navegador real (opcional, necesita Playwright):

```sh
pip install playwright && playwright install chromium
python3 tests/e2e/smoke.py
```

- `bundle.cjs` une los módulos de `js/` en un único script para ejecutarlos en Node.
- `harness.cjs` simula un DOM mínimo y devuelve todo lo exportado por la app.
- `e2e/debug.js` expone los módulos en `window` solo durante las pruebas e2e;
  la app nunca lo carga.
