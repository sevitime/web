# Instrucciones para agentes en la web de SeviTime

Este repositorio es la web pública de `sevitime.com`, separada de la app
Flutter. Su remoto es `sevitime/web`. Los cambios de la web se hacen y se
revisan dentro de este repositorio; no modifiques `/home/selu/Documentos/sevitime`
salvo que la petición también pida un cambio en la app.

Antes de editar, identifica si trabajas en la portada (`index.html`),
`explorar/`, `mapa/` o `ranking/`, y prueba el flujo afectado en móvil y modo
oscuro. Conserva los metadatos SEO, el `CNAME`, los enlaces de App Links y la
sesión de Google/Supabase. No publiques ni cambies DNS sin autorización.

La copia completa de esta web está en `/home/selu/Documentos/sevitime-web` y
se guarda junto a la copia de la app, pero los repositorios Git siguen siendo
independientes.

## Categorías de lugares (compartidas con la app)

`lugares.js` incrusta un bloque `CATEGORIAS_LUGARES` (categoría, etiqueta,
emoji y color de cada tipo de lugar de OSM) generado en el repo de la app, no
escrito a mano. Si tocas ese bloque a mano, se pierde en la próxima
regeneración.

Para añadir o cambiar un tipo:

1. En `/home/selu/Documentos/sevitime`, edita
   `lib/models/place_categories_data.dart` y ejecuta
   `dart run tool/generar_categorias_lugares.dart`.
2. Aquí, ejecuta `node tool/actualizar_categorias.mjs` (por defecto lee el
   JSON del paso 1 como repo hermano; `RUTA_CATEGORIAS` lo cambia).
3. Comitea el cambio en los dos repositorios.

No hay cron ni GitHub Actions detrás: los tipos cambian pocas veces al año y
el resultado es un fichero estático, así que regenerarlo a mano es más barato
que automatizarlo.

## Librerías propias y terceros (privacidad)

Las librerías y las fuentes del mapa están **autohospedadas** en `libs/`, no
vienen de un CDN de terceros: `maplibre-gl` 4.7.1, `pmtiles` 3.2.1 y
`@supabase/supabase-js` 2.116.0, más las tipografías de las etiquetas del mapa
en `libs/fonts/OpenSansRegular/` (rangos PBF de Open Sans Regular, de
OpenMapTiles). Los tiles también son propios (Worker de Cloudflare). Al
actualizar una, descarga la versión fijada, guárdala en `libs/` y actualiza esta
nota. Motivo: un tercero que recibe la IP del visitante obliga a declararlo en
la política de privacidad.

Con esto la web no habla con ningún tercero para pintar el mapa, **con una
excepción: `/admin/`**. El panel es la app Flutter compilada a web y su mapa es
`flutter_map`, que pide imágenes y no sabe leer PMTiles, así que usa los tiles
de `tile.openstreetmap.org` con el filtro oscuro. Antes usaba MapTiler, y se
quitó el 29 de septiembre de 2026 porque la clave viajaba dentro de
`admin/main.dart.js`, a la vista de cualquiera, y era **la misma** que lleva el
AAB: quien la copiara podía agotar la cuota y dejar el mapa gris en la app de
todo el mundo.

La excepción se acepta porque el panel está detrás del login con lista blanca
(dos cuentas), así que las únicas IP que llegan a OSM son las suyas, no las de
los visitantes. Si algún día el panel deja de estar cerrado, esto hay que
revisarlo. La salida buena sería que el panel abriera `/mapa/` en vez de pintar
el suyo.

Ojo: el nombre
de `text-font` en el estilo es el de la **carpeta**, no el de la fuente real
(véase `libs/fonts/OpenSansRegular/`). Si se cambia, hay que cambiar el nombre a
la vez en `mapa/estilo-mapa.js` y `mapa/index.html`.

La política de privacidad vive en el repo `sevitime/privacidad` y se publica en
`https://sevitime.github.io/privacidad/`. Es un solo documento; desde el 21 de
septiembre de 2026 cubre también la web (`sevitime.com`).

En este repo hay una **copia** en `privacidad/index.html` (y
`privacidad/borrar-cuenta.html`), servida en `https://sevitime.com/privacidad/`.
No es la fuente: Google exige que el enlace de política de privacidad del
consentimiento de OAuth esté alojado en el **mismo dominio** que la home para
poder verificar la marca de la app, así que se publica aquí también. Si cambia
el texto en `sevitime/privacidad`, hay que copiarlo aquí en el mismo commit (y
al revés). El pie de `index.html`, `404.html` y `ranking/index.html` enlaza a
`/privacidad/`.

## `/lugar/`: la página de un sitio

Existe para que **compartir un bar desde la app lleve a SeviTime y no a Google
Maps**. Hasta el 29-sep-2026 el botón de compartir mandaba
`maps.google.com/?q=<lat>,<lon>`: cada cosa que compartía un usuario era
tráfico regalado a Google, y quien lo recibía no se enteraba de que SeviTime
existía.

La clave del sitio va en `?k=`, y es la **misma** que usa la app
(`Place.placeKey`: lat y lon con cinco decimales y un guión bajo), así que no
hay tabla de equivalencias que mantener. Los datos salen de `lugares.js`, o
sea de la foto diaria más las altas menos los ocultos: lo mismo que el mapa.

El botón abre `sevitime://lugar/<nombre>`, que es el formato que la app **ya**
entiende (`EnlaceEntrante._desdeEsquema`), y cae a Google Play si no pasa nada
en 1,2 s. Por eso funciona con la 1.0.20 ya instalada, sin versión nueva. Su
punto débil es que la app busca por nombre: en el centro hay 45 «Caixabank».
Arreglarlo pide que la app acepte también la clave de coordenadas.

**Lo que esta página NO hace, y es a propósito por ahora:**
- **No tiene vista previa propia al compartirla.** Los rastreadores de WhatsApp
  y Twitter no ejecutan JavaScript, así que leen las `og:` del fichero, que son
  genéricas. Para que la previa diga el nombre del bar hace falta una página
  **por sitio**, generada.
- **No hay una página generada por sitio.** Serían ~40 MB en el repo y habría
  que regenerarlas con la foto diaria, así que no se hace «por si acaso».

**Lo que sí hace desde el 11-oct-2026, para que Google encuentre los sitios:**
la ficha pone ella misma su título, su descripción, su `canonical`
(`/lugar/?k=…`) y unos datos estructurados `Place` con lo que está a la vista
(`paraBuscadores`), y las que no existen se marcan `noindex`. El HTML no lleva
`canonical` fijo a propósito: lo pone el script. Como desde la web no había
más camino a las fichas que el mapa (y Google no toca mapas), hay dos listas
generadas con `node tool/sitemap_lugares.mjs` a partir de `lugares.js`:
`sitemap-lugares.xml` y **`/sitios/`**, una página con un enlace normal a cada
ficha, ordenada por tipo y enlazada desde el pie de la portada. `sitios/` no
se edita a mano; un test comprueba que las dos listas coinciden. **No van
todos**: solo los que tienen al menos dos de horario, teléfono y web (534 de
más de 9.000 ese día); una ficha con un nombre y un mapa es contenido pobre.
Tras regenerar, `node tool/versionar.mjs`. En el mapa, tocar un sitio sin
sesión enseña una tarjeta con «Ver ficha» y «Corregir» (antes abría el panel
de entrar con Google, que para quien solo mira era un muro). Es la
versión ligera: Google indexa las páginas que dependen de JavaScript más
despacio y con menos garantías que una generada, y la vista previa al
compartir sigue siendo la genérica.

La ficha enlaza a `/mapa/?modo=corregir&k=<place_key>` para abrir la corrección
con ese sitio ya seleccionado. El mapa conserva esos parámetros durante el
acceso con Google; no debe obligar a buscar de nuevo el lugar compartido.

## `/perfil/`: perfiles dentro del dominio principal

El cuadro de honor enlaza a `/perfil/?n=<nombre>`, que lee únicamente los datos
públicos de `fn_perfil_publico` y `fn_rutas_de_usuario`. La página usa la copia
autohospedada de Supabase y mantiene `noindex`, porque todos los nombres pasan
por un único HTML con parámetro.

Los enlaces antiguos `sevitime.github.io/perfil/` siguen existiendo y no se
redirigen: son App Links compartidos por versiones publicadas de la app y su
dominio conserva `/.well-known/assetlinks.json`. Las rutas de usuario que salen
en el perfil siguen apuntando a `sevitime.github.io/ruta/` hasta que exista una
ficha de ruta equivalente en este repositorio.

## Sitios ocultos: la web no puede fallar enseñándolos

`lugares_ocultos` es lo que tapa los cerrados, los mal puestos y los que dejan
sitio a un alta. Si la petición falla, **no vale quedarse sin lista**: eso
pinta justo lo que se quería esconder. `lugares.js` guarda la última lista
buena en `localStorage` (`sevitime_ocultos`) y tira de ella cuando Supabase no
responde, igual que la app hace en `place_reports_service.dart`.

Sin caducidad a propósito: una lista de ayer oculta de más como mucho un sitio
recién desocultado, y eso es preferible a enseñar de más. El límite que queda,
y no tiene arreglo: en la **primera** visita de un navegador no hay nada
guardado, así que si Supabase está caído en ese momento se verán los ocultos.

Cubierto por `tool/ocultos_respaldo.test.mjs`, que corre el `lugares.js`
publicado con un `fetch` y un `localStorage` simulados.

## Qué dibuja el mapa

El estilo (`mapa/estilo-mapa.js`) **no** dibuja los POI del basemap de OSM a
propósito: eran cientos de puntos que además duplicaban los sitios de SeviTime
(que ya salen de OSM). Los únicos puntos del mapa son los de SeviTime —la capa
`sitios`, con color por categoría— más su capa de etiquetas. En el editor los
sitios se cargan y aparecen al abrir el mapa, igual que en la app; el botón
«Ocultar sitios» permite quitarlos temporalmente. Para avisar de un cambio se
busca el sitio con el buscador (que abre su reporte) o se toca un sitio visible,
y para añadir uno se toca un hueco del mapa o el botón dorado «Añadir lugar».

`/mapa/` es la implementación única de esta pantalla. `/explorar/` conserva la
URL pública y redirige aquí, para que no vuelvan a aparecer dos mapas con
comportamientos distintos.

El estilo es **una copia** del de la app
(`lib/widgets/mapa/estilo_mapa_vectorial.dart` en `sevitime/`): paleta, capas y
etiquetas tienen que coincidir. Si tocas uno, toca el otro.

## Consistencia de datos con la app

Lo que se ve en la web tiene que coincidir con lo de la app. Cómo se consigue:

- **Lugares de OSM:** los dos leen la **misma foto diaria**
  (`lugares-sevilla.json` en Storage, generada por `tool/snapshot_lugares.mjs`
  en el repo de la app). La web la pide en `lugares.js` (`SNAPSHOT_URL`).
- **Altas manuales** (`lugares_manuales`): lo que se crea al aprobar una
  sugerencia o un renombrado, para que el sitio salga al momento. La app las
  mezcla en caliente y **la web también** las lee desde `lugares.js` (lectura
  pública) y las mezcla, con el **mismo mapeo de tipos** que
  `lib/services/manual_places_service.dart` (constante `TIPO_ES`). Si se añade
  un tipo en español allí, hay que añadirlo también aquí.
- **Categorías/colores/emojis:** una sola fuente en la app
  (`lib/models/place_categories_data.dart`), copiada con
  `tool/actualizar_categorias.mjs`.
- **Aportaciones:** la web escribe en las mismas tablas (`sugerencias`,
  `reportes_lugares`) que la app; se moderan en el panel de la app.
- **Tiles del mapa:** el mismo `.pmtiles` propio.

**Datos curados:** tanto la app como la ficha emergente de la pantalla unificada leen
`curated_places` (descripción, foto, horario verificado, etiquetas y
recomendación editorial). La web los pide solo al abrir un sitio y conserva la
respuesta durante la visita, para no retrasar la carga del mapa.

**Latencia:** las altas manuales aparecen al momento (lectura directa). Los
cambios que van solo a OSM (notas) aparecen cuando OSM los aplica y se regenera
la foto diaria (hasta ~1 día).

## Panel de administrador (`admin/`)

`admin/` es el panel de administrador de la app compilado para navegador
(`https://sevitime.com/admin/`). **No se edita a mano**: lo genera
`./publicar_panel_web.sh` desde el repo de la app (arranque
`lib/main_panel.dart`) y cada publicación lo sustituye entero. Para cambiar
el panel, se cambia en la app y se vuelve a publicar.

Sigue la regla de terceros de arriba: el motor de dibujo y las fuentes de
reserva van autohospedados. Lo único que sale fuera es el cliente de Google
Sign-In, que es el propio login. Lleva `noindex` y está fuera de
`robots.txt`. Quién entra lo decide el servidor (`fn_es_admin` y RLS), no la
página.

## Versión en la dirección de estilos y scripts

Cada `<link>` y `<script>` propio lleva la versión de su fichero
(`/estilo.css?v=3f9a1c2e`). GitHub Pages deja que el navegador guarde cada
fichero diez minutos, y sin esto un cambio de CSS o JS «no se veía» hasta
pasado ese rato. **Después de tocar un `.css` o un `.js`, ejecuta
`node tool/versionar.mjs` antes de commitear.** Si se olvida,
`tool/versiones.test.mjs` falla y lo dice. `libs/` y `admin/` no se versionan.

## Movimiento

La portada entra animada y las listas de Rutas, Eventos y el cuadro de honor
enseñan siluetas mientras cargan y luego entran escalonadas; entre páginas hay
un fundido (View Transitions). Todo está al final de `estilo.css`, con tres
reglas que conviene no romper:

- **El contenido no depende del movimiento.** Sin JavaScript, o si el script
  falla, la página se ve entera. La clase `anim` solo la pone el script de la
  portada, y las siluetas (`.hueso`) son hijos reales del contenedor que cada
  página borra al pintar o al fallar la carga.
- **Con «reducir movimiento» no se anima nada**: todo va dentro de
  `prefers-reduced-motion: no-preference`.
- **Una lista solo «llega» la primera vez** (`SeviLlegada`, en `nav.js`).
  Rutas y el cuadro de honor repintan al filtrar o al iniciar sesión, y volver
  a animar en cada toque marea.

## Eventos para buscadores

`eventos/eventos.js` describe los eventos de la agenda en `schema.org/Event`
(`paraBuscadores`) al cargar. Solo lo que está a la vista en las tarjetas, y
la dirección se queda en «provincia de Sevilla, España» porque del sitio se
sabe el nombre, no la calle. Límite conocido: Google prefiere una página por
evento y aquí van todos en una, así que puede entenderlos y no destacarlos.
