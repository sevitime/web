// Sellar un sitio desde la web: el botón que rellena el Pasaporte.
//
// Hasta el 5-nov-2026 la web solo **enseñaba** el pasaporte (`/pasaporte/`):
// los sellos se conseguían únicamente con la app, así que con un iPhone se
// podía ver la colección y no tocarla. Esto cierra eso.
//
// LAS REGLAS SON LAS DE LA APP (`detail_screen.dart`), no unas nuevas:
//
//   * **Menos de 30 metros** del sitio. Es lo que separa «he estado» de «he
//     pasado por la calle de al lado».
//   * **Menos de 20 km/h.** Un sello no se consigue desde el coche. Si el
//     navegador no da velocidad —casi siempre, fuera del móvil— se toma como
//     0, igual que la app cuando no hay última posición conocida.
//   * **Qué sello toca lo decide `stampForPlace`**, portado tal cual: si el
//     sitio es de una familia turística y cae dentro del radio de un
//     monumento, ese monumento (y si cae en dos, el más cercano: la Giralda
//     y la Catedral están a 61 m); si no, el sello genérico de su tipo. Solo
//     la distancia no vale, que la Cervecería Giralda está a cuarenta metros
//     de la Giralda.
//   * **Cada sello, una vez.** La tabla tiene `UNIQUE (user_id, stamp_id)` y
//     aquí se hace `upsert`, como la app.
//
// LO QUE SÍ CAMBIA, Y A PROPÓSITO: la app mira tu posición sola al abrir la
// ficha y enseña el botón si estás cerca. La web **no pide la ubicación
// hasta que pulsas**. En un navegador, un aviso de permiso que salta solo en
// cada ficha es lo que hace que la gente diga que no para siempre, y
// entonces no funciona ni esto ni «lo que tengo cerca». Así que el botón se
// ve siempre y la comprobación ocurre al tocarlo.
//
// Hace falta sesión: un sello sin cuenta se quedaría en este navegador y no
// sería tuyo en el móvil.
(function () {
  'use strict';

  const METROS_MAXIMOS = 30;
  const KMH_MAXIMOS = 20;

  const sb = () => window.SEVI && window.SEVI.sb;

  let lugar = null;
  let usuario = null;
  let sello = null;
  let conseguido = false;
  let seccion = null;

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // Metros entre dos coordenadas (haversine). `lugares.js` ya trae `metros`,
  // pero esto tiene que funcionar aunque esa librería cambie de nombre.
  function metros(aLat, aLon, bLat, bLon) {
    const R = 6371000;
    const r = Math.PI / 180;
    const dLat = (bLat - aLat) * r;
    const dLon = (bLon - aLon) * r;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Portado de `PassportService.stampForPlace`.
  function selloDelLugar(p) {
    const sellos = window.sevitimeSellos || [];
    const visitables = window.sevitimeTiposVisitables || [];

    if (p.tipo && visitables.indexOf(p.tipo) !== -1) {
      let mejor = null;
      let mejorM = Infinity;
      for (const s of sellos) {
        if (s.lat == null || s.radio == null) continue;
        const m = metros(p.lat, p.lon, s.lat, s.lon);
        if (m <= s.radio && m < mejorM) { mejor = s; mejorM = m; }
      }
      if (mejor) return mejor;
    }
    for (const s of sellos) {
      if (s.tipos && s.tipos.indexOf(p.tipo) !== -1) return s;
    }
    return null;
  }

  function donde() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error('sin-gps')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      });
    });
  }

  async function sellar(boton, aviso) {
    boton.disabled = true;
    aviso.textContent = 'Mirando dónde estás…';
    aviso.className = 'sellar-aviso';

    let pos;
    try {
      pos = await donde();
    } catch (e) {
      boton.disabled = false;
      aviso.className = 'sellar-aviso malo';
      aviso.textContent = e && e.code === 1
        ? 'Hace falta tu ubicación para sellar, y no la has dado. Puedes activarla para este sitio en los ajustes del navegador.'
        : 'No se ha podido saber dónde estás. Prueba otra vez en un momento.';
      return;
    }

    const m = metros(pos.coords.latitude, pos.coords.longitude, lugar.lat, lugar.lon);
    const kmh = (pos.coords.speed != null && pos.coords.speed >= 0)
      ? pos.coords.speed * 3.6 : 0;

    if (m > METROS_MAXIMOS) {
      boton.disabled = false;
      aviso.className = 'sellar-aviso malo';
      aviso.textContent = 'Estás a ' + Math.round(m) + ' m. Para sellar hay que estar a menos de ' +
        METROS_MAXIMOS + ' m del sitio.';
      return;
    }
    if (kmh >= KMH_MAXIMOS) {
      boton.disabled = false;
      aviso.className = 'sellar-aviso malo';
      aviso.textContent = 'Parece que vas en algún vehículo. Los sellos se consiguen a pie.';
      return;
    }

    try {
      const { error } = await sb().from('passport_stamps')
        .upsert({ user_id: usuario.id, stamp_id: sello.id },
          { onConflict: 'user_id,stamp_id' });
      if (error) throw error;
    } catch (_) {
      boton.disabled = false;
      aviso.className = 'sellar-aviso malo';
      aviso.textContent = 'No se ha podido guardar el sello. Prueba otra vez.';
      return;
    }

    conseguido = true;
    pintar();
  }

  function entrar() {
    const ir = () => sb().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname + window.location.search },
    });
    if (sb()) ir();
    else if (window.SEVI && window.SEVI.conSupabase) window.SEVI.conSupabase(ir);
  }

  function pintar() {
    if (!seccion) return;
    const cuerpo = seccion.querySelector('.sellar-cuerpo');
    cuerpo.textContent = '';

    const ficha = el('div', 'sellar-ficha');
    const ico = el('span', 'sellar-ico');
    ico.setAttribute('aria-hidden', 'true');
    ico.style.background = conseguido ? sello.color : 'var(--fondo)';
    ico.style.color = conseguido ? '#fff' : 'var(--tenue)';
    ico.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="' + (sello.d || '') + '"/></svg>';
    ficha.appendChild(ico);

    const txt = el('div', 'sellar-txt');
    txt.appendChild(el('strong', null, sello.label));
    txt.appendChild(el('span', null, conseguido
      ? 'Ya tienes este sello'
      : (sello.hint || 'Un sello del Pasaporte de Sevilla')));
    ficha.appendChild(txt);
    cuerpo.appendChild(ficha);

    const aviso = el('p', 'sellar-aviso');

    if (conseguido) {
      const a = el('a', 'sellar-enlace', 'Ver tu pasaporte');
      a.href = '/pasaporte/';
      cuerpo.appendChild(a);
      cuerpo.appendChild(aviso);
      return;
    }

    if (!usuario) {
      const b = el('button', 'sellar-boton', 'Entrar para sellar');
      b.type = 'button';
      b.addEventListener('click', entrar);
      cuerpo.appendChild(b);
      aviso.textContent = 'Los sellos van con tu cuenta, para que salgan también en el móvil.';
      cuerpo.appendChild(aviso);
      return;
    }

    const b = el('button', 'sellar-boton', 'Sellar');
    b.type = 'button';
    b.addEventListener('click', function () { sellar(b, aviso); });
    cuerpo.appendChild(b);
    aviso.textContent = 'Hay que estar a menos de ' + METROS_MAXIMOS +
      ' m. Al pulsar se te pedirá la ubicación.';
    cuerpo.appendChild(aviso);
  }

  async function yaLoTengo() {
    if (!usuario || !sello) return false;
    try {
      const { data, error } = await sb().from('passport_stamps')
        .select('stamp_id').eq('user_id', usuario.id).eq('stamp_id', sello.id).limit(1);
      if (error) throw error;
      return !!(data && data.length);
    } catch (_) {
      return false;   // si no se sabe, se ofrece sellar: el UNIQUE protege
    }
  }

  window.SeviSellar = {
    iniciar(datos, hueco) {
      if (!hueco) return;
      lugar = datos;
      sello = selloDelLugar(datos);
      // Un sitio que no da ningún sello no enseña nada: ni sección vacía ni
      // «este sitio no tiene sello», que sería ruido en la mayoría de fichas.
      if (!sello) return;

      seccion = el('section', 'sellar');
      seccion.id = 'sellar';
      seccion.appendChild(el('h2', null, 'Pasaporte'));
      seccion.appendChild(el('div', 'sellar-cuerpo'));
      hueco.appendChild(seccion);
      pintar();

      let ultimoId = false;
      async function cambioDeSesion(user) {
        const id = user ? user.id : null;
        if (id === ultimoId) return;
        ultimoId = id;
        usuario = user;
        conseguido = await yaLoTengo();
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
