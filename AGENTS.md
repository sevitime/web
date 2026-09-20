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

Las librerías pesadas están **autohospedadas** en `libs/`, no vienen de un CDN
de terceros: `maplibre-gl` 4.7.1, `pmtiles` 3.2.1 y `@supabase/supabase-js`
2.116.0. Los tiles también son propios (Worker de Cloudflare). Al actualizar
una, descarga la versión fijada, guárdala en `libs/` y actualiza esta nota.
Motivo: un CDN de terceros recibe la IP del visitante y obliga a declararlo en
la política de privacidad.

Pendiente (anotado el 21 de septiembre de 2026):

- `mapa/estilo-mapa.js` aún carga las tipografías de las etiquetas del mapa
  desde `fonts.openmaptiles.org` (tercero). Autohospedarlas si se quiere cerrar
  del todo el apartado de terceros.
- La política de privacidad vive en el repo `sevitime/privacidad` y se publica
  en `https://sevitime.github.io/privacidad/`. Es **un solo documento y está
  escrito para la app**; la web enlaza a él pero no se menciona. Conviene
  ampliarlo para cubrir también sevitime.com (login de Google y envíos a
  Supabase) y, si no se autohospedan, los terceros de la web. La app ya declara
  Nominatim, Open-Meteo, Overpass, MapTiler, Wikimedia y Sentry.
