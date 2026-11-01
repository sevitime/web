// Tus guardados en la web: favoritos, «quiero ir» y «ya he ido».
//
// La gemela de `GuardadosScreen` en la app, con sus tres pestañas, sus
// palabras y sus mismos mensajes cuando no hay nada. Lee **las mismas tablas**
// que la app, así que esto y lo que ves tras el avatar en el móvil son la
// misma lista: con sesión, el `device_id` es tu `auth.uid()` en los dos.
//
// Aquí **hace falta sesión**, y en la app no. Es lo mismo que pasa al guardar
// (ver `lugar/guardar.js`): un guardado anónimo en un navegador se queda atado
// a ese navegador y nadie lo vuelve a ver.
//
// Lo que se pinta sale de `place_json`, que es la foto del sitio que se
// guardó. **No se vuelve a pedir la foto diaria**: son 360 KB para una lista
// de diez sitios, y el nombre que se guardó es el que la persona reconoce.
// Por eso un sitio que haya cambiado de nombre en OSM sale aquí con el de
// antes, igual que en la app.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;

  const PESTANAS = [
    {
      id: 'favoritos',
      tabla: 'user_favorites',
      fecha: 'updated_at',
      etiqueta: 'Favoritos',
      emoji: '♥',
      vacioTitulo: 'Aún no tienes favoritos',
      vacioTexto: 'Pulsa el corazón en cualquier sitio para guardarlo aquí.',
    },
    {
      id: 'pendientes',
      tabla: 'user_pendientes',
      fecha: 'updated_at',
      etiqueta: 'Quiero ir',
      emoji: '🔖',
      vacioTitulo: 'Aún no tienes pendientes',
      vacioTexto: 'Marca sitios que quieres visitar pulsando «Quiero ir» en su ficha.',
    },
    {
      id: 'visitas',
      tabla: 'user_visitas',
      fecha: 'visited_at',
      etiqueta: 'Ya he ido',
      emoji: '✓',
      vacioTitulo: 'Aún no has visitado ningún sitio',
      vacioTexto: 'Pulsa «Ya he ido» en la ficha de cualquier lugar.',
    },
  ];

  const $ = (id) => document.getElementById(id);
  let usuario = null;
  let activa = PESTANAS[0].id;
  const listas = {};   // id de pestaña -> filas, o null si no se ha pedido

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function pestanaDe(id) {
    return PESTANAS.find(function (p) { return p.id === id; });
  }

  function entrar() {
    const ir = function () {
      sb().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    };
    if (sb()) ir();
    else if (window.SEVI && window.SEVI.conSupabase) window.SEVI.conSupabase(ir);
  }

  // --- Datos ---------------------------------------------------------------

  async function cargar(p) {
    if (!usuario) return [];
    try {
      const { data, error } = await sb()
        .from(p.tabla)
        .select('place_key, place_name, place_json, ' + p.fecha)
        .eq('device_id', usuario.id)
        .order(p.fecha, { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (_) {
      return null;   // null = no se ha podido leer, distinto de «no hay nada»
    }
  }

  async function quitar(p, fila, tarjeta) {
    try {
      const { error } = await sb().from(p.tabla).delete()
        .eq('device_id', usuario.id)
        .eq('place_key', fila.place_key);
      if (error) throw error;
      listas[p.id] = (listas[p.id] || []).filter(function (f) {
        return f.place_key !== fila.place_key;
      });
      pintar();
    } catch (_) {
      const aviso = tarjeta.querySelector('.g-aviso');
      if (aviso) aviso.textContent = 'No se ha podido quitar.';
    }
  }

  // --- Pintado -------------------------------------------------------------

  // El emoji y la etiqueta del tipo salen de `lugares.js`, que es el mismo
  // catálogo generado desde la app: así un bar es un bar en los dos sitios.
  function infoDelTipo(tipo) {
    const L = window.sevitimeLugares;
    if (!L || !tipo) return { emoji: '📍', label: 'Sitio', color: '#00897B' };
    return { emoji: L.emojiFor(tipo), label: L.labelFor(tipo), color: L.colorFor(tipo) };
  }

  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function tarjeta(p, fila) {
    const sitio = fila.place_json || {};
    const info = infoDelTipo(sitio.tipo);
    const li = el('li', 'g-sitio');

    const a = el('a', 'g-enlace');
    a.href = '/lugar/?k=' + encodeURIComponent(fila.place_key);
    const ico = el('span', 'g-ico', info.emoji);
    ico.setAttribute('aria-hidden', 'true');
    ico.style.background = info.color;
    ico.style.color = window.sevitimeLugares
      ? window.sevitimeLugares.textoSobre(info.color) : '#fff';
    a.appendChild(ico);

    const txt = el('span', 'g-txt');
    // El nombre guardado, no el de hoy: es el que la persona reconoce.
    txt.appendChild(el('span', 'g-nombre', sitio.name || fila.place_name || 'Un sitio'));
    const meta = el('span', 'g-meta');
    meta.appendChild(el('span', null, info.label));
    const fecha = cuando(fila[p.fecha]);
    if (fecha) {
      meta.appendChild(el('span', 'g-punto', '·'));
      meta.appendChild(el('span', null, (p.id === 'visitas' ? 'Fuiste el ' : 'Guardado el ') + fecha));
    }
    txt.appendChild(meta);
    if (sitio.direccion) txt.appendChild(el('span', 'g-dir', sitio.direccion));
    a.appendChild(txt);
    li.appendChild(a);

    const quitarBtn = el('button', 'g-quitar', '×');
    quitarBtn.type = 'button';
    quitarBtn.title = 'Quitar de la lista';
    quitarBtn.setAttribute('aria-label',
      'Quitar ' + (sitio.name || 'este sitio') + ' de ' + p.etiqueta);
    quitarBtn.addEventListener('click', function () { quitar(p, fila, li); });
    li.appendChild(quitarBtn);
    li.appendChild(el('span', 'g-aviso', ''));
    return li;
  }

  function pintarPestanas() {
    const caja = $('pestanas');
    caja.textContent = '';
    PESTANAS.forEach(function (p) {
      const b = el('button', 'chip' + (p.id === activa ? ' seleccionado' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', p.id === activa ? 'true' : 'false');
      b.appendChild(el('span', null, p.emoji));
      const cuantos = listas[p.id] ? listas[p.id].length : null;
      b.appendChild(el('span', null, p.etiqueta + (cuantos ? ' (' + cuantos + ')' : '')));
      b.addEventListener('click', function () {
        activa = p.id;
        pintar();
      });
      caja.appendChild(b);
    });
  }

  function pintar() {
    pintarPestanas();
    const lista = $('lista');
    lista.textContent = '';
    lista.removeAttribute('aria-busy');

    if (!usuario) {
      $('resumen').textContent = '';
      const caja = el('li', 'g-vacio');
      caja.appendChild(el('p', 'g-vacio-titulo', 'Entra para ver tus guardados'));
      caja.appendChild(el('p', 'g-vacio-texto',
        'Lo que guardes aquí sale también en la app, y al revés.'));
      const b = el('button', 'g-entrar', 'Entrar con Google');
      b.type = 'button';
      b.addEventListener('click', entrar);
      caja.appendChild(b);
      lista.appendChild(caja);
      return;
    }

    const p = pestanaDe(activa);
    const filas = listas[p.id];

    if (filas === null) {
      $('resumen').textContent = '';
      const caja = el('li', 'g-vacio');
      caja.appendChild(el('p', 'g-vacio-titulo', 'No hemos podido leer tus guardados'));
      caja.appendChild(el('p', 'g-vacio-texto', 'Comprueba la conexión y vuelve a intentarlo.'));
      lista.appendChild(caja);
      return;
    }

    const total = PESTANAS.reduce(function (n, x) {
      return n + ((listas[x.id] && listas[x.id].length) || 0);
    }, 0);
    $('resumen').textContent = total === 1 ? '1 sitio guardado'
      : total.toLocaleString('es-ES') + ' sitios guardados';

    if (!filas.length) {
      const caja = el('li', 'g-vacio');
      caja.appendChild(el('p', 'g-vacio-titulo', p.vacioTitulo));
      caja.appendChild(el('p', 'g-vacio-texto', p.vacioTexto));
      const ir = el('a', 'g-entrar', 'Buscar sitios cerca');
      ir.href = '/explorar/';
      caja.appendChild(ir);
      lista.appendChild(caja);
      return;
    }

    filas.forEach(function (fila) { lista.appendChild(tarjeta(p, fila)); });
  }

  // --- Arranque ------------------------------------------------------------

  // La pestaña se puede elegir desde la dirección: `/guardados/?t=pendientes`
  // es lo que enlaza «Ver tus guardados» en la ficha de un sitio.
  const pedida = new URLSearchParams(location.search).get('t');
  if (pedida && pestanaDe(pedida)) activa = pedida;

  let ultimoId = false;
  async function cambioDeSesion(user) {
    const id = user ? user.id : null;
    if (id === ultimoId) return;
    ultimoId = id;
    usuario = user;
    if (!usuario) {
      PESTANAS.forEach(function (p) { listas[p.id] = []; });
      pintar();
      return;
    }
    const resultados = await Promise.all(PESTANAS.map(cargar));
    PESTANAS.forEach(function (p, i) { listas[p.id] = resultados[i]; });
    pintar();
  }

  window.SEVI.onAuth.push(cambioDeSesion);
  const cliente = sb();
  if (cliente) {
    cliente.auth.getSession()
      .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
      .catch(() => {});
  } else if (!haySesionGuardada()) {
    // Sin sesión guardada, `auth.js` ni carga Supabase ni avisa de nada: hay
    // que pintar el «entra» sin esperar un aviso que no va a llegar. Si sí la
    // hay, se espera, para no enseñar «entra» a quien ya está dentro.
    cambioDeSesion(null);
  }

  // La misma comprobación que hace `auth.js`: la clave de supabase-js es
  // `sb-<ref>-auth-token`, a veces troceada.
  function haySesionGuardada() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var clave = localStorage.key(i);
        if (clave && clave.indexOf('sb-') === 0 && clave.indexOf('-auth-token') !== -1) {
          return true;
        }
      }
    } catch (_) { /* almacenamiento bloqueado: trátalo como sin sesión */ }
    return false;
  }
})();
