# Zancada: instalación

Zancada es una web app: se abre en Safari y se instala en la pantalla de inicio del iPhone como cualquier app. No necesita Mac, App Store ni servidor propio. Todos los datos (plan, historial, conexión con Strava) se guardan **solo en el iPhone del corredor**.

Necesitas:
- Una cuenta gratuita de GitHub, para alojar los archivos.
- La cuenta de Strava del corredor (su reloj Huawei ya sube ahí las carreras).

---

## 1. Publicar la app (una sola vez, unos 10 minutos)

1. Entra en https://github.com y crea una cuenta si no tienes.
2. Pulsa **New repository**. Nombre: `zancada`. Márcalo como **Public** y pulsa **Create repository**.
3. En el repositorio vacío, pulsa **uploading an existing file**. Arrastra **todo el contenido** de esta carpeta (`index.html`, `manifest.webmanifest`, `sw.js`, `robots.txt` y los cinco iconos `.png`). Pulsa **Commit changes**.
4. Ve a **Settings › Pages**. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y pulsa **Save**.
5. En uno o dos minutos la app estará en:
   `https://TU-USUARIO.github.io/zancada/`

> El código es público, pero no contiene ninguna clave ni ningún dato. Las claves de Strava se escriben dentro de la app y se quedan en el iPhone.

## 2. Crear la conexión con Strava (con la cuenta del corredor)

Strava solo deja leer datos a través de una "aplicación" registrada. Para uso personal, lo más sencillo es que la cree **el propio corredor con su cuenta**: así la app solo accede a sus datos.

1. Inicia sesión en Strava con la cuenta del corredor y entra en https://www.strava.com/settings/api
2. Rellena:
   - **Application Name:** Zancada (o lo que quieras)
   - **Category:** Training
   - **Website:** `https://TU-USUARIO.github.io/zancada/`
   - **Authorization Callback Domain:** `TU-USUARIO.github.io` (sin `https://` y sin barra)
3. Guarda. Verás un **Client ID** (un número) y un **Client Secret** (pulsa *show*). Los necesitarás en el paso 3.

Ten en cuenta:
- Las aplicaciones nuevas de Strava empiezan en "modo de un solo atleta". Para uso personal es justo lo que hace falta.
- Desde junio de 2026, Strava puede pedir una suscripción de pago a quien registra una aplicación. Si te lo pide, la cuenta del corredor necesitará suscripción.

## 3. Instalar en el iPhone del corredor

1. Abre `https://TU-USUARIO.github.io/zancada/` en **Safari**.
2. Pulsa **Compartir › Añadir a pantalla de inicio**.
3. Abre Zancada **desde el icono**, no desde Safari: cada sitio guarda sus datos por separado.
4. En la primera pantalla, escribe el **Client ID** y el **Client Secret** y pulsa **Conectar con Strava**. Acepta el permiso para ver las actividades.
5. La app importa los últimos 4 meses de carreras y rellena el formulario (km por semana, días, nivel y forma). Revisa los datos, elige el objetivo y pulsa **Crear mi plan**.

**Si después de aceptar en Strava acabas en Safari en vez de en la app,** verás una pantalla con un código. Cópialo, abre Zancada desde el icono y pégalo en **Perfil › Strava › Avanzado › Código de conexión**.

## 4. Si la conexión falla ("El navegador no pudo hablar con Strava")

Algunos navegadores bloquean que una página hable directamente con Strava (es una protección llamada CORS). La solución es un pequeño intermediario gratuito que no guarda nada:

1. Crea una cuenta en https://dash.cloudflare.com y ve a **Workers & Pages › Create › Create Worker**. Llámalo `zancada-proxy` y pulsa **Deploy**.
2. Pulsa **Edit code**, borra lo que haya y pega el contenido de `proxy-cloudflare-worker.js`. En la línea `ALLOWED_ORIGIN` pon `https://TU-USUARIO.github.io`. Pulsa **Deploy**.
3. Copia la dirección del worker (algo como `https://zancada-proxy.TU-USUARIO.workers.dev`).
4. En Zancada: **Perfil › Strava › Avanzado › Proxy**, pega esa dirección y vuelve a pulsar **Conectar con Strava**.

## 5. Uso diario

- El corredor graba la carrera con el reloj. Cuando se sube a Strava, basta con abrir Zancada: sincroniza sola (o pulsa **Sincronizar**).
- Cada carrera se empareja con la sesión del plan de ese día (o de un día cercano de la misma semana).
- Si Strava no trae el esfuerzo percibido, la app lo estima por el pulso y pide una valoración rápida: Muy fácil, Fácil, Normal, Duro o Al límite. Es el dato que más ayuda a adaptar el plan.
- Lo que cambia solo:
  - **Marca objetivo:** si pones una marca (por ejemplo 10 km en 50:00), la app calcula si es alcanzable en el plazo, construye el plan para llegar a ella (más volumen y calidad si es ambiciosa, sesiones a ritmo de carrera objetivo) y cada dos semanas revisa si vas en camino. Si vas por detrás, añade calidad o, si el problema son las sesiones saltadas o la fatiga, te lo dice. Si ya no es alcanzable, propone una marca realista. Si vas por delante, propone apuntar más alto.
  - **Ritmos:** se ajustan con los mejores esfuerzos de Strava (1 milla, 5 km, 10 km…), los tests de 5 km, las carreras y la parte rápida de las series. Mejoran como mucho un 3 % por semana para no fiarse de un GPS loco.
  - **Volumen:** baja si las sesiones cuestan más de lo previsto, si se saltan entrenamientos o si la fatiga de la última semana supera mucho a la forma de base. Sube si todo resulta fácil.
  - **Sesiones saltadas:** las importantes se mueven a otro día libre de la semana.
  - **Rodajes demasiado rápidos:** avisa si van demasiado deprisa o con el pulso alto (más del 82 % de la FC máxima).
  - **Predicciones:** tiempos para 5 km, 10 km, media y maratón, y previsión para el día de la carrera según la tendencia de mejora.

## Funciones principales

- **Entrenos por bloques:** calentamiento, parte principal y vuelta a la calma, cada bloque con distancia o tiempo, ritmo y zona de pulso, más la duración estimada.
- **Análisis de cada sesión:** compara cada serie o cada km de Strava con lo pedido (ritmo, repeticiones, regularidad, pulso, desacople) y da un veredicto: Cumplida, Cumplida con matices o Incompleta. Muestra también qué cambió en el plan por esa sesión. Para analizar series una a una, pulsa vuelta en el reloj al empezar y acabar cada serie.
- **Calendario:** en cada sesión de esta semana, «Cambiar de día» la mueve o la intercambia. En Plan, «Pausar el plan» para lesión, enfermedad o viaje. Al volver, la carga se ajusta según los días parados y los primeros días son solo suaves.
- **Zonas:** en Progreso › Tus zonas, ritmos de recuperación a series cortas y zonas de pulso Z1–Z5. Pon la FC máxima o la edad en Perfil.
- **Resumen semanal:** cada lunes, en Hoy, aparece un resumen de la semana pasada y de lo que viene.

- **Mejores marcas:** puedes poner tus marcas de 5 km, 10 km, media y maratón con su antigüedad. Con Strava, la app busca además tus mejores esfuerzos (1 km, 1 milla, 5 km, 10 km, media, maratón) en el último año. La forma de partida sale de la marca que mejor te representa hoy: las antiguas cuentan menos.
- **Desnivel:** eliges el perfil de la carrera (llana, ondulada, con cuestas, de montaña). Ajusta la predicción y la marca objetivo, y mete cuestas en las fases fuertes si la carrera las tiene. El análisis usa el ritmo ajustado por pendiente de Strava.
- **Añadir entreno:** desde Hoy o Progreso puedes registrar a mano cualquier carrera (fecha, tipo, distancia, tiempo, desnivel, pulso, esfuerzo). Si ese día había sesión, cuenta como hecha. Las competiciones actualizan tus marcas y tus ritmos. Cualquier registro se puede borrar.
- **Zonas y ritmos que se recalculan solos:** el umbral de pulso se mide en tus tempos, tests y carreras con pulsómetro, y de ahí salen tus zonas. Los ritmos se ajustan con tests, carreras, series y con la relación entre tu pulso y tu ritmo en los rodajes. Los cambios son graduales y se explican en la app.
- **Estado del día:** cada día con sesión, 4 toques (sueño, piernas, estrés, molestias). Junto con tu carga y la recuperación da una nota de 0 a 100 y un consejo: adelante, suavízala, mejor suave o descansa. En cada sesión, «No estoy al 100 %» la ajusta si estás cansado, vas justo de tiempo, tienes una molestia o estás enfermo.
- **Carga:** cada entreno se mide con el pulso (TRIMP) si hay pulsómetro, si no con el ritmo, y si no con el esfuerzo percibido. En Progreso verás tu carga de 7 días frente al rango recomendado, el reparto de intensidad de las últimas 4 semanas y avisos si el impacto (km y desnivel) se dispara.
- **Predicciones realistas:** en media y maratón tienen en cuenta tus tiradas largas y tu volumen. Cada carrera con pulso recibe una nota de rendimiento (80–120 %).
- **Calor:** si pones tu ciudad y la hora a la que sueles correr, la app consulta la previsión en Open-Meteo (gratuito, solo se envía la ciudad) y ralentiza los ritmos los días de calor.
- **Fuerza y movilidad:** dos rutinas cortas a la semana (A y B) en días que no estorban a las sesiones duras.
- **Zapatillas:** kilómetros de cada par según Strava, con aviso a partir de 600 km.
- **Tiempo disponible:** si indicas un máximo para los días entre semana, las sesiones se acortan para caber en él.

## 6. Datos y copias de seguridad

- Todo vive en el almacenamiento del iPhone, dentro de la app instalada. Si se borra la app de la pantalla de inicio, se borran los datos.
- En **Perfil › Tus datos › Descargar copia** se guarda un archivo en la app Archivos. Con **Restaurar copia** se recupera, también en otro móvil. La copia incluye la conexión con Strava: no la compartas.
- Strava pide en sus condiciones que no se guarden sus datos más de 7 días. Zancada guarda solo un resumen de cada carrera (fecha, distancia, tiempo, pulso, parciales). Es para uso personal del propio corredor con sus propios datos, pero tenlo en cuenta.

## 7. Actualizar la app

Si te paso una versión nueva de `index.html`, súbela al repositorio en GitHub encima de la anterior (**Add file › Upload files**). La próxima vez que el corredor abra la app con conexión, se actualizará sola. Sus datos no se tocan.
