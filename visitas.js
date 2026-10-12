// Contador de visitas de sevitime.com.
//
// Suma uno a (día, ruta) en la tabla `web_visitas` de Supabase y nada más.
// NO guarda identificador de ninguna clase: ni cookie, ni localStorage, ni
// IP, ni huella del navegador. Por eso no hay banner de consentimiento —en
// cuanto se guarda un identificador para contar, la ePrivacy pide permiso—,
// y por eso el número son páginas vistas y no visitantes únicos. Si algún
// día hace falta saber si la gente vuelve, eso pide identificador y banner,
// y es otra decisión.
//
// Va con un `fetch` pelado al endpoint REST, sin cargar supabase-js: la
// librería son 216 KB y `auth.js` se parte en dos justamente para no
// descargarla a quien solo pasa por la portada. Contar visitas no puede
// costar más que la página que cuenta. Son ~1 KB y una petición de 200 bytes
// que no bloquea nada (`defer` + `keepalive`).
//
// Detalle de por qué un script y no una línea en `nav.js`: `privacidad/` no
// carga la navegación compartida y sí queremos contarla.
(function () {
  var URL_RPC = 'https://kdqiwhvtovafugpcrumf.supabase.co/rest/v1/rpc/fn_web_visita';
  var KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';
  var MARCA = 'sevi_no_contar';

  // Solo el sitio de verdad. Las pruebas en localhost o en una vista previa
  // no tienen por qué ensuciar el contador.
  if (window.location.hostname !== 'sevitime.com') return;

  // Los automatismos de navegador (Playwright y compañía) sí dicen quiénes
  // son. Los rastreadores que no ejecutan JavaScript no llegan hasta aquí,
  // que es la ventaja de medir en el navegador y no en el servidor.
  if (navigator.webdriver) return;

  function marcado() {
    try {
      return localStorage.getItem(MARCA) === '1';
    } catch (e) {
      return false; // localStorage bloqueado: cuenta, que es lo normal.
    }
  }

  function marcar() {
    try {
      localStorage.setItem(MARCA, '1');
    } catch (e) {}
  }

  // `sevitime.com/?nocontar=1` deja este navegador fuera del contador para
  // siempre. Es para los administradores: el filtro automático de abajo
  // necesita que hayas entrado con Google al menos una vez en este
  // navegador, y esto vale también en el móvil o en una ventana privada
  // donde no vas a entrar. Un interruptor, no un identificador: guarda un
  // sí, no quién eres.
  if (window.location.search.indexOf('nocontar=1') !== -1) marcar();

  // ¿Hay una sesión de Supabase guardada? Misma comprobación que `auth.js`:
  // la clave es `sb-<ref>-auth-token`.
  function haySesion() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var clave = localStorage.key(i);
        if (clave && clave.indexOf('sb-') === 0 && clave.indexOf('-auth-token') !== -1) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // La ruta, limpia: sin `?id=123` ni `#seccion` —solo qué página, nunca qué
  // sitio ni qué ruta se estaba mirando— y sin `index.html` al final. El
  // servidor la pasa además por lista blanca, así que lo que no esté
  // previsto cae en «otra» y la tabla no puede crecer sin control.
  function ruta() {
    var p = window.location.pathname.replace(/index\.html$/, '');
    if (p === '/404.html') return '/404';
    return p.replace(/\.html$/, '');
  }

  var enviado = false;

  function contar() {
    if (enviado || marcado()) return;
    enviado = true;
    try {
      fetch(URL_RPC, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ruta: ruta() }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // Las visitas de los administradores no cuentan, y aquí está el filtro de
  // verdad: el `fetch` va con la clave pública, así que para Postgres somos
  // un visitante anónimo y allí no se puede saber quién eres.
  //
  // Sin sesión guardada —la inmensa mayoría— se cuenta al momento, que es lo
  // que no hay que retrasar. Con sesión se espera a que `auth.js` pregunte
  // al servidor `fn_es_admin()` y nos lo diga por `SeviVisitas.decidir()`.
  // El tiempo de espera es por si esa respuesta no llega (una página sin el
  // hueco de la sesión, Supabase caído): entonces se cuenta, porque perder
  // visitas reales es peor que colar alguna nuestra.
  window.SeviVisitas = {
    decidir: function (esAdmin) {
      if (esAdmin) {
        marcar();     // este navegador ya no vuelve a contar
        enviado = true;
      } else {
        contar();
      }
    },
  };

  if (!haySesion()) {
    contar();
  } else {
    setTimeout(contar, 4000);
  }
}());
