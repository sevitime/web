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
// - **Los cinco destinos de la app, y en su orden**: Explorar, Transporte,
//   Eventos, Noticias y Rutas (`main_scaffold.dart`). Si la barra de abajo
//   es lo que hace que la web se lea como la app, llevar otros cinco la
//   delata. Antes estaban Mapa y Guardados, que en la app no son pestañas:
//   el mapa se abre desde Explorar y los guardados viven tras el avatar.
//   Los dos siguen en el menú de arriba, que es donde la app los tiene.
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
    ['/transporte/', 'Transporte', 'M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1.5-6H6V6h12v5z'],
    ['/eventos/', 'Eventos', 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z'],
    ['/noticias/', 'Noticias', 'M20 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H4V5h16v14zM6 7h7v2H6V7zm0 4h7v2H6v-2zm0 4h7v2H6v-2zm9-8h3v10h-3V7z'],
    ['/rutas/', 'Rutas', 'M20.5 3l-.16.03L15 5.1 9 3 3.46 4.84c-.29.1-.46.34-.46.63V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.54-1.84c.29-.1.46-.34.46-.63V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z']
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

// Instalada en la pantalla de inicio: entonces esto ES la app, y una app no
// se presenta a sí misma en cada pantalla. Se marca aquí y `estilo.css`
// quita lo que sobra: el logotipo con enlace a la portada —que es el gesto
// más de «web» que hay— y el botón grande de entrar, que pasa a ser
// compacto. La cabecera verde ya dice en qué pantalla estás y la barra de
// abajo lleva a los cinco sitios.
//
// Vale para iPhone y para Android: `display-mode: standalone` lo cumplen las
// dos, y `navigator.standalone` es el apaño que hace falta en iOS.
(function () {
  var instalada = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!instalada) return;
  document.documentElement.classList.add('instalada');

  // El menú y la cuenta se mudan DENTRO de la cabecera verde, a la derecha
  // del título, que es donde los pone la app. Así desaparece la franja
  // blanca de arriba entera: la pantalla empieza por su cabecera, como en
  // el móvil. Se mueven, no se duplican, para que `auth.js` siga pintando
  // en el mismo `#auth-seccion` de siempre.
  function mudar() {
    // Solo en móvil. En un escritorio con la web instalada no hay barra de
    // abajo, así que la navegación de arriba es la única forma de moverse:
    // esconderla dejaba la ventana sin salida. Pasó en la primera versión.
    if (!window.matchMedia || !window.matchMedia('(max-width: 719px)').matches) {
      return;
    }
    var cabecera = document.querySelector('.cabecera-app > div');
    var acciones = document.querySelector('.top-nav .nav-acciones');
    var arriba = document.querySelector('.top-nav');
    if (!cabecera || !acciones || !arriba) return;
    // El título comparte fila con el menú y la cuenta; el subtítulo se queda
    // debajo, a todo lo ancho. Con los tres en la misma fila, «Sevilla y su
    // provincia» se partía en dos líneas.
    var fila = document.createElement('div');
    fila.className = 'cabecera-app-fila';
    var titulo = cabecera.querySelector('h1');
    if (titulo) fila.appendChild(titulo);
    fila.appendChild(acciones);
    cabecera.insertBefore(fila, cabecera.firstChild);
    arriba.hidden = true;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mudar);
  } else {
    mudar();
  }
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

// Noticias, Transporte y Buzón, en el menú de todas las páginas.
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

  [['/noticias/', 'Noticias'], ['/transporte/', 'Transporte'],
   ['/buzon/', 'Buz\u00f3n']].forEach(function (d) {
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

  // El bloque de iPhone ya se ve de serie para todo el mundo. Lo que cambia
  // en un iPhone es el resto: ahí lo de Google Play no sirve de nada.
  for (var i = 0; i < badges.length; i++) badges[i].hidden = true;
  if (textoAndroid) textoAndroid.hidden = true;
  if (enlaceHero) enlaceHero.hidden = false;
  var titulo = bloque.querySelector('.cierre-iphone-titulo');
  if (titulo) titulo.textContent = 'En tu iPhone, sin App Store';

  // Ya instalada: no se le explica cómo instalar algo que ya tiene.
  if (window.SeviIOS.instalada) {
    bloque.hidden = true;
    if (enlaceHero) enlaceHero.hidden = true;
  }

  if (window.SeviIOS.chrome) {
    var navegador = bloque.querySelector('.paso-navegador');
    var menu = bloque.querySelector('.paso-menu');
    var glifo = bloque.querySelector('.glifo-compartir');
    if (navegador) navegador.textContent = 'Chrome';
    // En Chrome de iOS la opción vive dentro de la hoja de compartir, no
    // suelta en el menú: decir solo «el menú ⋯» deja a la persona mirando
    // una lista donde no está lo que busca. Desde iOS 16.4 esto funciona
    // igual que en Safari, y lo que se instala corre como app aparte.
    if (menu) menu.textContent = 'el men\u00fa \u22ef y luego Compartir';
    // El glifo es el de Compartir de Safari: en Chrome no se pulsa eso.
    if (glifo) glifo.remove();
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
      document.body.classList.remove('con-aviso-instalar');
      recordar(CLAVE_CERRADO, '1');
    });

    aviso.append(texto, cerrar);
    document.body.appendChild(aviso);
    // El aviso flota sobre el contenido; sin esto tapaba la fila de filtros
    // de Explorar y no había forma de llegar a ella sin cerrarlo.
    document.body.classList.add('con-aviso-instalar');
  }

  // Un par de segundos después de que la página esté hecha: lo primero que se
  // ve es la web, no un cartel.
  window.addEventListener('load', function () { setTimeout(mostrar, 2000); });
}());
