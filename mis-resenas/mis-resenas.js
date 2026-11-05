// Mis reseñas en la web: lo que has escrito y en qué ha quedado.
//
// La gemela de `MisResenasScreen`, y lee lo mismo que ella: la tabla
// `resenas` filtrada por tu `user_id`, que es lo que deja ver la política
// `resenas_leer_propia`. No hace falta función de servidor: con sesión, la
// RLS ya te enseña las tuyas y solo las tuyas, estén aprobadas o no.
//
// Lo que importa de esta pantalla es el **estado**: una reseña pendiente no
// se ve en la ficha del sitio, y si se rechaza hay un motivo. Sin esto, en la
// web escribías una reseña y no volvías a saber de ella.
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

  // Las mismas palabras que la app.
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

  function estrellas(n) {
    const r = Math.max(0, Math.min(5, Number(n) || 0));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  function ficha(fila) {
    const li = el('li', 't-ficha');

    const cabeza = el('div', 't-cabeza');
    // El nombre lleva a la ficha del sitio cuando sabemos cuál es: una
    // reseña vieja puede no tener `place_key`.
    const nombre = fila.place_key
      ? el('a', 't-nombre', fila.place_name || 'Un sitio')
      : el('span', 't-nombre', fila.place_name || 'Un sitio');
    if (fila.place_key) nombre.href = '/lugar/?k=' + encodeURIComponent(fila.place_key);
    cabeza.appendChild(nombre);

    const e = ESTADOS[fila.estado] || ESTADOS.pendiente;
    cabeza.appendChild(el('span', 't-estado ' + e.clase, e.texto));
    li.appendChild(cabeza);

    const nota = el('div', 't-texto');
    const est = el('span', null, estrellas(fila.rating));
    est.setAttribute('aria-label', (fila.rating || 0) + ' de 5');
    nota.appendChild(est);
    if (fila.comentario) {
      nota.appendChild(el('span', null, '  ' + fila.comentario));
    }
    li.appendChild(nota);

    // El motivo solo cuando lo hay: una reseña rechazada sin explicación es
    // peor que no avisar.
    if (fila.estado === 'rechazada' && fila.motivo_rechazo) {
      li.appendChild(el('p', 't-motivo', fila.motivo_rechazo));
    }

    const meta = [];
    const f = cuando(fila.created_at);
    if (f) meta.push('Escrita el ' + f);
    if (fila.utiles_count) {
      meta.push(fila.utiles_count === 1 ? 'A 1 persona le ha servido'
        : 'A ' + fila.utiles_count + ' personas les ha servido');
    }
    if (fila.tiene_edicion_pendiente) meta.push('Con un cambio en revisión');
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

    if (!user) {
      resumen.textContent = '';
      lista.appendChild(vacio('Entra para ver tus reseñas',
        'Con tu cuenta de Google, la misma que la de la app.'));
      return;
    }
    if (filas === null) {
      resumen.textContent = '';
      lista.appendChild(vacio('No se han podido leer tus reseñas',
        'Prueba a recargar la página dentro de un momento.'));
      return;
    }
    if (!filas.length) {
      resumen.textContent = '';
      lista.appendChild(vacio('Aún no has escrito ninguna reseña',
        'En la ficha de cualquier sitio puedes contar qué tal está.'));
      return;
    }

    const publicadas = filas.filter((f) => f.estado === 'aprobada').length;
    resumen.textContent = filas.length === 1
      ? '1 reseña' + (publicadas ? ', publicada' : '')
      : filas.length + ' reseñas · ' + publicadas + (publicadas === 1 ? ' publicada' : ' publicadas');
    filas.forEach((f) => lista.appendChild(ficha(f)));
  }

  async function cargar(user) {
    try {
      const { data, error } = await sb()
        .from('resenas')
        .select('id, place_name, place_key, rating, comentario, estado, ' +
                'created_at, utiles_count, motivo_rechazo, resenas_ediciones(enviada_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((raw) => {
        const f = Object.assign({}, raw);
        f.tiene_edicion_pendiente = Array.isArray(raw.resenas_ediciones) &&
          raw.resenas_ediciones.length > 0;
        delete f.resenas_ediciones;
        return f;
      });
    } catch (_) {
      return null;   // null = no se ha podido leer, distinto de «no hay nada»
    }
  }

  async function cambioDeSesion(user) {
    if (!user) { pintar([], null); return; }
    pintar(await cargar(user), user);
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
