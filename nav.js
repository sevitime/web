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

// ── La barra de abajo, como en la app ─────────────────────────────────────
//
// En el móvil la web navegaba con una barra arriba y un menú de hamburguesa:
// aspecto de web. La app lleva pestañas abajo, y es lo que más diferencia
// «parece una web» de «parece una app», sobre todo instalada en la pantalla
// de inicio, donde no hay barra de direcciones que lo recuerde.
//
// Decisiones:
//
// - **Cinco destinos, los que la web tiene de verdad**: Explorar, Mapa,
//   Rutas, Eventos y Guardados. Los iconos son los de la app donde existe el
//   equivalente (Rutas lleva el mapa plegado, como `Icons.map_rounded`).
// - **No sale en `/mapa/`**: esa página es el mapa a pantalla completa, con su
//   propia hoja abajo y los controles de MapLibre en esa esquina. En la app el
//   mapa también se come la pantalla.
// - **La barra la pone el script, pero no se depende de ella**: los mismos
//   enlaces están en el HTML de la barra de arriba, que no se toca.
// - Solo se ve en pantalla estrecha (`estilo.css`, 719 px); en escritorio la
//   navegación de arriba es la buena.
(function () {
  if (location.pathname.indexOf('/mapa/') === 0) return;
  if (location.pathname.indexOf('/admin/') === 0) return;

  var destinos = [
    ['/explorar/', 'Explorar', 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z'],
    ['/mapa/', 'Mapa', 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'],
    ['/rutas/', 'Rutas', 'M20.5 3l-.16.03L15 5.1 9 3 3.46 4.84c-.29.1-.46.34-.46.63V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.54-1.84c.29-.1.46-.34.46-.63V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z'],
    ['/eventos/', 'Eventos', 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z'],
    ['/guardados/', 'Guardados', 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z']
  ];

  var barra = document.createElement('nav');
  barra.className = 'barra-abajo';
  barra.setAttribute('aria-label', 'Secciones de SeviTime');

  for (var i = 0; i < destinos.length; i++) {
    var d = destinos[i];
    var enlace = document.createElement('a');
    enlace.className = 'barra-abajo-item';
    enlace.href = d[0];
    // Activa la sección en la que estás, y la portada no activa ninguna.
    if (location.pathname.indexOf(d[0]) === 0) {
      enlace.classList.add('activo');
      enlace.setAttribute('aria-current', 'page');
    }
    enlace.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="' + d[2] + '"/></svg><span>' + d[1] + '</span>';
    barra.appendChild(enlace);
  }

  document.body.appendChild(barra);
  document.documentElement.classList.add('con-barra');
}());

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

// Transporte y Buzón, en el menú de todas las páginas.
//
// Los pone el script y no el HTML de cada página porque son quince ficheros y
// los enlaces son siempre los mismos. Van delante del botón de «Añadir o
// corregir sitios», que es el que cierra el menú. Quien no haya entrado verá
// el buzón pidiéndole cuenta, que es lo honesto: existe, y es suyo en cuanto
// entre.
(function () {
  var menu = document.querySelector('.nav-enlaces');
  if (!menu) return;
  var boton = menu.querySelector('.nav-btn-mapa');

  [['/transporte/', 'Transporte'], ['/buzon/', 'Buz\u00f3n']].forEach(function (d) {
    // En su propia página no se repite el enlace.
    if (location.pathname.indexOf(d[0]) === 0) return;
    if (menu.querySelector('a[href="' + d[0] + '"]')) return;
    var enlace = document.createElement('a');
    enlace.className = 'nav-link';
    enlace.href = d[0];
    enlace.textContent = d[1];
    if (boton) menu.insertBefore(enlace, boton);
    else menu.appendChild(enlace);
  });
}());

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
