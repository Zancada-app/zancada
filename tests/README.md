# Pruebas

Sin dependencias para las pruebas de lógica (solo Node ≥ 18):

```sh
node tests/engine.test.cjs   # 60 corredores simulados durante 160 días
node tests/shoes.test.cjs    # zapatillas: km, avisos, Strava
node tests/xtrain.test.cjs   # otros entrenos (fuerza, pilates, bici…)
node tests/finish.test.cjs   # terminarla / primera media o maratón
node tests/cycle.test.cjs    # ciclo: fases, previsión, sesiones movidas, aprendizaje
node tests/strava-marks.test.cjs  # mejores marcas desde todo el historial de Strava
node tests/check-sw.cjs      # el service worker incluye todos los archivos
node tests/check-layers.cjs  # model/ no depende de la pantalla ni de la red
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
