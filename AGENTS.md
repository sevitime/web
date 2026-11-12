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

## La web tiene que comportarse como la app

En lo que comparten, la web y la app funcionan igual, se llaman igual y piden
lo mismo sin sesión de Google: ver es libre, participar pide cuenta. La tabla
de qué hace cada una está en el repo de la app,
`/home/selu/Documentos/sevitime/docs/paridad_app_web.md`. **Mírala antes de
añadir o cambiar una función aquí, y actualiza su línea** (es un commit en el
otro repo). No quites un punto donde hoy se pide entrar sin hablarlo.

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
OpenMapTiles). Los tiles también son propios y viajan con la web
(`tiles/sevilla-provincia.pmtiles`; por Cloudflare no valen, ver abajo). Al
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

## Las teselas viajan con la web, no por Cloudflare

El `.pmtiles` de la provincia (30 MB, zoom 0-14) está **en este repo**, en
`tiles/sevilla-provincia.pmtiles`, y se sirve desde GitHub Pages como una
parte más del sitio: `https://sevitime.com/tiles/sevilla-provincia.pmtiles`.

**Por qué no está en Cloudflare, que es donde estuvo hasta el 1-nov-2026:**
los operadores españoles interceptan Cloudflare con un **certificado
suplantado** por los bloqueos de LaLiga, y el navegador corta la conexión
(`ERR_CERT_AUTHORITY_INVALID`; con HSTS ni ofrece continuar). Se probó primero
mover el Worker a un dominio propio (`tiles.sevitime.com`) **y no sirvió**: el
bloqueo sigue a las IPs de Cloudflare, no al nombre. Medido en un navegador de
verdad el mismo día: Cloudflare falla por los dos nombres, y Supabase Storage y
GitHub Pages responden `206`.

- **El fichero termina en `.png` y no es una imagen.** Es el truco que hace
  que esto funcione, y hay que entenderlo antes de tocarlo: GitHub Pages
  **comprime** lo que sirve como `application/octet-stream` (lo que le toca a
  un `.pmtiles`) y **aplica los rangos al tamaño comprimido**, así que todo lo
  que pase del byte 30.264.787 devuelve **416** — y ahí viven los metadatos
  del PMTiles. Dart pide gzip siempre: la app 1.0.33 salió con el mapa
  vectorial roto por esto y se cayó a su raster de repuesto. Las imágenes y
  las fuentes **no** se comprimen (`favicon-512.png` e `inter-var.woff2` dan
  el mismo tamaño pidiendo gzip o sin pedirlo), así que con `.png` los rangos
  vuelven a ser honestos. Al cliente le da igual el tipo declarado: lee bytes.
  **Al regenerar las teselas hay que volver a renombrarlas.**
- **Mismo origen que la web**: sin CORS y con exactamente las mismas
  dependencias que la página que pinta el mapa.
- **Se descartó Supabase Storage** aun funcionando: su plan gratuito da 5 GB/mes
  de tráfico **compartidos con la API de la app**, así que un mes de mapa
  cargado no dejaría sin mapa, dejaría sin base de datos. GitHub Pages da
  100 GB/mes y no comparte cuota con nada que importe.
- **El precio, dicho claro:** son 30 MB dentro de git, y otros 30 cada vez que
  se regenere (`mapa-propio/generar-tiles.sh` en el repo de la app, menos de
  dos minutos). El repo pesaba 31 MB. Si algún día estorba, ese historial se
  aplasta.
- **El Worker y `tiles.sevitime.com` se quedan vivos**: los llevan dentro las
  versiones ya publicadas de la app. No los apagues hasta que esas versiones no
  cuenten.
- **La web no tiene respaldo de mapa, y se decidió que no lo tenga**
  (1-nov-2026). La app sí (`MapaBase` cae al raster de MapTiler), y por eso
  esto se vio aquí y no allí. Un respaldo gana su precio cuando cubre a un
  tercero que puede caerse con la web viva, que era el caso con Cloudflare;
  ahora las teselas salen del mismo sitio que la página, así que si no llegan
  es que tampoco ha llegado la web y no hay nada que pintar. A cambio costaría
  un tercero recibiendo la IP de cada visitante, declararlo en la política
  —que hoy promete que la web no habla con terceros, y por eso no hay banner
  de cookies— y, si fuera con teselas de OpenStreetMap, usar un servicio
  comunitario para tráfico público. Si algún día las teselas vuelven a
  depender de un tercero, esta decisión se vuelve a abrir.
- **El aviso de «el mapa no ha cargado» no nombra ninguna causa.** Echaba la
  culpa al bloqueo de Cloudflare durante los partidos, y desde que las teselas
  viajan con la web eso ya no puede ser: mandaba a mirar donde no era.

## Contador de visitas (`visitas.js`)

La web no medía nada hasta el 12 de octubre de 2026. Ahora `visitas.js` suma
uno a `(día, página)` en la tabla `web_visitas` de Supabase. **Un contador, no
una analítica:** no guarda identificador de ninguna clase —ni cookie, ni
`localStorage`, ni IP, ni huella—, así que son páginas vistas y no visitantes
únicos, y por eso **la web no pide permiso de cookies**. En cuanto se guardara
un identificador para contar, la ePrivacy pediría banner; no lo hay y no lo va
a haber.

No se usó una herramienta de terceros por la regla de arriba: la política
promete que la web no habla con terceros. Y tampoco había alternativa gratis
por otro lado —GitHub Pages no da visitas, y el DNS está en Cloudflare pero sin
proxy, así que no hay analítica de Cloudflare; encender el proxy naranja sobre
Pages se juega el certificado y los App Links—.

Detalles que hay que respetar al tocarlo:

- **Va con un `fetch` pelado al endpoint REST, sin cargar `supabase-js`.** La
  librería son 216 KB y `auth.js` se parte en dos justamente para no
  descargarla a quien solo pasa por la portada. Contar visitas no puede costar
  más que la página que cuenta.
- **La página se manda sin `?id=` ni `#ancla`**: qué tipo de página, nunca qué
  sitio ni qué ruta se estaba mirando. Y `fn_web_visita` la pasa además por
  **lista blanca** en el servidor: lo que no esté previsto entra como `otra`.
  Si se añade una página al sitio y se quiere contar, hay que añadirla a esa
  lista (`docs/sql/web_visitas.sql` en el repo de la app) **y** a los nombres
  de `lib/screens/admin/widgets/uso_paginas_web.dart`; si no, se suma a «otra».
- **Las visitas de los administradores no cuentan**, y el filtro está aquí, no
  en el servidor: el `fetch` va con la clave pública, así que para Postgres
  somos `anon`. `visitas.js` no dispara si hay marca `sevi_no_contar` en
  `localStorage`, y la marca se pone sola cuando `auth.js` pregunta
  `fn_es_admin()` y sale `true`. Por eso **`auth.js` tiene que seguir avisando
  con `window.SeviVisitas.decidir(...)`** en las tres salidas de su
  comprobación: si se quita, con sesión iniciada las visitas esperan el tiempo
  de espera entero. Para un navegador o un móvil donde no se vaya a iniciar
  sesión: entrar una vez en `sevitime.com/?nocontar=1`.
- `explorar/` y `guardados/` **ya sí se cuentan** (1-nov-2026, aplicado):
  la primera dejó de ser una redirección a `/mapa/` y es la pantalla principal
  de la web; la segunda es la lista personal de guardados. Está en
  `docs/sql/web_visitas_rutas_nuevas.sql`, en el repo de la app.
- Lo ve el administrador en `/admin/` → «Uso de la app» → «Visitas de la web».

## `/explorar/`: los sitios que tienes cerca

Desde el **1 de noviembre de 2026** es la pantalla principal de la web y lo que
abre «Explorar» en la navegación de todas las páginas. Antes era un
`window.location.replace` a `/mapa/`, que es un editor del mapa, no una lista:
quien entraba desde un iPhone —donde no hay app— no tenía la pantalla principal
de SeviTime en ninguna parte.

Es la gemela de `HomeScreen` en la app, con el mismo criterio:

- **La ubicación la da el navegador y solo al pulsar** «Ver lo que tengo cerca».
  No se envía a ningún servidor. Que ya se dio el permiso se recuerda en
  `localStorage` (`sevi-ubicacion-ok`) para no volver a preguntar.
- **Sin ubicación no se dice «cerca de ti»**: se dice «En el centro de Sevilla»
  y se ordena por valoración, igual que hace la app en escritorio
  (`CercaDeTiHeader`). Llamarlo «cerca» sería mentir.
- **Más allá de 60 km se avisa y se usa el centro**: a 390 km de Sevilla la
  posición es correcta y aun así no sirve de nada.
- **Los chips son `FILTROS_EXPLORAR`, no `FILTROS`.** `FILTROS` es la lista de
  la **lupa**, donde bares, restaurantes y cafés van separados.
  `FILTROS_EXPLORAR` es la de **Explorar**, donde los tres van juntos en
  «Hostelería», y es el espejo de `categorias_chips.dart` (orden y etiquetas)
  y de `_tiposParaFiltro` en `home_provider.dart` (qué tipos entran). Los
  tipos salen del bloque generado cuando forman una categoría entera, para
  que no se separen solos. Hasta el 1-nov-2026 esta página usaba los de la
  lupa por error y enseñaba «Bares» y «Restaurantes» aparte.
- **«Todos» no enseña servicios** (cajero, banco, farmacia, parking) ni el
  estadio: `TIPOS_DE_TODO` en `lugares.js` es el espejo de
  `_computePlacesFiltrados` en la app. No es que se escondan: tienen su propio
  chip, igual que en la app. Si cambia allí, cambia aquí.
- **«Valoración» ordena por `place_ratings.score`**, la media bayesiana que
  calcula el servidor (prior de 5 votos a 3,6). Nunca se enseña como número;
  lo que se ve es `average_rating`. Las 97 filas se piden de una vez, sin
  trocear por clave como hace la app.
- **Buscando por texto el radio no manda**: quien escribe «alcázar» quiere el
  Alcázar esté a 300 m o a 3 km. Se busca por nombre y por calle
  (`direccion`, que `aLugar` saca de `addr:street` como la app).

**«Añadir lugar»** es el botón flotante amarillo de abajo a la derecha, con
el mismo sitio, color y palabras que en la app (`BotonFlotanteAportar`). Hace
lo que `sugerirSitio` allí, incluida su regla: **sin posición real no abre el
formulario**, porque el sitio se clavaría en el centro de Sevilla; si no hay
permiso todavía, se pide ahí mismo. Lo que abre es
`/mapa/?modo=sugerir&lat=…&lon=…`, o sea **el formulario que ya existe**, no
una copia: un segundo formulario escribiendo en `sugerencias` acabaría
comportándose distinto (duplicados, tipos, tapas, sesión). En la app hubo un
chip «Añadir sitio» en la lista y se quitó porque duplicaba el flotante y lo
tapaba; aquí no se repite.

**No pinta mapa a propósito.** Está en `/mapa/`, y traerlo aquí son ~600 KB de
librería y teselas en datos móviles cuando lo que se mira en un móvil es la
lista. Tampoco tiene «¿está abierto?», guardados ni modo explorador, y en la
tarjeta no sale el pueblo: en la app viene de otra foto (la de los núcleos de
población) que aquí no se descarga.

## Aplicación instalable (`manifest.webmanifest`)

Desde el **1 de noviembre de 2026** todas las páginas declaran un manifest, y
con él «Añadir a pantalla de inicio» deja la web a pantalla completa con su
icono. Es lo que más se acerca a tener la app en un iPhone, que es de donde
vino la petición.

- Los iconos son `favicon-192.png`, `favicon-512.png` y
  `icono-maskable-512.png` (este con el verde de marca de fondo y el logo al
  72%: lo que Android recorta se come fondo, no logo). Salen de
  `assets/icon.png` del repo de la app, reducidos; **no** del PNG de 691×691 a
  pelo, que es lo que dejó el favicon gris en Google.
- `start_url` es `/explorar/`, no la portada: quien se la instala quiere lo que
  tiene cerca, no el argumentario de descarga.
- **Hay service worker desde el 2-nov-2026** (`sw.js`), y está solo para que
  la web instalada abra sin conexión en vez de dar la página de error del
  navegador: muestra `sin-conexion.html`. **No es una app offline**, y no
  pretende serlo: los sitios, los eventos y las rutas vienen de Supabase.
  Hasta esa fecha no había ninguno, por miedo a que chocara con el versionado
  por dirección (`?v=`); la regla que lo evita es que **el HTML nunca se sirve
  de la caché habiendo red** (se pide siempre, y la copia guardada entra solo
  si la red falla), y que de la caché solo sale directo lo que es inmutable:
  lo que lleva `?v=`, más `/fuentes/` y `/libs/`, que no cambian. Si algún día
  cambian sin cambiar de nombre, hay que subir `VERSION` en `sw.js`.
- **Lo que el service worker no toca, y no se debe tocar:** `/tiles/` (30 MB
  pedidos por rangos de bytes: un service worker en medio de una petición con
  `Range` rompe el mapa), `/admin/` (es Flutter y tiene el suyo) y cualquier
  dominio que no sea este. `sin-conexion.html` lleva los estilos dentro a
  propósito: es la página que se ve cuando no ha llegado nada.
- **El aviso de instalación en iPhone** lo pone `nav.js` (`.instalar-ios` en
  `estilo.css`), porque en iOS **ningún** navegador ofrece instalar la web:
  hay que entrar en Compartir → «Añadir a pantalla de inicio». Sale solo en
  iPhone/iPad, solo en Safari y Chrome (en Firefox y Edge de iOS esa opción no
  existe), **no en la primera página que se mira** —mucho tráfico llega de
  TikTok y se va en segundos— y si se cierra no vuelve. En Android no sale:
  ahí el navegador ya lo ofrece él solo.
- La barra de estado va en `default` y no en `black-translucent`: con
  `black-translucent` el contenido se mete debajo del reloj y, en tema claro,
  la hora y la batería se pintan en blanco sobre fondo claro.
- El `<head>` lleva además `apple-mobile-web-app-*`: en Safari son esas metas
  las que dan la pantalla completa y el nombre del icono. Si se añade una
  página nueva, hay que copiarle esas cinco líneas (y el generador de
  `/sitios/` ya las pone).

## La barra de abajo en móvil (`.barra-abajo`)

Desde el **2 de noviembre de 2026**, en pantalla estrecha la web navega con
pestañas abajo, como la app: **Explorar, Mapa, Rutas, Eventos y Guardados**.
La pone `nav.js` y se estiliza en `estilo.css`, dentro del bloque de 719 px.

- **No sale en `/mapa/`**: esa página es el mapa a pantalla completa, con su
  propia hoja abajo y los controles de MapLibre en esa esquina. En la app el
  mapa también ocupa todo.
- **La barra de arriba no se toca.** Los mismos destinos siguen en el HTML, así
  que quien entre sin JavaScript navega igual; la barra de abajo es aspecto,
  no la única salida.
- El `display: none` de escritorio va en un `@media (min-width: 720px)` y no en
  una regla suelta: suelta, al estar más abajo en el fichero, le ganaba también
  al bloque del móvil y la barra no se veía en ninguna parte.
- `html.con-barra` da el `padding-bottom` al body y sube el aviso de
  instalación de iOS, que vive en esa misma esquina. `--alto-barra` es la
  medida; el relleno de abajo es `env(safe-area-inset-bottom)`, el hueco del
  gesto de inicio del iPhone.
- Los iconos son los de la app donde hay equivalente: Rutas lleva el mapa
  plegado, igual que `Icons.map_rounded` en `main_scaffold.dart`.

## Avisos push en la web (`avisos.js`)

La web instalada en la pantalla de inicio puede recibir avisos. En iOS **solo**
así: desde iOS 16.4 los avisos web existen si la web está añadida a la pantalla
de inicio, y fuera de ahí Safari no deja ni pedir el permiso. La tarjeta vive
en `/guardados/`, que es el área de la persona.

**Reutiliza entero el envío de la app.** El token que da el navegador se guarda
en la **misma tabla** con la **misma función** (`fn_registrar_push_token`, con
`p_plataforma = 'web'` y `p_device_id` = el id de la cuenta), así que todo lo
que ya manda avisos —moderación, respuestas a lo tuyo, el aviso semanal de
`fn_avisos_planes`— llega también a la web **sin tocar `enviar-aviso` ni el
registro de envíos**. No hay tabla nueva, ni SQL nuevo, ni función nueva.

**Falta un paso que solo se puede dar en la consola de Firebase**, y hasta que
se dé la tarjeta no se pinta (`avisos-config.json` vacío → no existe):

1. Consola de Firebase, proyecto `sevitime-495417` → Configuración del
   proyecto → Tus apps → **Añadir app → Web**. No hace falta hosting.
2. Copiar `apiKey` y `appId` a `avisos-config.json`.
3. Pestaña **Cloud Messaging → Certificados push web → Generar par de
   claves**, y copiar la clave **pública** a `vapidKey` (es pública a
   propósito; la privada se queda en Google).
4. `node tool/versionar.mjs`, commit y publicar.

Lo demás ya está: `firebase-messaging-sw.js` (tiene que llamarse así y vivir en
la raíz, lo busca FCM), el permiso, el alta, la baja y el interruptor del aviso
semanal. Los dos scripts de Firebase se descargan de `gstatic.com` **solo al
activar los avisos**, y eso está escrito en la política de privacidad (repo
`sevitime/privacidad`, apartado de terceros).

Al tocar un aviso, `notificationclick` reutiliza la ventana abierta si la hay
—abrir una segunda pestaña de la misma web es lo que hace parecer que el aviso
no ha hecho nada— y va a `data.destino`, el mismo campo que usa la app.

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

El botón abre `sevitime://place/<nombre>`, que es el formato que la app **ya**
entiende (`EnlaceEntrante._desdeEsquema`), y cae a Google Play si no pasa nada
en 1,2 s. Por eso funciona con la 1.0.20 ya instalada, sin versión nueva.

**Ojo con el nombre del destino:** del 29-sep al 18-oct-2026 esto decía
`sevitime://lugar/` —y este documento lo daba por bueno—, y la app **no**
reconoce `lugar`: el botón abría la portada en vez del sitio. Salió probando
el punto de encuentro en un móvil de verdad. La app acepta las dos desde la
1.0.31, pero lo que se manda desde aquí es `place`. Su
punto débil es que la app busca por nombre: en el centro hay 45 «Caixabank».
Arreglarlo pide que la app acepte también la clave de coordenadas.

**Una página por sitio: `/sitio/<nombre>/` (desde el 12-nov-2026).**
`/lugar/?k=…` es una sola página que el script rellena, y Google no la quiso:
un mes después de mandarle 526 direcciones así en el sitemap, `site:sevitime.com`
daba cinco páginas (portada, eventos, mapa, rutas y cuadro de honor) y ninguna
ficha. Ahora los sitios con datos tienen además un fichero propio, generado:

- **Qué es.** `lugar/index.html` es el **molde**; `node tool/sitemap_lugares.mjs`
  lo copia a `sitio/<nombre>/index.html` con el título, la descripción, el
  `canonical`, los datos estructurados, el nombre, el tipo, la dirección, el
  teléfono, la web y el horario ya escritos, y la clave en `<html data-k>`.
  Encima corre el script de siempre, `lugar/ficha.js`, que pone el mapa, las
  reseñas y los botones. Por eso el estilo y el script de la ficha viven en
  `lugar/ficha.css` y `lugar/ficha.js` y no dentro del HTML: cada página
  generada pesa 11 KB y las 544 juntas, 6 MB.
- **Cuáles.** Las mismas que antes iban al sitemap: al menos dos de horario,
  teléfono y web. Una ficha con un nombre y un mapa es contenido pobre.
- **El mismo comando escribe cuatro cosas** que tienen que coincidir, y un
  test lo comprueba: `sitio/<nombre>/`, `sitio/indice.json` (clave → nombre),
  `sitemap-lugares.xml` y el listado `/sitios/`. Borra las páginas de los
  sitios que ya no entran. Después, `node tool/versionar.mjs`.
- **Cuándo regenerar.** Siempre que se toque `lugar/index.html` (el generador
  falla si no encuentra una de las líneas que sustituye, y un test falla si
  las páginas publicadas no salen del molde de hoy), y de vez en cuando para
  recoger los cambios de la foto de lugares. No hay cron: son ficheros.
- **El nombre de la página sale del nombre del sitio.** Si dos se llaman
  igual, a los dos se les añade la calle o las coordenadas. Si un bar cambia
  de nombre, su página cambia de dirección y la vieja desaparece.
- **`/lugar/?k=…` sigue igual** para todos los sitios: es adonde llevan el
  mapa, Explorar y los enlaces de la app. Si el sitio tiene página propia, su
  `canonical` apunta a ella (lo mira en `sitio/indice.json`).
- **Las visitas** a `/sitio/…` se cuentan como `/lugar/` (`visitas.js`).
- **De paso:** compartir una de estas páginas por WhatsApp enseña el nombre y
  la dirección del sitio, que los rastreadores leen del HTML.
- **Para saber si ha funcionado:** buscar `site:sevitime.com/sitio` en Google.
  El 12-nov-2026, cero. Google tarda semanas.

**El horario, en castellano.** `horarioLegible` (en `lugares.js`) traduce el
formato de OpenStreetMap («Mo-Fr 09:00-14:00; Sa off» → «Lunes a viernes, de
09:00 a 14:00. Sábado, cerrado»). Es prudente a propósito: si queda una sola
palabra que no reconoce (meses, «sunrise», comentarios), devuelve el texto
original entero. El 12-nov-2026 traducía 314 de 338. La app todavía enseña el
formato de OSM tal cual.

En el mapa, tocar un sitio sin sesión enseña una tarjeta con «Ver ficha» y
«Corregir» (antes abría el panel de entrar con Google, que para quien solo
mira era un muro).

**Nota y reseñas (desde el 11-oct-2026):** la ficha enseña la media de
`place_ratings` y las reseñas aprobadas de `fn_resenas_publicas`, de cinco en
cinco, con sus fotos, igual que la app y también sin sesión. Lo que viene de
una reseña es texto de un usuario y se pinta con `textContent`. Quien no tiene
apodo llega como «Usuario de SeviTime» y no se enlaza a ningún perfil. Si las
reseñas no se pueden leer, la sección no sale: no se dice «no tiene reseñas»
sin saberlo.

**Valorar y reseñar desde la web (desde el 1-nov-2026, `lugar/resena.js`):**
hasta entonces la ficha solo leía y el pie decía «ábrelo en SeviTime». En
Android eso es un empujón a la app; en un iPhone es un callejón sin salida,
porque la app no existe. Ahora desde aquí se valora, se reseña (texto y hasta
3 fotos), se cambia, se borra y se marcan útiles las de los demás. Detalles que
hay que respetar:

- **El servidor manda.** Hace falta apodo para firmar
  (`fn_guardar_nombre_publico`), todo pasa por moderación y qué necesita
  revisión al editar lo decide `fn_editar_resena`, no esta página. La anon key
  está a la vista en el HTML: una regla que viviera solo aquí se saltaría
  llamando a la API.
- **El voto de estrellas se escribe al enviar la reseña**, nunca al tocar una
  estrella, igual que la app desde la 0.0.57. Si ese `upsert` falla no se avisa:
  el trigger `trg_sync_voto_resena_aprobada` lo pone al aprobar.
- **`supabase-js` NO se carga en esta página.** `auth.js` la trae sola si ya
  había sesión en este navegador, o al pulsar «Entrar» (`window.SEVI.conSupabase`).
  Quien llega de un enlace compartido y solo lee no se descarga 216 KB.
- **Las fotos se reducen a 1600 px aquí antes de subir** al bucket
  `sugerencias-fotos`, con la misma ruta que la app (`uid/marca_indice.jpg`).
  Una foto de un móvil actual son 4 MB.
- **La lista pública se vuelve a pedir con el token del usuario** cuando entra:
  solo entonces `fn_resenas_publicas` dice qué reseñas son suyas y a cuáles ya
  dio «útil». Ese repintado tiene un contador de generación
  (`generacionOpiniones`): sin él, la carga inicial y la de la sesión se
  pisaban y salían la nota dos veces y ocho reseñas donde había cinco.
- **Al volver del login se conserva el `?k=`**: `auth.js` limpia solo los
  parámetros del login (`sinRastroDelLogin`) y, por si la lista de direcciones
  permitidas de Supabase rechazara una con `?k=`, la clave queda guardada en
  `sessionStorage`.

**Guardar un sitio (desde el 1-nov-2026, `lugar/guardar.js`):** «Favorito»,
«Quiero ir» y «Ya he ido», las mismas tres de la app y **en las mismas tres
tablas**, así que lo que se guarde aquí sale en la app de esa persona y al
revés. Dos cosas que no se pueden tocar a la ligera:

- **Pide cuenta, y en la app no.** Las tablas van por `device_id`, que es
  `auth.uid()` con sesión y el UUID del móvil sin ella. Un guardado anónimo en
  un navegador se queda atado a ese navegador y nadie lo vuelve a ver.
- **`place_name` no guarda lo mismo en las tres:** nombre real en
  `user_favorites` y `user_visitas`, y el **`placeKey`** en
  `user_pendientes`, pese al nombre de la columna. Es histórico y la app
  publicada depende de ello. Se lee y se borra por `place_key`, que sí está
  en las tres y en todas las filas. El `place_json` es una foto del `Place`
  de la app; `Place.fromJson` tiene valor por defecto para todo, así que basta
  con lo que la ficha sabe de verdad y **no se inventa lo que no sabe**.

La **lista** de guardados vive en `/guardados/` (`guardados/guardados.js`),
con las tres pestañas de la app y sus mismos textos de «aún no tienes nada».
Lee `place_json`, la foto que se guardó, y **no vuelve a pedir la foto
diaria**: son 360 KB para una lista de diez sitios, y el nombre guardado es el
que la persona reconoce. Se llega desde el enlace «Guardados» que `auth.js`
pone junto a la sesión —como el de «Panel» para los administradores— y desde
«Ver tus guardados» en la ficha de un sitio ya guardado.

**«Quedar aquí» (desde el 1-nov-2026, `lugar/quedar.js`):** la web sabía
**abrir** un punto de encuentro (`/encuentro/?p=…`) pero no crearlo, así que
con un iPhone podías ir adonde te citaran y no citar a nadie. Es el gemelo de
`quedar_aqui_sheet.dart`: mismos plazos (30/60/120), misma pista de 80
caracteres y el mismo mensaje al compartir. Lo que hay que respetar:

- **No se comparte la ubicación de nadie.** Viaja *el sitio* que se tiene
  abierto, con las coordenadas públicas de su ficha. Esta página no pide
  permiso de ubicación, y no debe empezar a pedirlo.
- **El plazo, el caducar y el «uno por persona» los decide el servidor**
  (`fn_crear_punto_encuentro`, de 15 a 180 minutos). Aquí solo se ofrecen tres
  plazos y se avisa **antes** de que uno nuevo sustituye al anterior.
- **Se puede terminar el que haya** (`fn_cancelar_punto_encuentro`): la
  política de privacidad lo promete, así que tiene que poderse desde donde se
  crea.
- Compartir: `navigator.share` donde exista, y copiar el enlace donde no.

La ficha enlaza a `/mapa/?modo=corregir&k=<place_key>` para abrir la corrección
con ese sitio ya seleccionado, y `/explorar/` a
`/mapa/?modo=sugerir&lat=…&lon=…` para añadir uno en tu posición. Los dos modos
pasan por `procesarModoDirecto()`, que espera a tener sesión resuelta y la
lista de sitios cargada, y cada uno se marca como hecho para no repetirse. El
pin de `modo=sugerir` se deja arrastrable, igual que el que sale al tocar el
mapa. El mapa conserva esos parámetros durante el
acceso con Google; no debe obligar a buscar de nuevo el lugar compartido.

## «¿Está abierto?» (`lugar/abierto.js`)

En la ficha, lo mismo que la app enseña en `fila_estado_lugar.dart`, y
**escribiendo en la misma tabla**: `fn_confirmar_estado`, que se lee agregada
con `fn_estado_lugares`. La tabla `estado_lugar` no la lee nadie —dice dónde
ha estado una persona y cuándo—, así que todo pasa por esas dos funciones.

- **Pide cuenta**, como guardar: el freno de un minuto y el contador van por
  `device_id`, y en un navegador un id anónimo no se puede llevar a ninguna
  parte. Se manda el id de la cuenta, así que la web cuenta a la persona.
- **La ubicación no se pide al abrir la ficha.** Si ya está concedida se lee en
  silencio; si no, se pide **al contestar**. Los mismos 150 m y la misma
  ventana de 2 h que la app: contestar desde lejos no pinta el estado de nadie,
  vale para deducir horarios, y se dice «Gracias» en vez de dejar la pregunta.
- **No hay línea «Debería estar abierto».** La app la saca de `opening_hours`;
  interpretar ese campo (rangos, festivos, `Mo-Fr 09:00-14:00,17:00-20:30`)
  pide un analizador entero, y uno a medias diría que un bar abre el 25 de
  diciembre. El horario crudo ya sale en los datos de la ficha.
- `SIN_PUERTA` está copiada de `PlaceTypes.sinPuerta`: a un mirador o una
  plaza no se le pregunta, se dice «Siempre accesible». Los parques **no**
  están en esa lista, y es a propósito.

## El tiempo y el aire (`explorar/tiempo.js`)

Lo mismo que la app en su portada, con las mismas URL de Open-Meteo (sin clave
y sin coste, por eso se llaman desde el navegador), las mismas descripciones
WMO, los mismos niveles de aire y la misma atribución.

- **La ubicación no se pide por esto**: si ya está concedida, el tiempo es el
  de donde estás; si no, el del centro de Sevilla.
- **Iconos dibujados con SVG, no emojis**, que es lo que hizo la app el
  18-oct-2026. Los pinta `svgIcono` con círculos y líneas.
- Los colores del aire tienen pareja clara y oscura: el amarillo de Material
  (#FFEB3B) da 1,1:1 sobre blanco. Es la misma conclusión que `_colorEscala`
  en la app.

## `/perfil/`: perfiles dentro del dominio principal

El cuadro de honor enlaza a `/perfil/?n=<nombre>`, que lee únicamente los datos
públicos de `fn_perfil_publico` y `fn_rutas_de_usuario`. La página usa la copia
autohospedada de Supabase y mantiene `noindex`, porque todos los nombres pasan
por un único HTML con parámetro.

Los enlaces antiguos `sevitime.github.io/perfil/` y `sevitime.github.io/ruta/`
siguen existiendo y no se redirigen: son App Links compartidos por versiones
publicadas de la app y su dominio conserva `/.well-known/assetlinks.json`.

## Noticias (`/noticias/`)

La web **no** puede leer los canales RSS de los medios: ninguno de los tres
permite CORS (comprobado el 2-nov-2026). Las recoge **`sync-noticias`**, una
función del repo de la app, cada dos horas, y las deja en la tabla `noticias`,
que ya era de lectura pública con `activa = true`. Esta página solo lee esa
tabla, así que la web y la app enseñan lo mismo.

- **En marcha desde el 2-nov-2026**: la función está desplegada y el cron
  (`sync-noticias-2h`) la llama a y cuarto de cada dos horas. Si la página
  apareciera vacía, mirar ahí antes que aquí:
  `select status_code, left(content,300) from net._http_response order by id desc limit 3;`
- Titular, extracto corto y enlace al medio. **El cuerpo de la noticia no se
  copia ni se aloja**: es el modelo de agregador defendible (art. 15 DSM /
  RD-ley 24/2021). Todo se pinta con `textContent`.
- Las fotos son de los medios y van con `referrer-policy: no-referrer`; si una
  no carga, se quita y la noticia se queda igual.

## Transporte (`/transporte/`)

Las mismas tres fuentes que la app y **llamadas desde el propio navegador**,
porque las tres permiten CORS (`access-control-allow-origin: *`): no hace falta
ningún intermediario nuestro.

- **Tussam y Metro**: capas públicas de ArcGIS del portal de datos abiertos del
  Ayuntamiento. ArcGIS devuelve **una fila por línea y parada**, así que hay
  que agrupar por `Nodo` o la misma parada sale cinco veces.
- **Sevici**: CityBikes devuelve la red entera en una llamada, y la distancia
  se calcula aquí. Los nombres vienen con un prefijo de id y guion bajo
  (`123_PLAZA…`, `_PLAZA DE LA CONCORDIA`): se limpia igual que en la app.
- **Los colores de las líneas son los oficiales de Tussam**, copiados de
  `TussamService._coloresLineas`. Si cambian allí, hay que traerlos.
- **Esta página sí pide la ubicación**, y es la única que lo hace al entrar
  cuando ya está concedida: sin ella no hay nada que enseñar. Que esos
  terceros reciban tu posición aproximada está dicho en la política.
- **Falta el Consorcio (CTAN)**, los interurbanos. Su API también permite CORS,
  así que es trabajo pendiente y no un imposible.
- `.ubicacion-caja`, `.btn-ubicacion` y `.aviso-ubicacion` se mudaron del
  `<style>` de Explorar a `estilo.css` al haber dos páginas que los usan.

## Seguir a alguien (`perfil/seguir.js`) y el buzón (`/buzon/`)

Las dos cosas con **las mismas funciones que la app y sin SQL nuevo**:
`fn_seguir`, `fn_dejar_de_seguir`, `fn_a_quien_sigo` y `fn_mi_perfil` para el
botón; `fn_mis_mensajes`, `fn_marcar_mensajes_leidos` y `fn_borrar_mensaje`
para el buzón. Las dos piden cuenta.

- **Seguir** sirve para algo más que el contador: cuando alguien a quien sigues
  publica una ruta el servidor manda un aviso, y desde los avisos en la web eso
  también llega aquí. El servidor devuelve `false` —no un error— cuando no hay
  a quién seguir (nombre que ya no existe, uno mismo, o alguien fuera del
  cuadro de honor): eso se dice como «No se puede seguir a este perfil», no
  como fallo de red. Tu propio perfil no lleva botón, y para saberlo hace falta
  `fn_mi_perfil`: el nombre público **no** está en el usuario de Supabase.
- **`/perfil/` ahora carga `auth.js`**, y `perfil.js` usa `window.SEVI.sb` en
  vez de crear su propio cliente: dos clientes en la misma página se pelean por
  el almacén de la sesión.
- **El buzón** marca los mensajes como leídos al abrirlo, como la app. Con
  sesión, `p_device_id` va en `null` y el servidor usa `auth.uid()`. No es
  mensajería entre usuarios, y eso lo dice la propia página.
- **El enlace del buzón lo pone `nav.js`** en el menú de todas las páginas: son
  catorce ficheros y el enlace es siempre el mismo.

## `/rutas/?id=`: el enlace de una ruta

Desde el 11-oct-2026 cada ruta tiene dirección propia dentro de la web:
`/rutas/?id=<id>` abre la página de Rutas con esa ruta desplegada, también en
el móvil. Es adonde llevan las rutas de un perfil (antes iban a
`sevitime.github.io/ruta/`) y lo que copia el botón «Compartir». La barra de
direcciones, el título y el `canonical` siguen a la ruta que abre la persona;
la que la página abre sola en pantalla grande no los toca, para que `/rutas/`
siga siendo `/rutas/`.

**El reparto con y sin sesión es el de la app, y hay que mantenerlo igual en
los dos sitios** (lo pidió el usuario: la web tiene que funcionar como la app
en lo que se pueda, y entrar con Google tiene que seguir teniendo premio):
mirar es libre —sitios, fichas, rutas, eventos, perfiles—; participar pide
cuenta —«Me ha servido», valorar, crear una ruta, proponer un evento, sugerir
o corregir un sitio—. Al pulsar algo que pide cuenta sin tenerla no se hace
nada: se dice «Inicia sesión para…» con el acceso a mano.

«Me ha servido» escribe en `rutas_utiles` igual que la app (la RLS impide
marcar la propia). El acceso con Google vuelve a `/rutas/` a secas, así que la
ruta abierta se guarda en `sessionStorage` y se reabre a la vuelta.

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

**Datos propios permanentes:** `lugares.js` lee `datos_lugares` además de las
altas activas. Completa los campos aprobados de las fichas OSM existentes sin
crear pines nuevos. Los datos sobreviven a retirar el alta manual. Compara id
OSM y nombre cuando hay vínculo; sin vínculo, nombre y proximidad. Conserva
las coordenadas OSM que identifican las reseñas. La moderación sigue en el
panel de la app y requiere cuenta. Las fotos solo pasan a la web si el alta de
origen conserva permiso explícito para esa URL. Pruebas:
`tool/datos_lugares.test.mjs`.

**Datos curados:** tanto la app como la ficha emergente de la pantalla unificada leen
`curated_places` (descripción, foto, horario verificado, etiquetas y
recomendación editorial). La web los pide solo al abrir un sitio y conserva la
respuesta durante la visita, para no retrasar la carga del mapa. Una foto de
usuario solo se muestra en la web con permiso registrado para app y web, sin
publicar el nombre de quien la aportó; las fotos externas requieren autor,
fuente y licencia conforme a sus condiciones. Las filas antiguas sin alcance
verificado no se muestran como foto curada. Lo mismo con las fotos de Wikimedia
Commons de `lugar_destacado`: sin `foto_credito` del que se puedan sacar autor
y licencia, la web no publica la foto, aunque la app sí la siga enseñando. El
formato es `Autor · <licencia> · Wikimedia Commons`, con `CC BY 4.0`,
`CC BY-SA 3.0 es`, `CC0` o `Dominio público` como licencia. Las de CC0 y
dominio público no obligan a atribuir, pero se acreditan igual: publicar una
foto sin decir de quién es no se arregla porque la licencia lo permita.

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

## «Hoy en Sevilla» en la portada (`diario.js`)

El plan del día según el tiempo, la curiosidad del día y el sitio del día,
los mismos que la app. Se pintan en
`<div id="hueco-diario">` de `index.html`; si la red falla o no hay nada para
hoy, el hueco se queda vacío y la portada sigue igual.

**Lo delicado es CÓMO se elige, no de dónde se lee.** Las dos tablas
(`efemerides`, `lugar_destacado`) ya eran de lectura pública, así que esto no
pidió SQL ni permisos. Lo que hubo que traducir de la app:

- La curiosidad va por `month_day` de **hoy en Sevilla** (`Europe/Madrid`),
  no en la hora del aparato.
- El sitio: si alguno tiene `fecha_forzada` de hoy o una `fiesta_movil` que
  cae hoy, ese; si no, `lista[día del año % total]` con la lista ordenada por
  `id`. Es `LugarDestacadoService._resolver`.
- El plan: la condición sale del tiempo (`fraseDelDia` de
  `weather_widgets.dart`, y el orden de los casos importa) y la frase de
  dentro, por día del año y franja de ocho horas (`plan_del_dia.dart`). El
  tiempo es el del **centro de Sevilla**: no se pide la ubicación por esto.
- **Tres copias que hay que mantener a la vez con el repo de la app**: el
  algoritmo de Pascua (`lib/utils/fiestas_moviles.dart`) y el slug de la
  efeméride (`lib/utils/efemeride_ref.dart`, que es de donde cuelgan los
  vídeos) y la elección de la frase-plan. Están en la tabla de
  `docs/paridad_app_web.md`.

### Interurbanos del Consorcio en `/transporte/` (3-nov-2026)

`api.ctan.es` **permite CORS**, así que se lee desde el navegador sin
función de servidor. Sirve las 1.147 paradas de una vez (255 KB): se bajan
una sola vez, se recortan a lo que se usa y se guardan 7 días en
`localStorage` (`sevi-ctan-paradas-v1`), igual que hace la app en
`ctat_service.dart`. El radio son **3 km**, no los 700 m del resto: una
parada interurbana sirve a un pueblo entero.

Las salidas se piden solo de las paradas que se van a enseñar. La API
devuelve **únicamente la hora siguiente**, así que de madrugada vuelve
vacía y eso no es un fallo: se dice «Sin salidas en la próxima hora».

**Fotos.** Ni la del sitio ni la de la curiosidad se publican sin
`foto_credito`. Una regla sola para las dos. La de la efeméride se resolvió
en el servidor el 2-nov-2026 (`tool/fotos_efemerides.mjs` en el repo de la
app): 232 con foto, 131 de ellas bajo CC BY o CC BY-SA. Aquí **solo se lee
lo guardado**, nunca se pregunta a Wikipedia desde el navegador. **Vídeos**: enlace a YouTube, jamás incrustado, que es un tercero.

## El manifiesto declara la app de Play (`related_applications`)

Desde el 3-nov-2026 `manifest.webmanifest` lleva:

```json
"related_applications": [{ "platform": "play", "id": "com.selu.sevitime", … }],
"prefer_related_applications": true
```

**Por qué.** En Android existe la app de Play y es mejor que la web instalada:
los avisos no dependen de que el sistema no limpie el almacenamiento, se
actualiza sola y aparece en la tienda. Con esto, Chrome en Android deja de
ofrecer la instalación de la web y la gente va a Play, que es donde debe ir.
Es además lo que recomienda la propia documentación de Chrome cuando hay app
nativa.

**En iPhone no cambia nada**, que es lo importante: Safari ignora este campo
y la instalación allí la hace la persona a mano desde Compartir (o desde el
menú ⋯ en Chrome de iOS). La vía de iPhone sigue intacta, porque allí no hay
app y es la única forma de tenerla.

El `id` tiene que ser el `applicationId` real del `build.gradle.kts` de la
app (`com.selu.sevitime`): si no coincide, Chrome no lo relaciona con nada.

## La cabecera de las pantallas (`.cabecera-app`)

Explorar, Rutas, Eventos, Guardados, Noticias y Transporte abren con una
**franja verde agua con el título y el subtítulo**, como `screen_header` en
Flutter. Es lo que más hacía que la web se leyera como una web y no como la
app: arriba había logo, hamburguesa y un botón enorme de entrar, y en la app
hay una banda con el nombre de la pantalla.

- Va **fuera de `<main>`**, justo detrás de `</nav>`, para ocupar el ancho de
  la pantalla sin trucos de `100vw` (que en escritorio se comen la barra de
  desplazamiento).
- En Rutas y Eventos lleva además `rutas-ancho`, porque su contenido es más
  ancho que los 760 px del resto.
- Los botones de acción (**Crear una ruta**, **Proponer un evento**) van
  **debajo** de la banda, no dentro: primero la cabecera y luego las
  acciones, como en la app.

También de ese día: la caja de la ubicación de Explorar dejó de ser una
tarjeta con párrafo y pasó a ser solo el botón —la web se explicaba y la app
enseña—, y el aviso de instalar añade `con-aviso-instalar` al `<body>` para
que la página le reserve sitio abajo en vez de tapar la fila de filtros.

## Móvil primero, en todo el sitio

Criterio acordado el 3-nov-2026: **la web se diseña primero para el móvil**,
porque es donde se usa y porque en iPhone la web ES la app. Escritorio
después. Lo que eso significa en la práctica, y que ya está hecho en parte:

- Las pantallas que comparte con la app abren con su **cabecera verde agua**
  (`.cabecera-app`) y llevan la **barra de abajo** con los cinco destinos.
- **Nada flotante se esconde tras esa barra**: hay una regla en `estilo.css`
  que sube el botón de «Añadir lugar», los avisos y las tostadas usando
  `--alto-barra`, con 0 de reserva para escritorio y `/mapa/`.
- **En `/mapa/` manda el mapa**: ocupa la pantalla entera y los controles
  flotan encima, sin banda opaca. La barra lleva fondo transparente y cada
  pieza (icono, menú, acceso, buscador, botón) su propia sombra. En
  escritorio sigue siendo una barra de cristal normal.
- Las preguntas cortas se hacen con una **hoja de abajo** (`.hoja`), no con
  un `confirm` ni con un aviso sin salida: sube desde abajo en móvil y se
  centra en pantalla ancha.
- La web **no se explica**: donde la app enseña contenido, la web no pone un
  párrafo de presentación. Si hay que pedir algo (la ubicación), es un botón.

La portada (`/`) es la excepción: es página de aterrizaje para quien llega de
fuera y su trabajo es convencer, no parecerse a la app.

## `/ajustes/` (3-nov-2026)

El engranaje que la web no tenía. Quien viene de Android lo busca y antes no
estaba: las piezas vivían repartidas —los avisos sueltos **dentro de
Guardados**, que es donde menos lógico resulta buscarlos; cerrar sesión en el
menú de la cuenta; privacidad en el pie—.

Reúne lo mismo que `settings_screen.dart`, con lo que tiene sentido en web:

- **Avisos**: la tarjeta de `avisos.js`, que se **mudó** aquí desde Guardados
  (no se duplicó: dos interruptores para lo mismo acaban discrepando).
- **Tu cuenta**: con quién has entrado, enlace a tu perfil y cerrar sesión.
  Sin sesión no se esconde, explica para qué sirve entrar.
- **Privacidad** y **SeviTime**: enlaces a lo que ya existía.

No lleva apariencia: la web sigue el tema del sistema y no hay interruptor
que ofrecer. Va con `noindex` y fuera del sitemap, como Guardados y el buzón:
es una página personal y no hay nada que buscar en ella.

**Pendiente menor:** `/ajustes/` no está en la lista blanca de
`fn_web_visita`, así que sus visitas caen en «otra». Se arregla cuando toque
otro SQL.

## Sugerir un sitio: `/sugerir.js` (3-nov-2026)

«Añadir lugar» en Explorar **ya no te saca al mapa**. En la app pulsas y se
abre el formulario ahí mismo, sobre la lista; la web hacía un rodeo por
`/mapa/?modo=sugerir` que además cargaba 600 KB de librería de mapas para
rellenar cuatro campos.

**Dos presentaciones, una sola lógica.** En el mapa el panel tiene que
convivir con el mapa (el pin se arrastra mientras está abierto), así que no
puede ser la misma hoja modal. Lo que **sí** es común vive en `/sugerir.js`:
los tipos que se ofrecen, la validación, el aviso de posible duplicado (25 m,
con los de nombre parecido primero), el `device_id` con el que se firma y el
INSERT en `sugerencias`. Dos formularios escribiendo en la misma tabla
acabarían comportándose distinto, y eso es lo que no puede pasar.

- `/mapa/` lo carga **sin `defer`**: su script va en línea y se ejecuta antes
  que los diferidos.
- El `device_id` sigue usando la clave `sevitime_device_id`, la de siempre; no
  se cambió para no partir en dos lo aportado por quien lleva tiempo
  sugiriendo sin cuenta.

## La barra de abajo es la de la app

Explorar · Transporte · Eventos · Noticias · Rutas, en ese orden
(`main_scaffold.dart`). Antes llevaba Mapa y Guardados, que en la app **no
son pestañas**: el mapa se abre desde Explorar y los guardados viven tras el
avatar. Si la barra es lo que hace que la web se lea como la app, llevar
otros cinco la delata. Los dos siguen detrás del avatar.

## La cabecera del móvil, sin hamburguesa (5-nov-2026)

En el móvil **no hay menú de hamburguesa**: en la app no existe, y era lo que
más la delataba. Lo monta `nav.js` y hay tres casos, con una clase en `<html>`
para cada uno. Las clases se ponen **después** de mover el DOM, nunca antes:
si la mudanza no ocurre, el CSS de «esto es la app» no debe alcanzar a esa
pantalla.

| Pantallas | Clase | Qué se ve arriba |
|---|---|---|
| Las que tienen `.cabecera-app` (Explorar, Eventos, Rutas, Noticias, Transporte, Guardados, Ajustes, Qué pasa…) | `como-app` | La franja blanca desaparece; el título comparte fila con el buzón y tu avatar |
| Las de segundo nivel sin cabecera verde (buzón, cuadro de honor, lugar, perfil, sitios, crear ruta, encuentro) | `como-app-barra` + `como-app-acciones` | Se queda la franja, pero con **flecha de volver** en vez del logotipo, y buzón + avatar en vez del ☰ |
| La portada | `como-app-acciones` | **La marca se queda** (es la página de aterrizaje); se van el ☰ y la cápsula de la cuenta |
| `/mapa/` | ninguna | Intacto: es el mapa a pantalla completa, con su propia fila flotante |

- **El avatar abre una hoja de abajo** con «Tu perfil» primero y después
  Guardados, Cuadro de honor, Ajustes, Qué pasa, Mapa, Añadir o corregir e
  Inicio. Las cinco pestañas de la barra de abajo no se repiten ahí, ni el
  enlace a la pantalla en la que ya estás.
- **`#auth-seccion` se MUEVE dentro de la hoja**, no se duplica: `auth.js` lo
  busca por id y lo repinta al entrar y al salir. Ojo al orden: montar la
  hoja se lleva ese nodo, así que un `insertBefore(..., auth)` posterior sobre
  la barra lanza `NotFoundError` y deja la pantalla a medias.
- **Los destinos secundarios se inyectan desde una sola lista** en `nav.js`.
  Antes cada página escribía la suya y no coincidían: en el cuadro de honor
  el menú tenía tres enlaces y en Explorar siete.
- La flecha de volver es un **enlace de verdad** (a `/explorar/`), y solo hace
  `history.back()` si vienes de dentro de la web.

## `/tu-perfil/` y «Lo tuyo» (5-nov-2026)

La gemela de `tu_perfil_screen.dart`, que es lo que la app abre al tocar el
avatar. Hasta ese día en la web no existía: detrás del avatar solo había
Guardados y Salir, así que **Mis reseñas, Mis rutas y Mis aportaciones no se
podían ver desde un iPhone de ninguna manera**. Era el hueco más grande que
quedaba entre las dos.

- `/tu-perfil/` — tarjeta de nivel + accesos. Los números salen de
  **`fn_mis_puntos`**, la misma función que usa la app
  (`ContribucionesService`): nivel, título, puesto en el cuadro de honor y
  cuánto falta para el siguiente. **Nada se calcula en el cliente**, para que
  la web y la app no puedan decir cosas distintas.
- `/mis-resenas/` — lee la tabla `resenas` filtrada por tu `user_id`, que es
  lo que deja ver la política `resenas_leer_propia`. No hace falta función de
  servidor. Lo que importa es el **estado**: pendiente, publicada o no
  publicada con su motivo.
- `/mis-rutas/` — **`fn_mis_rutas`**, que incluye las pendientes y las
  rechazadas (las que `fn_rutas_publicas` no enseña). Solo las publicadas
  llevan enlace: una ruta en revisión no tiene página todavía.
- `/mis-aportaciones/` — **`fn_mis_aportaciones(p_device_id)`**, con el
  `auth.uid()` como `device_id`, igual que la app.

**Las palabras están copiadas de `lib/utils/aportaciones_labels.dart` una por
una, y son decisiones:** `enviado` se llama **Publicada** (a quien lo mandó le
importa que su dato esté, no el papeleo con OSM) y `descartado` se llama **No
se pudo aplicar** y nunca «Rechazada», que suena a suspenso y casi siempre es
que el dato no se pudo confirmar. Si cambian en la app, cambian aquí.

Las cuatro páginas llevan `noindex` y no van al sitemap: son personales.

## `/pasaporte/` (5-nov-2026)

La gemela de `PassportScreen`. Lee `passport_stamps`, la misma tabla que
sincroniza la app: un sello conseguido en el móvil sale aquí y al revés.

- **El catálogo se genera, no se copia**: `node tool/actualizar_sellos.mjs`
  lee `lib/services/passport_service.dart` del repo de la app y escribe
  `pasaporte/sellos.js`. Mismo patrón que `actualizar_categorias.mjs`. Si se
  añade un sello en la app, se regenera y ya.
- **Los iconos son los del móvil, no emoji.** Los trazados están en
  `tool/sellos_svg.json`, sacados una vez de `MaterialIcons-Regular.otf` del
  SDK de Flutter (Apache 2.0) con fontTools: codepoint de cada
  `Icons.*_rounded` en `icons.dart`, contorno del glifo, escalado a 24×24 con
  el eje Y dado la vuelta. En Rutas la web sí usa emoji, pero allí son doce;
  aquí son veinticinco en una rejilla y una rejilla de emoji junto a unos
  candados no se lee como un pasaporte. Un sello sin trazado cae en el icono
  de monumento, como en la app.
- Los conseguidos van **delante** y los que faltan detrás con su candado y su
  pista, como en la app.

**Sellar se hace en la ficha** (`lugar/sellar.js`), con las reglas de
`detail_screen.dart` portadas tal cual: menos de **30 m** del sitio, menos de
**20 km/h** (un sello no se consigue desde el coche; si el navegador no da
velocidad se toma 0, como la app cuando no hay última posición) y sesión
iniciada, que un sello sin cuenta se quedaría en ese navegador. Qué sello da
cada sitio lo decide `stampForPlace` portado: familia turística + dentro del
radio de un monumento → ese monumento (el más cercano si cae en dos: la
Giralda y la Catedral están a 61 m); si no, el genérico de su tipo. Solo la
distancia no vale: la Cervecería Giralda está a cuarenta metros de la
Giralda y es un bar.

**La diferencia con la app, a propósito:** la app mira tu posición sola al
abrir la ficha y enseña el botón si estás cerca. La web **no pide la
ubicación hasta que pulsas**, porque un aviso de permiso que salta solo en
cada ficha es lo que hace que la gente diga que no para siempre, y entonces
no funciona ni esto ni «lo que tengo cerca». Un sitio que no da ningún sello
no pinta la sección.

La tabla tiene `UNIQUE (user_id, stamp_id)` y aquí se hace `upsert`, como la
app: cada sello, una vez.

## `/cronologia/` — «Qué pasa» (3-nov-2026)

Lo que va pasando en SeviTime, con nombre: las reseñas de la gente, sus
fotos y los sitios que añaden, en orden de fecha. Es lo mismo que ya está
repartido por las fichas, junto, para que al abrirlo se note que esto lo
mueve gente.

**Lo que decide qué sale está en el servidor** (`fn_cronologia`), no en el
navegador: solo lo aprobado, solo quien tiene apodo y solo quien no ha
pedido salirse de las listas públicas (`perfiles.en_ranking`, el interruptor
de «Salir en el cuadro de honor»: quien dijo que no quiere figurar entre
quienes aportan, tampoco figura aquí).

**No entra «¿Está abierto?»**: hoy esa respuesta es anónima de cara al
resto, y sacarla con nombre sería cambiarle las reglas a quien ya la usó.
**Y no se puede etiquetar a nadie**, a propósito: que una persona publique
dónde estuvo otra es dato de un tercero.

**Trampa de los avatares:** la mayoría no son URLs sino `preset:<id>`, uno de
los doce dibujos de la app. Pintarlos como imagen da
`ERR_UNKNOWN_URL_SCHEME` y deja el hueco en blanco. Las tablas de color y
emoji están duplicadas con `perfil/perfil.js`.

### La tira «Qué pasa» en Explorar

Las **tres últimas** entradas, con enlace a la cronología entera y al cuadro
de honor —que estaba escondido tras Tu perfil—. Lo común con la pantalla
grande (avatares, fechas, la línea «X ha reseñado Y») vive en
`cronologia/comun.js`: son dos presentaciones de lo mismo.

**Por qué una tira y no la cronología entera arriba del todo.** Medido el
3-nov-2026: **siete entradas en catorce días, nueve días a cero**. Una
pantalla de novedades que enseña lo mismo tres días seguidos dice «aquí no
hay nadie», y eso es peor que no tenerla. Tres líneas con su «hace 3 días»
envejecen bien; una pantalla vacía, no. **Se revisa cuando haya cinco o más
entradas al día sostenidas**: ahí se gana el primer puesto, o una pestaña.

Y por eso tampoco se quitó el tiempo para hacerle sitio: se usa a diario,
ocupa una línea y de él sale la frase del plan del día.
