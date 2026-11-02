// «¿Está abierto?» desde la web: lo que dice quien está delante.
//
// Lo mismo que la app enseña en la ficha (`fila_estado_lugar.dart`) y en la
// lista de Explorar, con sus mismas palabras y **escribiendo en la misma
// tabla**: `fn_confirmar_estado`, que se lee agregada con
// `fn_estado_lugares`. La tabla no la lee nadie —dice dónde ha estado una
// persona y cuándo—, así que todo pasa por esas dos funciones.
//
// Existe porque el horario no está en ninguna parte: de los 9.272 sitios con
// nombre, 661 traen `opening_hours` en OpenStreetMap (7,1%). Ver
// `docs/sql/abierto_ahora.sql` en el repo de la app.
//
// Dos diferencias con la app, las dos a propósito:
//
//  1. **Aquí se exige sesión**, como para guardar: el freno y el contador van
//     por `device_id`, y en un navegador un id anónimo no se puede llevar a
//     ninguna parte. Con sesión se manda el id de la cuenta, así que la web
//     cuenta a la persona, no al aparato.
//  2. **La ubicación no se pide al abrir la ficha.** Si ya está concedida se
//     lee en silencio y la pregunta es la de cerca o la de lejos según los
//     150 m de siempre. Si no, se pregunta lo útil («¿Está abierto ahora?») y
//     la ubicación se pide **al contestar**, que es un gesto deliberado; si
//     sale lejos o la deniega, su respuesta vale para el horario y se le dice
//     así, igual que en la app.
(function () {
  'use strict';

  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  // Los mismos números que la app: 150 m es una manzana larga del centro, y
  // una confirmación vale dos horas.
  const METROS_CERCA = 150;
  const VENTANA_MS = 2 * 60 * 60 * 1000;

  const sb = () => window.SEVI && window.SEVI.sb;

  // Los sitios a los que se puede ir a cualquier hora. Copiada de
  // `PlaceTypes.sinPuerta` (repo de la app): la lista es corta a propósito y
  // peca de prudente. Los parques NO están, aunque lo parezcan: el de María
  // Luisa cierra de noche y OSM no lo dice. Decir «siempre accesible» de algo
  // con la verja echada es peor que no decir nada.
  const SIN_PUERTA = [
    'artwork', 'memorial', 'monument', 'wayside_cross', 'city_gate',
    'citywalls', 'aqueduct', 'viewpoint', 'fountain', 'square', 'bus_stop'
  ];

  let lugar = null;
  let usuario = null;
  let seccion = null;
  let estado = null;        // lo que dice la gente, o null
  let yaConteste = false;
  let fueDeLejos = false;
  let posicion = null;      // {lat, lon} si la sabemos sin molestar

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
    conSupabase(function () {
      sb().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname + window.location.search,
        },
      });
    });
  }

  // --- Distancia -----------------------------------------------------------

  // Haversine, los mismos metros que mide la app.
  function metrosHasta(lat, lon) {
    if (lugar.lat == null || lugar.lon == null) return null;
    const R = 6371000;
    const dLat = (lat - lugar.lat) * Math.PI / 180;
    const dLon = (lon - lugar.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * Math.PI / 180) * Math.cos(lugar.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function estaCerca(pos) {
    if (!pos) return false;
    const m = metrosHasta(pos.lat, pos.lon);
    return m != null && m <= METROS_CERCA;
  }

  function ubicacion(opciones) {
    const o = opciones || {};
    return new Promise(function (listo) {
      if (!navigator.geolocation) { listo(null); return; }
      navigator.geolocation.getCurrentPosition(
        function (p) { listo({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        function () { listo(null); },
        { enableHighAccuracy: true, timeout: o.timeout || 8000, maximumAge: 60000 }
      );
    });
  }

  // La ubicación solo si ya está concedida: así la ficha no dispara el aviso
  // del navegador por abrirla. Donde no hay Permissions API (Safari antiguo)
  // no se pregunta y se resuelve al contestar.
  async function ubicacionSiYaLaTenemos() {
    try {
      if (!navigator.permissions || !navigator.permissions.query) return null;
      const p = await navigator.permissions.query({ name: 'geolocation' });
      if (p.state !== 'granted') return null;
      return await ubicacion({ timeout: 5000 });
    } catch (_) { return null; }
  }

  // --- Leer y escribir -----------------------------------------------------

  function rpc(nombre, cuerpo, token) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + nombre, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + (token || SUPABASE_KEY),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  async function cargarEstado() {
    try {
      const filas = await rpc('fn_estado_lugares', { p_place_keys: [lugar.clave] });
      const fila = (filas || [])[0];
      if (!fila || typeof fila.abierto !== 'boolean' || !fila.confirmado_at) {
        estado = null;
        return;
      }
      estado = {
        abierto: fila.abierto,
        cuando: new Date(fila.confirmado_at),
        confirmaciones: Number(fila.confirmaciones) || 1,
      };
    } catch (_) {
      // Esto adorna una ficha, no la sostiene: si falla, no se enseña nada.
      estado = null;
    }
  }

  async function confirmar(abierto) {
    // Si no sabemos dónde está, se le pregunta ahora: ha pulsado, así que el
    // aviso del navegador no le cae de sorpresa.
    let pos = posicion;
    if (!pos) pos = await ubicacion({ timeout: 8000 });
    const cerca = estaCerca(pos);

    yaConteste = true;
    fueDeLejos = !cerca;
    // Se pinta antes de que conteste el servidor, como la app. Pero solo se
    // pinta estado si la respuesta cuenta como estado: de lejos vale para el
    // horario, y decir «Abierto ahora, lo acabas de confirmar» sería mentira.
    if (cerca) {
      estado = {
        abierto: abierto,
        cuando: new Date(),
        confirmaciones: (estado ? estado.confirmaciones : 0) + 1,
      };
    }
    pintar();

    try {
      const token = await (sb() ? sb().auth.getSession()
        .then(function (r) { return r && r.data && r.data.session ? r.data.session.access_token : null; })
        .catch(function () { return null; }) : null);
      await rpc('fn_confirmar_estado', {
        p_place_key: lugar.clave,
        p_abierto: abierto,
        p_cerca: cerca,
        // El id de la cuenta: en la web se cuenta a la persona, no al aparato.
        p_device_id: usuario.id,
      }, token);
    } catch (_) {
      // Un fallo aquí no se le cuenta: puede ser el freno de un minuto del
      // servidor, y volver atrás lo pintado haría parecer que se perdió.
    }
  }

  // --- Textos --------------------------------------------------------------

  function haceCuanto(fecha) {
    const min = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000));
    if (min < 1) return 'ahora mismo';
    if (min < 60) return 'hace ' + min + ' min';
    const h = Math.round(min / 60);
    return h === 1 ? 'hace 1 hora' : 'hace ' + h + ' horas';
  }

  function detalleConfirmacion() {
    if (yaConteste) return 'lo acabas de confirmar';
    const cuando = haceCuanto(estado.cuando);
    if (estado.confirmaciones > 1) {
      return estado.confirmaciones + ' confirmaciones recientes · ' + cuando;
    }
    return 'una confirmación reciente · ' + cuando;
  }

  function vigente() {
    return estado && (Date.now() - estado.cuando.getTime()) < VENTANA_MS;
  }

  // --- Pintado -------------------------------------------------------------

  function linea(clase, icono, titulo, detalle) {
    const fila = el('div', 'abierto-linea ' + clase);
    fila.appendChild(el('span', 'abierto-icono', icono));
    const txt = el('span', 'abierto-texto');
    txt.appendChild(el('strong', null, titulo));
    if (detalle) txt.appendChild(el('span', 'abierto-detalle', detalle));
    fila.appendChild(txt);
    return fila;
  }

  function pintar() {
    if (!seccion) return;
    const cuerpo = seccion.querySelector('.abierto-cuerpo');
    cuerpo.textContent = '';

    if (vigente()) {
      cuerpo.appendChild(linea(
        estado.abierto ? 'es-si' : 'es-no',
        estado.abierto ? '✓' : '×',
        estado.abierto ? 'Abierto ahora' : 'Cerrado ahora',
        detalleConfirmacion()
      ));
      return;
    }

    // Contestó de lejos: su respuesta no pinta el estado de nadie, así que se
    // le dice la verdad en vez de dejar la pregunta como si no hubiera
    // pulsado. Mismas palabras que la app.
    if (yaConteste && fueDeLejos) {
      cuerpo.appendChild(linea('es-gracias', '♥', 'Gracias',
        'nos ayuda a saber el horario de este sitio'));
      return;
    }

    // La app pone encima de la pregunta «Debería estar abierto» cuando el
    // sitio trae `opening_hours`. Aquí no: interpretar ese campo (rangos,
    // festivos, «Mo-Fr 09:00-14:00,17:00-20:30») pide un analizador entero, y
    // uno a medias diría que un bar está abierto el 25 de diciembre. El
    // horario crudo ya se enseña en los datos de la ficha.

    const cerca = estaCerca(posicion);
    const pregunta = el('p', 'abierto-pregunta',
      cerca ? '¿Está abierto ahora?' : '¿Suele abrir a estas horas?');
    cuerpo.appendChild(pregunta);

    if (!usuario) {
      const b = el('button', 'abierto-entrar', 'Entrar con Google para contestar');
      b.type = 'button';
      b.addEventListener('click', entrar);
      cuerpo.appendChild(b);
      return;
    }

    const botones = el('div', 'abierto-botones');
    [['Sí', true], ['No', false]].forEach(function (par) {
      const b = el('button', 'abierto-boton', par[0]);
      b.type = 'button';
      b.addEventListener('click', function () {
        botones.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        confirmar(par[1]);
      });
      botones.appendChild(b);
    });
    // «No lo sé» y no una X: en la app era una X y no se entendía.
    const nose = el('button', 'abierto-nose', 'No lo sé');
    nose.type = 'button';
    nose.addEventListener('click', function () {
      yaConteste = true;
      fueDeLejos = true;
      pintar();
    });
    botones.appendChild(nose);
    cuerpo.appendChild(botones);
  }

  // --- Arranque ------------------------------------------------------------

  window.SeviAbierto = {
    iniciar(datos, donde) {
      lugar = datos;
      seccion = el('section', 'abierto');
      seccion.id = 'abierto';
      seccion.appendChild(el('h2', null, '\u00bfEst\u00e1 abierto?'));
      seccion.appendChild(el('div', 'abierto-cuerpo'));
      donde.appendChild(seccion);

      // Un mirador, una plaza o una fuente no se preguntan: se dice que
      // siempre se puede llegar, igual que la app.
      if (SIN_PUERTA.indexOf(datos.tipo) !== -1) {
        seccion.querySelector('.abierto-cuerpo').appendChild(
          linea('es-si', '\u2713', 'Siempre accesible', 'est\u00e1 en la calle'));
        return;
      }

      (async function () {
        posicion = await ubicacionSiYaLaTenemos();
        await cargarEstado();
        pintar();
      })();

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
    },
  };
})();
