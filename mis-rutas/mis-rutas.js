// Mis rutas en la web: las que has creado y en qué han quedado.
//
// La gemela de la pantalla «Mis rutas» de la app, y por el mismo camino:
// `fn_mis_rutas`, que devuelve también las que están pendientes o rechazadas
// —las que `fn_rutas_publicas` no enseña— con su motivo cuando lo hay.
//
// Las paradas vienen dentro de la misma respuesta (`paradas`, jsonb), así que
// se puede decir de cuántas es cada ruta sin una segunda consulta.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;
  const $ = (id) => document.getElementById(id);

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  const ESTADOS = {
    aprobada: { clase: 'es-aprobada', texto: 'Publicada' },
    pendiente: { clase: 'es-pendiente', texto: 'En revisión' },
    rechazada: { clase: 'es-rechazada', texto: 'No publicada' },
  };

  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function cuantasParadas(paradas) {
    if (Array.isArray(paradas)) return paradas.length;
    if (typeof paradas === 'string') {
      try { const p = JSON.parse(paradas); return Array.isArray(p) ? p.length : 0; }
      catch (_) { return 0; }
    }
    return 0;
  }

  function ficha(r) {
    const li = el('li', 't-ficha');

    const cabeza = el('div', 't-cabeza');
    if (r.icono) {
      const ico = el('span', null, r.icono);
      ico.setAttribute('aria-hidden', 'true');
      cabeza.appendChild(ico);
    }
    // Solo las publicadas tienen página: una ruta en revisión no se puede
    // abrir todavía, y un enlace que lleva a un error es peor que un texto.
    const nombre = r.estado === 'aprobada'
      ? el('a', 't-nombre', r.nombre || 'Una ruta')
      : el('span', 't-nombre', r.nombre || 'Una ruta');
    if (r.estado === 'aprobada') nombre.href = '/rutas/?id=' + encodeURIComponent(r.id);
    cabeza.appendChild(nombre);

    const e = ESTADOS[r.estado] || ESTADOS.pendiente;
    cabeza.appendChild(el('span', 't-estado ' + e.clase, e.texto));
    li.appendChild(cabeza);

    if (r.descripcion) li.appendChild(el('p', 't-texto', r.descripcion));
    if (r.estado === 'rechazada' && r.motivo_rechazo) {
      li.appendChild(el('p', 't-motivo', r.motivo_rechazo));
    }

    const meta = [];
    const n = cuantasParadas(r.paradas);
    if (n) meta.push(n === 1 ? '1 parada' : n + ' paradas');
    if (r.minutos) meta.push('unos ' + r.minutos + ' min');
    const f = cuando(r.created_at);
    if (f) meta.push('Creada el ' + f);
    if (meta.length) li.appendChild(el('p', 't-meta', meta.join(' · ')));

    return li;
  }

  function vacio(titulo, texto) {
    const li = el('li', 't-vacio');
    li.appendChild(el('strong', null, titulo));
    li.appendChild(el('span', null, texto));
    return li;
  }

  function pintar(filas, user) {
    const lista = $('lista');
    const resumen = $('resumen');
    lista.textContent = '';
    lista.removeAttribute('aria-busy');
    resumen.textContent = '';

    if (!user) {
      lista.appendChild(vacio('Entra para ver tus rutas',
        'Con tu cuenta de Google, la misma que la de la app.'));
      return;
    }
    if (filas === null) {
      lista.appendChild(vacio('No se han podido leer tus rutas',
        'Prueba a recargar la página dentro de un momento.'));
      return;
    }
    if (!filas.length) {
      lista.appendChild(vacio('Aún no has creado ninguna ruta',
        'Una ruta es un paseo con sus paradas, para que otro lo repita.'));
      return;
    }

    const publicadas = filas.filter((f) => f.estado === 'aprobada').length;
    resumen.textContent = filas.length === 1
      ? '1 ruta' + (publicadas ? ', publicada' : '')
      : filas.length + ' rutas · ' + publicadas + (publicadas === 1 ? ' publicada' : ' publicadas');
    filas.forEach((f) => lista.appendChild(ficha(f)));
  }

  async function cargar() {
    try {
      const { data, error } = await sb().rpc('fn_mis_rutas');
      if (error) throw error;
      return data || [];
    } catch (_) {
      return null;
    }
  }

  async function cambioDeSesion(user) {
    if (!user) { pintar([], null); return; }
    pintar(await cargar(), user);
  }

  window.SEVI.onAuth.push(cambioDeSesion);
  const cliente = sb();
  if (cliente) {
    cliente.auth.getSession()
      .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
      .catch(() => cambioDeSesion(null));
  } else if (!haySesionGuardada()) {
    cambioDeSesion(null);
  }

  function haySesionGuardada() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        if (clave && clave.indexOf('sb-') === 0 && clave.indexOf('-auth-token') !== -1) {
          return true;
        }
      }
    } catch (_) { /* almacenamiento bloqueado */ }
    return false;
  }
})();
