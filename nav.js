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

// Los destinos secundarios, en el menú de todas las páginas.
//
// Los pone el script y no el HTML de cada página porque son quince ficheros y
// los enlaces son siempre los mismos. Cada página escribía su propia lista y
// no coincidían: en el cuadro de honor el menú tenía tres enlaces y en
// Explorar siete, así que la hoja de «Tu perfil» (más abajo) enseñaba cosas
// distintas según dónde estuvieras. Esta es la única lista.
//
// Van delante del botón de «Añadir o corregir sitios», que es el que cierra
// el menú. Quien no haya entrado verá el buzón o los guardados pidiéndole
// cuenta, que es lo honesto: existen, y son suyos en cuanto entre.
//
// **Tiene que ejecutarse antes del bloque de la cabecera**, que lee este
// menú para montar la hoja.
(function () {
  var menu = document.querySelector('.nav-enlaces');
  if (!menu) return;
  var boton = menu.querySelector('.nav-btn-mapa');

  [['/noticias/', 'Noticias'], ['/transporte/', 'Transporte'],
   ['/cronologia/', 'Qu\u00e9 pasa'], ['/ranking/', 'Cuadro de honor'],
   ['/mapa/', 'Mapa'], ['/guardados/', 'Guardados'],
   ['/ajustes/', 'Ajustes'], ['/buzon/', 'Buz\u00f3n'],
   ['/tu-perfil/', 'Tu perfil'],
   ['/mapa/?modo=colaborar', 'A\u00f1adir o corregir sitios'],
   ['/', 'Inicio']].forEach(function (d) {
    // En su propia página no se repite el enlace. La portada se compara
    // entera: con `indexOf` toda ruta empieza por «/» y no se pondría nunca.
    if (d[0] === '/' ? location.pathname === '/' : location.pathname.indexOf(d[0]) === 0) return;
    if (menu.querySelector('a[href="' + d[0] + '"]')) return;
    var enlace = document.createElement('a');
    enlace.className = 'nav-link';
    enlace.href = d[0];
    enlace.textContent = d[1];
    if (boton) menu.insertBefore(enlace, boton);
    else menu.appendChild(enlace);
  });
}());

// Una sola cabecera en el móvil, y sin hamburguesa: la de la app.
//
// Dos cosas que delataban a la web, arregladas aquí:
//
// 1. **Tres rótulos apilados** (barra del navegador + franja blanca de
//    SeviTime + cabecera verde). Ahora el título, el buzón y el avatar
//    comparten una sola fila y la franja blanca desaparece. Esto se hacía
//    solo con la web instalada, que era la condición equivocada: no depende
//    de haberla instalado, depende de ser un móvil (5-nov-2026).
//
// 2. **El menú de hamburguesa con trece enlaces en fila**, que en la app no
//    existe: allí la cabecera lleva el buzón y el avatar, y detrás del avatar
//    está lo tuyo (`home_screen.dart` → Tu perfil → Guardados, Cuadro de
//    honor, Ajustes). Así que el icono de ☰ se va y el avatar abre una hoja
//    de abajo, que es el gesto de la app.
//
// Las cinco pestañas de abajo no se repiten en la hoja: ya están a un toque.
//
// Nada se vuelve inalcanzable: lo que no es personal (Mapa, Qué pasa,
// Sitios, Añadir o corregir sitios) sigue además en el pie de cada página,
// que es lo que ven los buscadores.
//
// `#auth-seccion` se MUEVE dentro de la hoja, no se duplica: `auth.js` lo
// busca por id y lo repinta al entrar y al salir.
(function () {
  // Las cinco de la barra de abajo, que no se repiten en la hoja.
  var PESTANAS = ['/explorar/', '/transporte/', '/eventos/', '/noticias/', '/rutas/'];

  var ICONO_BUZON = 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z';
  var ICONO_VOLVER = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z';
  var ICONO_PERSONA = 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';

  function icono(path) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" ' +
      'aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  // La hoja se construye una vez y se queda; abrirla es enseñarla. Si se
  // creara en cada toque habría que mudar `#auth-seccion` de ida y de
  // vuelta, y en una de esas `auth.js` repintaría sobre el sitio
  // equivocado.
  function hacerHoja(enlaces, auth) {
    var fondo = document.createElement('div');
    fondo.className = 'hoja-fondo hoja-perfil';
    fondo.style.display = 'none';

    var hoja = document.createElement('div');
    hoja.className = 'hoja';
    hoja.setAttribute('role', 'dialog');
    hoja.setAttribute('aria-modal', 'true');
    hoja.setAttribute('aria-label', 'Tu perfil y más opciones');

    var titulo = document.createElement('h2');
    titulo.textContent = 'Tu perfil';
    hoja.appendChild(titulo);

    if (auth) hoja.appendChild(auth);

    for (var i = 0; i < enlaces.length; i++) {
      var a = document.createElement('a');
      a.className = 'hoja-opcion';
      a.href = enlaces[i].href;
      a.innerHTML = '<strong>' + enlaces[i].texto + '</strong>';
      hoja.appendChild(a);
    }

    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'hoja-cancelar';
    cerrar.textContent = 'Cerrar';
    hoja.appendChild(cerrar);

    fondo.appendChild(hoja);
    document.body.appendChild(fondo);

    function ocultar() {
      fondo.style.display = 'none';
      document.documentElement.classList.remove('hoja-abierta');
    }
    cerrar.addEventListener('click', ocultar);
    fondo.addEventListener('click', function (e) {
      if (e.target === fondo) ocultar();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fondo.style.display !== 'none') ocultar();
    });

    return {
      abrir: function () {
        fondo.style.display = 'flex';
        // Sin esto, el fondo se desplaza por debajo de la hoja.
        document.documentElement.classList.add('hoja-abierta');
        cerrar.focus();
      }
    };
  }

  // Tu foto en el botón, en cuanto `auth.js` la pinte: el avatar es el gesto
  // de la app, y un monigote genérico no lo es. Mientras no haya sesión se
  // queda el monigote, que es lo que la app enseña también.
  function seguirAvatar(auth, boton) {
    if (!auth || !window.MutationObserver) return;
    function mirar() {
      var img = auth.querySelector('.auth-avatar img');
      if (!img || !img.getAttribute('src')) return;
      if (boton.getAttribute('data-foto') === img.getAttribute('src')) return;
      boton.setAttribute('data-foto', img.getAttribute('src'));
      boton.innerHTML = '';
      var mia = document.createElement('img');
      mia.src = img.getAttribute('src');
      mia.alt = '';
      mia.referrerPolicy = 'no-referrer';
      boton.appendChild(mia);
    }
    new MutationObserver(mirar).observe(auth, { childList: true, subtree: true });
    mirar();
  }

  // Los enlaces de la hoja salen del menú de arriba, no de una lista escrita
  // aquí: así cada página sigue decidiendo los suyos y no hay dos verdades
  // que se separen con el tiempo. Fuera las cinco pestañas (están abajo) y
  // el buzón (está al lado del avatar).
  //
  // El orden sí lo pone esto, y es el de la app: primero lo tuyo, que es lo
  // que allí vive detrás del avatar; después el resto; y la portada al final,
  // porque en la app no existe.
  // «Tu perfil» primero: es lo que abre la app al tocar el avatar, y desde
  // ahí se llega a tus reseñas, tus rutas y tus aportaciones.
  var PRIMERO = ['/tu-perfil/', '/guardados/', '/ranking/', '/ajustes/'];

  function leerEnlaces(menu) {
    var enlaces = [];
    var vistos = {};
    var todos = menu.querySelectorAll('a');
    for (var i = 0; i < todos.length; i++) {
      var href = todos[i].getAttribute('href') || '';
      if (PESTANAS.indexOf(href) !== -1 || href.indexOf('/buzon/') === 0) continue;
      // Ni un enlace a la pantalla en la que ya estás. Los inyectados de
      // arriba ya se saltan el suyo, pero el que viene escrito en el HTML de
      // la propia página no: en `/guardados/` la hoja ofrecía «Guardados».
      if (href === location.pathname) continue;
      if (vistos[href]) continue;
      vistos[href] = true;
      enlaces.push({ href: href, texto: (todos[i].textContent || '').trim() });
    }
    return enlaces.sort(function (a, b) {
      return peso(a.href) - peso(b.href);
    });
  }

  function peso(href) {
    var i = PRIMERO.indexOf(href);
    if (i !== -1) return i;
    if (href === '/') return 99;
    return 50;
  }

  // Las pantallas de segundo nivel (el buzón, el cuadro de honor, la ficha de
  // un sitio, un perfil, Sitios, crear ruta, un punto de encuentro) no tienen
  // cabecera verde: en la app son pantallas que se abren **encima**, con
  // flecha de volver arriba a la izquierda. Aquí se quedan con su franja de
  // arriba, pero con los dos gestos de la app en vez de los de una web: el ☰
  // se cambia por el buzón y el avatar, y el logotipo con enlace a la portada
  // se cambia por la flecha de volver.
  function soloQuitarHamburguesa(conVuelta) {
    var acciones = document.querySelector('.top-nav .nav-acciones');
    var menu = document.querySelector('.top-nav .nav-enlaces');
    var dentro = document.querySelector('.top-nav-inner');
    if (!acciones || !menu || !dentro) return;
    // La flecha sustituye a la marca, así que en la portada no va: allí la
    // marca se queda y no hay nada de donde volver.
    if (conVuelta) {
      dentro.insertBefore(hacerVolver(), dentro.firstChild);
      document.documentElement.classList.add('como-app-barra');
    }
    // Con `appendChild` y no `insertBefore(..., auth)`: `hacerBotones` monta la
    // hoja, y montarla se lleva `#auth-seccion` dentro. Pedirle luego a la
    // barra que inserte «antes de» un hijo que ya no es suyo lanzaba
    // NotFoundError, y la clase de abajo no llegaba a ponerse: la hamburguesa
    // seguía ahí y los botones nuevos no se veían.
    acciones.appendChild(hacerBotones(leerEnlaces(menu), 'en-barra'));
    document.documentElement.classList.add('como-app-acciones');
  }

  // El buzón y el avatar, con su hoja detrás. `extra` distingue la cabecera
  // verde de la franja blanca, que llevan colores distintos.
  function hacerBotones(enlaces, extra) {
    var botones = document.createElement('div');
    botones.className = 'cabecera-botones' + (extra ? ' ' + extra : '');

    if (location.pathname.indexOf('/buzon/') !== 0) {
      var buzon = document.createElement('a');
      buzon.className = 'cabecera-icono';
      buzon.href = '/buzon/';
      buzon.title = 'Tu buzón';
      buzon.setAttribute('aria-label', 'Tu buzón');
      buzon.innerHTML = icono(ICONO_BUZON);
      botones.appendChild(buzon);
    }

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'cabecera-avatar';
    boton.title = 'Tu perfil y más opciones';
    boton.setAttribute('aria-label', 'Tu perfil y más opciones');
    boton.innerHTML = icono(ICONO_PERSONA);
    botones.appendChild(boton);

    var auth = document.getElementById('auth-seccion');
    var hoja = hacerHoja(enlaces, auth);
    boton.addEventListener('click', hoja.abrir);
    seguirAvatar(auth, boton);
    return botones;
  }

  // La flecha de volver.
  //
  // Es un enlace de verdad y no un botón: sin JavaScript, o si alguien llega
  // a esta pantalla desde un enlace de fuera, sigue llevando a algún sitio.
  // Con historia propia dentro de la web se prefiere `history.back()`, que es
  // lo que hace la app: deshace el camino que traías, no te manda a una
  // pantalla fija.
  //
  // El destino de reserva es Explorar y no la portada: la portada es la
  // página de aterrizaje, y quien ya está dentro no vuelve a ella.
  function hacerVolver() {
    var a = document.createElement('a');
    a.className = 'cabecera-volver';
    a.href = '/explorar/';
    a.title = 'Volver';
    a.setAttribute('aria-label', 'Volver');
    a.innerHTML = icono(ICONO_VOLVER);
    a.addEventListener('click', function (e) {
      var deAqui = document.referrer &&
        document.referrer.indexOf(location.origin + '/') === 0;
      if (deAqui && history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });
    return a;
  }

  function mudar() {
    // Solo en móvil. En escritorio no hay barra de abajo, así que la
    // navegación de arriba es la única forma de moverse: esconderla dejaba
    // la ventana sin salida. Pasó en la primera versión.
    if (!window.matchMedia || !window.matchMedia('(max-width: 719px)').matches) {
      return;
    }
    // Sin cabecera verde no hay donde mudar nada, y es lo que salva dos
    // pantallas que necesitan la franja de arriba tal cual: la portada, que
    // se presenta a quien aún no conoce la app y por eso lleva su marca, y
    // `/mapa/`, que es el mapa a pantalla completa y no tiene cabecera ni
    // barra abajo. En las dos, esta función se va sin tocar nada.
    var cabecera = document.querySelector('.cabecera-app > div');
    var arriba = document.querySelector('.top-nav');
    var menu = document.querySelector('.top-nav .nav-enlaces');
    if (!arriba || !menu) return;
    if (!cabecera) {
      // `/mapa/` se queda intacto: es el mapa a pantalla completa, con su
      // propia fila flotante y sin barra de abajo.
      if (location.pathname.indexOf('/mapa/') === 0) return;
      // La portada conserva su marca —es la página de aterrizaje y se
      // presenta a quien aún no nos conoce—, pero no la hamburguesa ni la
      // cápsula de la cuenta: con sesión iniciada, en un móvil, la marca, el
      // ☰, tu nombre, «Guardados» y «Panel» no caben en una fila. Se veía la
      // marca tapada por el ☰ y «Panel» saliéndose por la derecha.
      soloQuitarHamburguesa(location.pathname !== '/');
      return;
    }

    // El título comparte fila con el buzón y el avatar; el subtítulo se
    // queda debajo, a todo lo ancho. Con todo en la misma fila, «Sevilla y
    // su provincia» se partía en dos líneas.
    var fila = document.createElement('div');
    fila.className = 'cabecera-app-fila';
    var h1 = cabecera.querySelector('h1');
    if (h1) fila.appendChild(h1);

    fila.appendChild(hacerBotones(leerEnlaces(menu)));
    cabecera.insertBefore(fila, cabecera.firstChild);

    arriba.hidden = true;
    // La clase se pone aquí y no antes: así el CSS de «esto es la app» no
    // alcanza nunca a una pantalla donde la mudanza no ha ocurrido.
    document.documentElement.classList.add('como-app');
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
  // El botón ya se ve para todo el mundo; en un iPhone deja de describir una
  // posibilidad y pasa a ser lo que hay que hacer.
  if (enlaceHero) {
    enlaceHero.hidden = false;
    enlaceHero.textContent = 'A\u00f1\u00e1dela a tu iPhone';
  }
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
