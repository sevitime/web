// Guardar un sitio desde la web: «Favorito», «Quiero ir» y «Ya he ido».
//
// Las mismas tres cosas que la app ofrece en la ficha
// (`barra_acciones_lugar.dart`), con sus mismas palabras, y **escribiendo en
// las mismas tres tablas**: lo que guardes aquí sale en tu app y al revés.
//
// Las tres tablas se llevan por `device_id`, que es `auth.uid()` cuando hay
// sesión y el UUID del móvil cuando no. **Aquí se exige sesión**, y es una
// diferencia a propósito con la app: un guardado anónimo en un navegador se
// queda atado a ese navegador, no se puede llevar a ninguna parte y nadie lo
// vuelve a ver. Con sesión, el `device_id` es el mismo que usa su app, así
// que las dos listas son una.
//
// ⚠️ Las tres tablas NO guardan lo mismo en `place_name`, y es una trampa
// documentada en SUPABASE_SCHEMA.md:
//
//   * `user_favorites.place_name`  → el **nombre real** del sitio.
//   * `user_visitas.place_name`    → el **nombre real** del sitio.
//   * `user_pendientes.place_name` → el **placeKey**, pese al nombre de la
//     columna. Es histórico y la app publicada depende de ello.
//
// Las tres llevan además `place_key`, que es por donde se lee. Y `place_json`
// es una foto del `Place` de la app: `Place.fromJson` tiene valor por defecto
// para todo, así que basta con lo que esta ficha sabe de verdad. Lo que no se
// sabe **no se inventa**: un `distance: 0` aquí sería mentira, porque esta
// página no mide distancias.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;

  // Cada acción, con la tabla donde vive y qué mete en `place_name`.
  const ACCIONES = [
    {
      id: 'favorito',
      tabla: 'user_favorites',
      nombreEsLaClave: false,
      titulo: 'Favorito',
      detalle: 'Un sitio que te gusta',
      icono: '♥',
    },
    {
      id: 'pendiente',
      tabla: 'user_pendientes',
      nombreEsLaClave: true,
      titulo: 'Quiero ir',
      detalle: 'Para acordarte la próxima vez',
      icono: '🔖',
    },
    {
      id: 'visita',
      tabla: 'user_visitas',
      nombreEsLaClave: false,
      titulo: 'Ya he ido',
      detalle: 'Cuenta para tus visitas',
      icono: '✓',
    },
  ];

  let lugar = null;
  let usuario = null;
  let seccion = null;
  const puesto = {};   // id de acción -> si está guardado

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function conSupabase(fn) {
    if (sb()) { fn(); return; }
    if (window.SEVI && window.SEVI.conSupabase) window.SEVI.conSupabase(fn);
  }

  function entrar() {
    try { sessionStorage.setItem('sevi-lugar-abierto', lugar.clave); }
    catch (_) { /* sin almacenamiento */ }
    conSupabase(function () {
      sb().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname + window.location.search,
        },
      });
    });
  }

  // La foto del sitio que guarda la app. Solo lo que esta ficha sabe: los
  // campos que faltan los rellena `Place.fromJson` con su valor por defecto.
  function fotoDelSitio() {
    const foto = {
      name: lugar.nombre,
      lat: lugar.lat,
      lon: lugar.lon,
      tipo: lugar.tipo || 'otro',
      telefono: lugar.telefono || '',
      web: lugar.web || '',
      horario: lugar.horario || '',
    };
    if (lugar.direccion) foto.direccion = lugar.direccion;
    if (lugar.osmType && lugar.osmId != null) {
      foto.osmType = lugar.osmType;
      foto.osmId = lugar.osmId;
    }
    return foto;
  }

  function nombreParaLaTabla(accion) {
    return accion.nombreEsLaClave ? lugar.clave : lugar.nombre;
  }

  // --- Leer lo que ya hay --------------------------------------------------

  async function cargar() {
    ACCIONES.forEach(function (a) { puesto[a.id] = false; });
    if (!usuario) return;
    await Promise.all(ACCIONES.map(async function (a) {
      try {
        const { data } = await sb()
          .from(a.tabla)
          .select('place_key')
          .eq('device_id', usuario.id)
          .eq('place_key', lugar.clave)
          .limit(1);
        puesto[a.id] = Boolean(data && data.length);
      } catch (_) { /* se queda en falso: mejor no marcarlo que mentir */ }
    }));
  }

  // --- Guardar y quitar ----------------------------------------------------

  async function alternar(accion, boton, aviso) {
    const estaba = puesto[accion.id];
    // Se pinta antes de que conteste el servidor y se deshace si falla, que
    // es lo que hace la app con el corazón.
    puesto[accion.id] = !estaba;
    pintarBoton(accion, boton);
    if (!estaba) window.sevitimeLugares.latir(boton.querySelector('.guardar-icono'));
    aviso.textContent = '';

    try {
      if (estaba) {
        const { error } = await sb().from(accion.tabla).delete()
          .eq('device_id', usuario.id)
          .eq('place_key', lugar.clave);
        if (error) throw error;
      } else {
        const fila = {
          device_id: usuario.id,
          place_name: nombreParaLaTabla(accion),
          place_key: lugar.clave,
          place_json: fotoDelSitio(),
        };
        // `user_visitas` marca cuándo se fue; las otras dos, cuándo se tocó.
        if (accion.tabla === 'user_visitas') fila.visited_at = new Date().toISOString();
        else fila.updated_at = new Date().toISOString();
        // La clave primaria sigue siendo `(device_id, place_name)` en las
        // tres: es por ahí por donde hay que resolver el conflicto.
        const { error } = await sb().from(accion.tabla)
          .upsert(fila, { onConflict: 'device_id,place_name' });
        if (error) throw error;
      }
    } catch (_) {
      puesto[accion.id] = estaba;
      pintarBoton(accion, boton);
      aviso.textContent = 'No se ha podido guardar. Inténtalo más tarde.';
      return;
    }
    // El enlace a la lista sale en cuanto hay algo guardado y se va cuando no
    // queda nada, así que la sección se repinta entera al terminar.
    const texto = aviso.textContent;
    pintar();
    const nuevoAviso = seccion.querySelector('.guardar-aviso');
    if (nuevoAviso) nuevoAviso.textContent = texto;
  }

  // --- Pintado -------------------------------------------------------------

  function pintarBoton(accion, boton) {
    const activo = puesto[accion.id];
    boton.classList.toggle('puesto', activo);
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
    boton.querySelector('.guardar-titulo').textContent =
      activo && accion.id === 'favorito' ? 'En favoritos' : accion.titulo;
  }

  function pintar() {
    if (!seccion) return;
    const cuerpo = seccion.querySelector('.guardar-cuerpo');
    cuerpo.textContent = '';

    if (!usuario) {
      cuerpo.appendChild(el('p', 'guardar-nota',
        'Guarda este sitio para encontrarlo luego. Con tu cuenta, lo que ' +
        'guardes aquí sale también en la app.'));
      const b = el('button', 'guardar-entrar', 'Entrar con Google para guardar');
      b.type = 'button';
      b.addEventListener('click', entrar);
      cuerpo.appendChild(b);
      return;
    }

    const aviso = el('p', 'guardar-aviso', '');
    aviso.setAttribute('role', 'status');
    const fila = el('div', 'guardar-opciones');
    ACCIONES.forEach(function (a) {
      const b = el('button', 'guardar-opcion');
      b.type = 'button';
      b.appendChild(el('span', 'guardar-icono', a.icono));
      const txt = el('span', 'guardar-texto');
      txt.appendChild(el('span', 'guardar-titulo', a.titulo));
      txt.appendChild(el('span', 'guardar-detalle', a.detalle));
      b.appendChild(txt);
      b.addEventListener('click', function () { alternar(a, b, aviso); });
      pintarBoton(a, b);
      fila.appendChild(b);
    });
    cuerpo.appendChild(fila);

    // Dónde ha ido lo que acabas de guardar. La app tiene este mismo enlace
    // y por el mismo motivo: sin él, nada dice que haya una lista.
    const algo = ACCIONES.find(function (a) { return puesto[a.id]; });
    if (algo) {
      const ver = el('a', 'guardar-ver', 'Ver tus guardados');
      ver.href = '/guardados/?t=' + (algo.id === 'favorito' ? 'favoritos'
        : algo.id === 'pendiente' ? 'pendientes' : 'visitas');
      cuerpo.appendChild(ver);
    }

    cuerpo.appendChild(aviso);
  }

  // --- Arranque ------------------------------------------------------------

  window.SeviGuardar = {
    iniciar(datos, donde) {
      lugar = datos;
      seccion = el('section', 'guardar');
      seccion.id = 'guardar';
      seccion.appendChild(el('h2', null, 'Guardar este sitio'));
      seccion.appendChild(el('div', 'guardar-cuerpo'));
      donde.appendChild(seccion);
      pintar();

      let ultimoId = false;
      async function cambioDeSesion(user) {
        const id = user ? user.id : null;
        if (id === ultimoId) return;
        ultimoId = id;
        usuario = user;
        await cargar();
        pintar();
      }
      window.SEVI.onAuth.push(cambioDeSesion);
      const cliente = sb();
      if (cliente) {
        cliente.auth.getSession()
          .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
          .catch(() => {});
      }
    },
  };
})();
