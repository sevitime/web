// Navegación compartida: en móvil conserva solo marca, acceso y un botón de
// menú; en escritorio los enlaces se muestran siempre desde CSS.
(function () {
  var acciones = document.querySelector('.nav-acciones');
  if (!acciones) return;

  var boton = acciones.querySelector('.nav-menu-toggle');
  if (!boton) return;

  function cerrar() {
    acciones.classList.remove('menu-abierto');
    boton.setAttribute('aria-expanded', 'false');
  }

  boton.addEventListener('click', function () {
    var abierto = acciones.classList.toggle('menu-abierto');
    boton.setAttribute('aria-expanded', String(abierto));
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      cerrar();
      boton.focus();
    }
  });

  document.addEventListener('click', function (event) {
    if (!acciones.contains(event.target)) cerrar();
  });
}());

// La llegada de una lista: la primera vez que se pinta, sus tarjetas entran
// escalonadas (estilo.css, `.llega`). Solo la primera: Rutas y el cuadro de
// honor repintan la lista entera al filtrar, al elegir una ruta o al entrar
// con Google, y que todo volviera a aparecer en cada toque sería un mareo.
window.SeviLlegada = function (contenedor) {
  if (!contenedor || contenedor.dataset.llego) return;
  contenedor.dataset.llego = '1';
  contenedor.removeAttribute('aria-busy');
  contenedor.classList.add('llega');
  setTimeout(function () { contenedor.classList.remove('llega'); }, 1500);
};

// El service worker, que está solo para que la web añadida a la pantalla de
// inicio abra sin conexión en vez de dar el error del navegador. Lo que
// guarda y lo que no, en `sw.js`. Se registra tras `load` para no competir
// con la primera pintada, y si falla no pasa nada: la web funciona igual.
// `isSecureContext` y no `https:`: así vale también en `localhost`, que es
// donde se prueba.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}

// Quién nos está mirando: lo usan el aviso de instalación y la portada.
//
// El iPad con «solicitar web de escritorio» se presenta como un Mac; lo delata
// que tenga pantalla táctil. En Firefox y Edge de iPhone no existe «Añadir a
// pantalla de inicio», así que se distinguen: no se manda a nadie a buscar un
// botón que su navegador no tiene.
window.SeviIOS = (function () {
  var ua = navigator.userAgent || '';
  var es = /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return {
    es: es,
    chrome: es && /CriOS/.test(ua),
    safari: es && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),
    instalada: navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  };
}());

// ── La portada, cuando quien la abre lleva un iPhone ───────────────────────
//
// Decía «Está para Android, en Google Play» con el badge de la tienda: a un
// iPhone se le ofrecía lo único que no puede instalar. Ahora se le cuenta lo
// que sí puede hacer, que es tenerla igual sin pasar por App Store.
(function () {
  if (!window.SeviIOS.es) return;
  var bloque = document.querySelector('.cierre-iphone');
  if (!bloque) return;

  var enlaceHero = document.querySelector('.hero-iphone');
  var badges = document.querySelectorAll('.badge');
  var textoAndroid = document.querySelector('.cierre-android');

  for (var i = 0; i < badges.length; i++) badges[i].hidden = true;
  if (textoAndroid) textoAndroid.hidden = true;
  if (enlaceHero) enlaceHero.hidden = false;
  bloque.hidden = false;

  // Ya instalada: no se le explica cómo instalar algo que ya tiene.
  if (window.SeviIOS.instalada) {
    bloque.hidden = true;
    if (enlaceHero) enlaceHero.hidden = true;
  }

  if (window.SeviIOS.chrome) {
    var navegador = bloque.querySelector('.paso-navegador');
    var menu = bloque.querySelector('.paso-menu');
    if (navegador) navegador.textContent = 'Chrome';
    if (menu) menu.textContent = 'el men\u00fa \u22ef';
  }
}());

// ── «Añádela a tu pantalla de inicio», solo en iPhone y iPad ───────────────
//
// En Android el navegador ofrece instalarla él solo. En iOS **no lo ofrece
// ningún navegador**: hay que entrar en Compartir → «Añadir a pantalla de
// inicio», y quien no lo sabe no lo encuentra. Este aviso es ese hueco.
//
// Tres cosas deliberadas:
//
// - **No sale en la primera página que se mira.** Mucho del tráfico llega de
//   TikTok y se va en unos segundos; a quien aún no sabe qué es esto no se le
//   pide que se lo instale. Sale a partir de la segunda página.
// - **No sale si ya está instalada** (`display-mode: standalone`, o el
//   `navigator.standalone` de Safari).
// - **Si se cierra, no vuelve.** Un aviso que reaparece es un anuncio.
(function () {
  var CLAVE_PAGINAS = 'sevi-paginas-vistas';
  var CLAVE_CERRADO = 'sevitime-instalar-cerrado';

  function recordar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) { /* modo privado */ }
  }
  function recordado(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }

  if (!window.SeviIOS.es) return;
  var esChrome = window.SeviIOS.chrome;
  var esSafari = window.SeviIOS.safari;
  // En Firefox y Edge de iPhone no existe «Añadir a pantalla de inicio»:
  // contarlo ahí sería mandar a alguien a buscar un botón que no tiene.
  if (!esChrome && !esSafari) return;

  var instalada = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (instalada) return;

  if (recordado(CLAVE_CERRADO)) return;

  var vistas = parseInt(recordado(CLAVE_PAGINAS) || '0', 10) + 1;
  if (isNaN(vistas)) vistas = 1;
  recordar(CLAVE_PAGINAS, String(vistas));
  if (vistas < 2) return;

  function mostrar() {
    var aviso = document.createElement('div');
    aviso.className = 'instalar-ios';
    aviso.setAttribute('role', 'status');

    var texto = document.createElement('p');
    texto.innerHTML = esChrome
      ? 'Ten SeviTime como una app: toca el menú <strong>⋯</strong> y ' +
        'luego <strong>Añadir a pantalla de inicio</strong>.'
      : 'Ten SeviTime como una app: toca <strong>Compartir</strong> y luego ' +
        '<strong>Añadir a pantalla de inicio</strong>.';

    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'instalar-ios-cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar aviso');
    cerrar.textContent = '×';
    cerrar.addEventListener('click', function () {
      aviso.remove();
      recordar(CLAVE_CERRADO, '1');
    });

    aviso.append(texto, cerrar);
    document.body.appendChild(aviso);
  }

  // Un par de segundos después de que la página esté hecha: lo primero que se
  // ve es la web, no un cartel.
  window.addEventListener('load', function () { setTimeout(mostrar, 2000); });
}());
