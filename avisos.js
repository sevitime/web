// Avisos push en la web, para la web instalada en la pantalla de inicio.
//
// Por qué: en iPhone no hay app, y la web añadida a la pantalla de inicio es
// la forma de tenerla. Pero sin avisos nadie vuelve: lo que trae a la gente de
// vuelta es el aviso de los planes del fin de semana y el de las respuestas a
// lo suyo. En iOS los avisos web **solo** funcionan si la web está añadida a
// la pantalla de inicio (desde iOS 16.4), así que aquí se explica eso cuando
// toca en vez de ofrecer un botón que no haría nada.
//
// Cómo, y es lo que ahorra media aplicación: los avisos de la web usan
// **Firebase Cloud Messaging, el mismo que la app**. El token que da el
// navegador se guarda en la **misma tabla** (`push_tokens`, por
// `fn_registrar_push_token`, con `plataforma = 'web'`), así que **todo lo que
// ya manda avisos los manda también a la web** —moderación, respuestas a lo
// tuyo, el aviso semanal— sin tocar ni la función de envío ni el registro de
// envíos.
//
// Decisiones:
//
//  * **Pide cuenta.** Un aviso sin cuenta iría a un navegador y a nadie.
//    Además `push_tokens` se lleva por `device_id`, y aquí se manda el id de
//    la cuenta: así el aviso es de la persona.
//  * **Nada de Firebase se descarga hasta que se pulsa.** Los dos scripts de
//    gstatic.com son el único tercero que entra por esta vía, y solo para
//    quien enciende los avisos.
//  * **Sin configuración, no existe.** Mientras `/avisos-config.json` no
//    tenga `apiKey`, `appId` y `vapidKey`, la tarjeta no se pinta: es mejor
//    que no haya nada que un interruptor que falla.
(function () {
  'use strict';

  const VERSION_SDK = '10.14.1';
  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  const sb = () => window.SEVI && window.SEVI.sb;

  let config = null;
  let usuario = null;
  let seccion = null;
  let activo = false;
  let trabajando = false;

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function soportado() {
    return 'serviceWorker' in navigator && 'PushManager' in window &&
      'Notification' in window;
  }

  // En iOS los avisos web solo existen dentro de la web instalada. Fuera de
  // ahí, Safari ni siquiera deja pedir el permiso.
  function esIOSsinInstalar() {
    const io = window.SeviIOS;
    return Boolean(io && io.es && !io.instalada);
  }

  function conSupabase(fn) {
    if (sb()) { fn(); return; }
    if (window.SEVI && window.SEVI.conSupabase) window.SEVI.conSupabase(fn);
  }

  function entrar() {
    conSupabase(function () {
      sb().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
    });
  }

  // --- Supabase ------------------------------------------------------------

  function token() {
    const c = sb();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession()
      .then((r) => (r && r.data && r.data.session ? r.data.session.access_token : null))
      .catch(() => null);
  }

  async function rpc(nombre, cuerpo) {
    const t = await token();
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + nombre, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + (t || SUPABASE_KEY),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  // --- Firebase, solo cuando hace falta ------------------------------------

  async function pedirToken() {
    const [{ initializeApp }, { getMessaging, getToken }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/' + VERSION_SDK + '/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/' + VERSION_SDK + '/firebase-messaging.js'),
    ]);
    const app = initializeApp({
      apiKey: config.apiKey,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    // El worker de los avisos es el de Firebase y no el nuestro: el suyo
    // tiene que llamarse así y vivir en la raíz.
    const registro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return getToken(getMessaging(app), {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registro,
    });
  }

  // --- Encender y apagar ---------------------------------------------------

  async function encender(aviso) {
    if (trabajando) return;
    trabajando = true;
    aviso.textContent = 'Pidiendo permiso…';
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        aviso.textContent = permiso === 'denied'
          ? 'Los avisos están bloqueados para esta web en los ajustes de tu navegador.'
          : 'Sin permiso no se pueden mandar avisos.';
        trabajando = false;
        pintar(aviso.textContent);
        return;
      }
      const tk = await pedirToken();
      if (!tk) throw new Error('sin token');
      await rpc('fn_registrar_push_token', {
        p_device_id: usuario.id,
        p_token: tk,
        p_plataforma: 'web',
        p_version: 'web',
      });
      activo = true;
      recordar(true);
      pintar('Avisos activados.');
    } catch (_) {
      pintar('No se han podido activar. Inténtalo más tarde.');
    } finally {
      trabajando = false;
    }
  }

  async function apagar() {
    if (trabajando) return;
    trabajando = true;
    try {
      await rpc('fn_baja_push_token', { p_device_id: usuario.id });
      activo = false;
      recordar(false);
      pintar('Avisos desactivados.');
    } catch (_) {
      pintar('No se han podido desactivar. Inténtalo más tarde.');
    } finally {
      trabajando = false;
    }
  }

  // El interruptor del aviso semanal, el mismo que la app sube con
  // `fn_avisos_planes`: en la base nace apagado a propósito.
  async function planes(valor, aviso) {
    try {
      await rpc('fn_avisos_planes', { p_device_id: usuario.id, p_activo: valor });
      try { localStorage.setItem('sevi-avisos-planes', valor ? '1' : '0'); } catch (_) {}
      aviso.textContent = valor
        ? 'Te avisaremos los jueves de los planes del fin de semana.'
        : 'No te avisaremos de los planes del fin de semana.';
    } catch (_) {
      aviso.textContent = 'No se ha podido guardar. Inténtalo más tarde.';
    }
  }

  // Lo que el navegador no sabe decir: si ESTE usuario tiene el token dado de
  // alta. Se guarda aquí al encender y se cruza con el permiso, que sí se
  // puede leer; si el permiso ya no está, el interruptor vuelve a apagado.
  function recordar(valor) {
    try { localStorage.setItem('sevi-avisos', valor ? '1' : '0'); } catch (_) {}
  }
  function recordado() {
    try { return localStorage.getItem('sevi-avisos') === '1'; } catch (_) { return false; }
  }
  function planesRecordado() {
    try { return localStorage.getItem('sevi-avisos-planes') === '1'; } catch (_) { return false; }
  }

  // --- Pintado -------------------------------------------------------------

  function pintar(mensaje) {
    if (!seccion) return;
    const cuerpo = seccion.querySelector('.avisos-cuerpo');
    cuerpo.textContent = '';

    if (esIOSsinInstalar()) {
      cuerpo.appendChild(el('p', 'avisos-nota',
        'En iPhone los avisos llegan solo si añades SeviTime a tu pantalla ' +
        'de inicio. Es un momento y queda como una app.'));
      const a = el('a', 'avisos-enlace', 'Cómo añadirla');
      a.href = '/#llevatela';
      cuerpo.appendChild(a);
      return;
    }

    if (!usuario) {
      cuerpo.appendChild(el('p', 'avisos-nota',
        'Con tu cuenta te avisamos cuando se aprueba lo que aportas y cuando ' +
        'hay planes el fin de semana.'));
      const b = el('button', 'avisos-entrar', 'Entrar con Google para recibir avisos');
      b.type = 'button';
      b.addEventListener('click', entrar);
      cuerpo.appendChild(b);
      return;
    }

    if (Notification.permission === 'denied') {
      cuerpo.appendChild(el('p', 'avisos-nota',
        'Los avisos están bloqueados para esta web en los ajustes de tu ' +
        'navegador. Si los permites ahí, vuelve a esta página.'));
      return;
    }

    const aviso = el('p', 'avisos-estado', mensaje || '');
    aviso.setAttribute('role', 'status');

    const boton = el('button', 'avisos-boton',
      activo ? 'Desactivar los avisos' : 'Activar los avisos');
    boton.type = 'button';
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
    boton.addEventListener('click', function () {
      if (activo) apagar(); else encender(aviso);
    });

    cuerpo.appendChild(el('p', 'avisos-nota',
      'Te avisamos cuando se aprueba lo que aportas, cuando alguien responde ' +
      'a lo tuyo y, si lo pides, de los planes del fin de semana.'));
    cuerpo.appendChild(boton);

    if (activo) {
      const fila = el('label', 'avisos-opcion');
      const caja = document.createElement('input');
      caja.type = 'checkbox';
      caja.checked = planesRecordado();
      caja.addEventListener('change', function () { planes(caja.checked, aviso); });
      fila.appendChild(caja);
      fila.appendChild(el('span', null, 'Planes del fin de semana, los jueves'));
      cuerpo.appendChild(fila);
    }

    cuerpo.appendChild(aviso);
  }

  // --- Arranque ------------------------------------------------------------

  async function iniciar(donde) {
    if (!donde || !soportado()) return;
    try {
      const r = await fetch('/avisos-config.json');
      config = await r.json();
    } catch (_) { return; }
    // Sin app web creada en Firebase no hay avisos que ofrecer.
    if (!config.apiKey || !config.appId || !config.vapidKey) return;

    activo = recordado() && Notification.permission === 'granted';
    if (!activo) recordar(false);

    seccion = el('section', 'avisos');
    seccion.id = 'avisos';
    seccion.appendChild(el('h2', null, 'Avisos'));
    seccion.appendChild(el('div', 'avisos-cuerpo'));
    donde.appendChild(seccion);
    pintar();

    let ultimoId = false;
    function cambioDeSesion(user) {
      const id = user ? user.id : null;
      if (id === ultimoId) return;
      ultimoId = id;
      usuario = user;
      pintar();
    }
    window.SEVI.onAuth.push(cambioDeSesion);
    const cliente = sb();
    if (cliente) {
      cliente.auth.getSession()
        .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
        .catch(() => {});
    }
  }

  window.SeviAvisos = { iniciar: iniciar };

  function arrancar() {
    const donde = document.getElementById('hueco-avisos');
    if (donde) iniciar(donde);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
