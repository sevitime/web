// El buzón: lo que SeviTime le cuenta a cada uno sobre lo que mandó.
//
// El mismo que la app (`buzon_screen.dart`) y con las mismas funciones:
// `fn_mis_mensajes`, `fn_marcar_mensajes_leidos` y `fn_borrar_mensaje`. Los
// mensajes los escriben los triggers al moderar; nadie más puede escribir en
// esa tabla. **No es mensajería entre usuarios**, que sigue descartada.
//
// Pide cuenta. En la app el buzón funciona sin sesión porque va por el id del
// móvil; aquí no, por lo mismo que guardar: lo que se escribiera contra un id
// de navegador no se podría volver a ver desde ningún otro sitio. Con sesión,
// `p_device_id` va en `null` y el servidor usa `auth.uid()`, exactamente como
// hace la app cuando hay sesión.
//
// Al abrir se marcan como leídos: estás mirándolos. Es lo que hace la app.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;

  const resumen = document.getElementById('resumen');
  const lista = document.getElementById('lista');

  let usuario = null;
  let mensajes = [];

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function entrar() {
    const cliente = sb();
    if (!cliente) {
      if (window.SEVI && window.SEVI.conSupabase) window.SEVI.conSupabase(entrar);
      return;
    }
    cliente.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }

  function fecha(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const ahora = new Date();
    const mismoAno = d.getFullYear() === ahora.getFullYear();
    return d.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: mismoAno ? undefined : 'numeric',
    }) + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  // --- Datos ---------------------------------------------------------------

  async function cargar() {
    if (!usuario || !sb()) { mensajes = []; return; }
    // Con sesión, `p_device_id` va en null: el servidor usa `auth.uid()`.
    const { data, error } = await sb().rpc('fn_mis_mensajes', { p_device_id: null });
    if (error) throw error;
    mensajes = data || [];
  }

  async function marcarLeidos() {
    if (!mensajes.some(function (m) { return !m.leido_at; })) return;
    try {
      await sb().rpc('fn_marcar_mensajes_leidos', { p_device_id: null, p_ids: null });
    } catch (_) { /* que no se marque no rompe nada: se verán igual */ }
  }

  async function borrar(id, fila) {
    try {
      const { data, error } = await sb().rpc('fn_borrar_mensaje', { p_id: id, p_device_id: null });
      if (error || data !== true) throw error || new Error('no');
      mensajes = mensajes.filter(function (m) { return m.id !== id; });
      fila.remove();
      pintarResumen();
      if (!mensajes.length) pintar();
    } catch (_) {
      const aviso = fila.querySelector('.b-texto') || fila;
      aviso.appendChild(el('span', null, ' · No se ha podido borrar.'));
    }
  }

  // --- Pintado -------------------------------------------------------------

  function pintarResumen() {
    if (!usuario) { resumen.textContent = ''; return; }
    const sinLeer = mensajes.filter(function (m) { return !m.leido_at; }).length;
    if (!mensajes.length) { resumen.textContent = ''; return; }
    resumen.textContent = mensajes.length === 1
      ? '1 mensaje' + (sinLeer ? ' sin leer' : '')
      : mensajes.length + ' mensajes' + (sinLeer ? ' · ' + sinLeer + ' sin leer' : '');
  }

  function vacio(titulo, texto, conBoton) {
    lista.textContent = '';
    const caja = el('div', 'b-vacio');
    caja.appendChild(el('h2', null, titulo));
    caja.appendChild(el('p', null, texto));
    if (conBoton) {
      const b = el('button', 'b-entrar', 'Entrar con Google');
      b.type = 'button';
      b.addEventListener('click', entrar);
      caja.appendChild(b);
    }
    lista.appendChild(caja);
  }

  function pintar() {
    pintarResumen();

    if (!usuario) {
      vacio('Entra para ver tu buzón',
        'Aquí te contamos en qué queda lo que mandas —tus reseñas, tus rutas, ' +
        'los sitios que propones— y te llegan nuestras respuestas si nos escribes.',
        true);
      return;
    }

    if (!mensajes.length) {
      // Las mismas palabras que la app.
      vacio('No tienes mensajes',
        'Aquí te contaremos en qué queda lo que mandas —tus reseñas, tus rutas, ' +
        'los sitios que propones— y te llegarán nuestras respuestas si nos escribes.',
        false);
      return;
    }

    lista.textContent = '';
    mensajes.forEach(function (m) {
      const fila = el('li', 'b-mensaje' + (m.leido_at ? '' : ' sin-leer'));

      // Dos estados y no más, como en la app: salió adelante o no. Un mensaje
      // de «contacto» es una respuesta nuestra y también lleva su marca.
      const esRespuesta = m.origen === 'contacto';
      const icono = el('span', 'b-icono ' + (m.publicado || esRespuesta ? 'ok' : 'info'),
        m.publicado || esRespuesta ? '✓' : 'i');
      icono.setAttribute('aria-hidden', 'true');

      const cuerpo = el('div', 'b-cuerpo');
      // Todo esto lo escribe el servidor, pero se pinta con `textContent`:
      // nada que venga de la base entra como HTML.
      cuerpo.appendChild(el('h2', 'b-titulo', m.titulo || ''));
      if (m.cuerpo) cuerpo.appendChild(el('p', 'b-texto', m.cuerpo));
      cuerpo.appendChild(el('span', 'b-fecha', fecha(m.creado_at)));

      const borrarBtn = el('button', 'b-borrar', '×');
      borrarBtn.type = 'button';
      borrarBtn.setAttribute('aria-label', 'Borrar este mensaje');
      borrarBtn.addEventListener('click', function () { borrar(m.id, fila); });

      fila.append(icono, cuerpo, borrarBtn);
      lista.appendChild(fila);
    });
  }

  // --- Arranque ------------------------------------------------------------

  let ultimoId = false;
  async function cambioDeSesion(user) {
    const id = user ? user.id : null;
    if (id === ultimoId) return;
    ultimoId = id;
    usuario = user;
    if (!usuario) { mensajes = []; pintar(); return; }
    try {
      await cargar();
      pintar();
      await marcarLeidos();
    } catch (_) {
      resumen.textContent = 'No se ha podido leer tu buzón. Recarga dentro de un momento.';
    }
  }

  window.SEVI.onAuth.push(cambioDeSesion);
  if (window.SEVI.conSupabase) {
    // Hace falta el cliente sí o sí: esta página no se puede leer sin sesión.
    window.SEVI.conSupabase(function () {
      sb().auth.getSession()
        .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
        .catch(() => cambioDeSesion(null));
    });
  }
})();
