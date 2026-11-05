// Mis aportaciones en la web: lo que has mandado y en qué ha quedado.
//
// La gemela de `MisAportacionesScreen`, por la misma función que usa la app:
// `fn_mis_aportaciones(p_device_id)`. Con sesión, el `device_id` es tu
// `auth.uid()` en los dos sitios, así que esta lista y la del móvil son la
// misma.
//
// Las palabras están copiadas de `lib/utils/aportaciones_labels.dart` a
// propósito, una por una. Son decisiones, no literales sueltos:
//
//  * La base guarda `enviado` para todo lo aprobado, se mandara nota a OSM o
//    no; aquí se llama **Publicada**, porque lo que le importa a quien la
//    mandó es que su dato ya está, no el papeleo con OpenStreetMap.
//  * `descartado` no se llama «Rechazada»: suena a suspenso y a que has
//    hecho algo mal, y casi siempre es que el dato no se pudo confirmar.
//    Se llama **No se pudo aplicar**.
//
// Si esas palabras cambian en la app, hay que cambiarlas aquí.
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

  function estadoDe(a) {
    if (a.estado === 'enviado') return { clase: 'es-aprobada', texto: 'Publicada' };
    if (a.estado === 'descartado') return { clase: 'es-rechazada', texto: 'No se pudo aplicar' };
    return { clase: 'es-pendiente', texto: 'En revisión' };
  }

  function enumerar(partes) {
    if (partes.length === 1) return partes[0];
    return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
  }

  // Qué mandó, en una línea.
  function titulo(a) {
    const sitio = (a.nombre || '').trim() || 'un sitio';
    if (a.origen === 'sugerencia') return sitio + ', sitio nuevo';
    if (a.origen === 'resena') return 'Tu reseña de ' + sitio;
    if (a.origen === 'ruta') return '«' + sitio + '»';

    if (a.motivo === 'datos') {
      const datos = [];
      if (a.aporto_horario) datos.push('el horario');
      if (a.aporto_telefono) datos.push('el teléfono');
      if (a.aporto_web) datos.push('la web');
      if (a.con_foto) datos.push('una foto');
      if (!datos.length) return 'Datos de ' + sitio;
      const lista = enumerar(datos);
      return lista.charAt(0).toUpperCase() + lista.slice(1) + ' de ' + sitio;
    }

    switch (a.motivo) {
      case 'cerrado': return sitio + ': ha cerrado';
      case 'no_existe': return sitio + ': ya no existe';
      case 'renombrado': return sitio + ': cambió de nombre';
      case 'foto_erronea': return sitio + ': la foto no era de ahí';
      default: return 'Aviso sobre ' + sitio;
    }
  }

  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function ficha(a) {
    const li = el('li', 't-ficha');

    const cabeza = el('div', 't-cabeza');
    cabeza.appendChild(el('span', 't-nombre', titulo(a)));
    const e = estadoDe(a);
    cabeza.appendChild(el('span', 't-estado ' + e.clase, e.texto));
    li.appendChild(cabeza);

    const meta = [];
    const f = cuando(a.created_at);
    if (f) meta.push('Enviada el ' + f);
    // «En OpenStreetMap» solo cuando de verdad llegó: es la diferencia entre
    // que el dato esté en SeviTime y que esté en el mapa de todo el mundo.
    if (a.en_osm) meta.push('En OpenStreetMap');
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
      lista.appendChild(vacio('Entra para ver lo que has aportado',
        'Con tu cuenta de Google, la misma que la de la app.'));
      return;
    }
    if (filas === null) {
      lista.appendChild(vacio('No se han podido leer tus aportaciones',
        'Prueba a recargar la página dentro de un momento.'));
      return;
    }
    if (!filas.length) {
      lista.appendChild(vacio('Aún no has aportado nada',
        'Cuando avises de que un sitio ha cerrado, aportes un horario o propongas un sitio nuevo, aparecerá aquí.'));
      return;
    }

    const publicadas = filas.filter((f) => f.estado === 'enviado').length;
    resumen.textContent = filas.length === 1
      ? '1 aportación' + (publicadas ? ', publicada' : '')
      : filas.length + ' aportaciones · ' + publicadas + (publicadas === 1 ? ' publicada' : ' publicadas');
    filas.forEach((f) => lista.appendChild(ficha(f)));
  }

  async function cargar(user) {
    try {
      const { data, error } = await sb().rpc('fn_mis_aportaciones', { p_device_id: user.id });
      if (error) throw error;
      return data || [];
    } catch (_) {
      return null;
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
