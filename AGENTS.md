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

Con esto la web no habla con ningún tercero para pintar el mapa. Ojo: el nombre
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
