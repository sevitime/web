/* Service worker de sevitime.com.
 *
 * Existe por una sola razón: la web instalada en la pantalla de inicio tiene
 * que abrir sin conexión en vez de dar la página de error del navegador. No
 * es una app offline —los sitios, los eventos y las rutas vienen de Supabase
 * y sin red no hay datos—, así que lo que se guarda es el armazón: la página
 * de «sin conexión», los estilos, la tipografía y los iconos.
 *
 * **Convive con el versionado por dirección** (`?v=<hash>`, ver
 * `tool/versionar.mjs`), que es lo que garantiza que tras publicar no se
 * pinte con el CSS viejo. La regla que lo hace posible:
 *
 * - Lo que lleva `?v=` se guarda y se sirve de la caché sin preguntar: su
 *   dirección cambia cuando cambia el fichero, así que una copia guardada
 *   nunca puede estar desfasada. Lo mismo con `/fuentes/` y `/libs/`, que no
 *   se versionan porque no cambian; si alguna vez cambian, hay que subir
 *   `VERSION` aquí para que se tiren las copias viejas.
 * - **El HTML nunca se sirve de la caché habiendo red.** Siempre se pide a la
 *   vez a la red, y la copia guardada solo entra si la red falla. Publicar
 *   sigue viéndose al instante.
 *
 * Lo que este fichero NO toca, y es a propósito:
 *
 * - `/tiles/`: son 30 MB de mapa que se piden por rangos de bytes. Un service
 *   worker en medio de una petición con `Range` es la forma más rápida de
 *   romper el mapa (ver el 416 de GitHub Pages del 2-nov-2026).
 * - `/admin/`: es una app Flutter con su propio service worker.
 * - Cualquier dominio que no sea este: Supabase, MapTiler, Google.
 */

var VERSION = 'v1';
var ARMAZON = 'sevitime-armazon-' + VERSION;
var USO = 'sevitime-uso-' + VERSION;
var SIN_CONEXION = '/sin-conexion.html';

// Cuántas respuestas se guardan como máximo en la caché de uso. Sin tope, una
// tarde paseando por fichas de sitios llena el almacén de fotos.
var TOPE_USO = 80;

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(ARMAZON)
      .then(function (cache) { return cache.add(new Request(SIN_CONEXION, { cache: 'reload' })); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(nombres.map(function (nombre) {
        var nuestra = nombre.indexOf('sevitime-') === 0;
        if (nuestra && nombre !== ARMAZON && nombre !== USO) return caches.delete(nombre);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Avisar a la página de que hay una versión nueva esperando no hace falta:
// `skipWaiting` + `clients.claim` la ponen en marcha en cuanto se activa.
self.addEventListener('message', function (evento) {
  if (evento.data === 'saltar-espera') self.skipWaiting();
});

function guardar(nombre, peticion, respuesta) {
  if (!respuesta || !respuesta.ok || respuesta.type === 'opaque') return respuesta;
  var copia = respuesta.clone();
  caches.open(nombre).then(function (cache) {
    return cache.put(peticion, copia).then(function () {
      if (nombre !== USO) return null;
      return cache.keys().then(function (claves) {
        if (claves.length <= TOPE_USO) return null;
        return Promise.all(
          claves.slice(0, claves.length - TOPE_USO).map(function (c) { return cache.delete(c); })
        );
      });
    });
  }).catch(function () { /* el almacén lleno no es motivo de error */ });
  return respuesta;
}

// Lo que lleva `?v=` o vive en `libs/`: primero la caché, y si no está, la red.
function primeroLaCache(peticion) {
  return caches.match(peticion).then(function (guardada) {
    if (guardada) return guardada;
    return fetch(peticion).then(function (respuesta) {
      return guardar(USO, peticion, respuesta);
    });
  });
}

// Páginas: primero la red, y la copia guardada solo como red de seguridad.
function primeroLaRed(peticion) {
  return fetch(peticion).then(function (respuesta) {
    return guardar(USO, peticion, respuesta);
  }).catch(function () {
    return caches.match(peticion).then(function (guardada) {
      return guardada || caches.match(SIN_CONEXION).then(function (aviso) {
        return aviso || new Response(
          'Sin conexión.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
      });
    });
  });
}

self.addEventListener('fetch', function (evento) {
  var peticion = evento.request;
  if (peticion.method !== 'GET') return;
  // Las peticiones por rango (el mapa, los vídeos) se dejan pasar enteras.
  if (peticion.headers.has('range')) return;

  var url;
  try { url = new URL(peticion.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/tiles/') === 0) return;
  if (url.pathname.indexOf('/admin/') === 0) return;

  var versionada = url.searchParams.has('v') || url.pathname.indexOf('/libs/') === 0 ||
    url.pathname.indexOf('/fuentes/') === 0;

  if (peticion.mode === 'navigate') {
    evento.respondWith(primeroLaRed(peticion));
    return;
  }
  if (versionada) {
    evento.respondWith(primeroLaCache(peticion));
  }
  // Todo lo demás —las fotos de los sitios, el sitemap, lo que sea— va a la
  // red tal cual: no se guarda nada que no sepamos que es inmutable.
});
