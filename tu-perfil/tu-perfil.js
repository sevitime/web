// Tu perfil en la web: tu nivel, lo que guardas y lo que aportas.
//
// La gemela de `tu_perfil_screen.dart`, que es lo que la app abre al tocar tu
// avatar. En la web eso no existía: detrás del avatar solo había «Guardados»
// y «Salir», así que Mis reseñas, Mis rutas y Mis aportaciones no se podían
// ver desde un iPhone de ninguna manera. Es el hueco más grande que quedaba
// entre las dos (5-nov-2026).
//
// Los números del nivel salen de `fn_mis_puntos`, la misma función que usa la
// app en `ContribucionesService`: el nivel, su título, el puesto en el cuadro
// de honor y cuánto falta para el siguiente. Nada se calcula aquí, para que
// la web y la app no puedan decir cosas distintas.
//
// Las tres pantallas de «Lo tuyo» son páginas aparte, como en la app, donde
// se abren encima con su flecha de volver.
//
// El Pasaporte sí está desde el 5-nov-2026 (`/pasaporte/`), con el catálogo
// generado desde la app. De momento solo enseña: sellar sigue siendo cosa
// del móvil.
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

  const CHEVRON =
    '<svg class="tuyo-chevron" width="20" height="20" viewBox="0 0 24 24" ' +
    'fill="currentColor" aria-hidden="true"><path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z"/></svg>';

  // Una fila con su icono, su explicación y el chevrón: toda la fila es el
  // destino, como las de la app.
  function fila(href, emoji, titulo, nota) {
    const a = el('a', 'tuyo-fila');
    a.href = href;
    const ico = el('span', 'tuyo-ico', emoji);
    ico.setAttribute('aria-hidden', 'true');
    a.appendChild(ico);
    const txt = el('span', 'tuyo-txt');
    txt.appendChild(el('strong', null, titulo));
    if (nota) txt.appendChild(el('span', null, nota));
    a.appendChild(txt);
    a.insertAdjacentHTML('beforeend', CHEVRON);
    return a;
  }

  function pintarFilas(hueco, filas) {
    hueco.textContent = '';
    filas.forEach((f) => hueco.appendChild(f));
  }

  // Las tres pestañas de Guardados, con las mismas palabras que la app.
  function pintarGuardados() {
    pintarFilas($('guardados'), [
      fila('/guardados/?t=favoritos', '♥', 'Favoritos', 'Los sitios que te han gustado'),
      fila('/guardados/?t=pendientes', '🔖', 'Quiero ir', 'Lo que tienes pendiente de visitar'),
      fila('/guardados/?t=visitas', '✓', 'Ya he ido', 'Donde ya has estado'),
    ]);
  }

  function pintarLoTuyo() {
    pintarFilas($('lotuyo'), [
      fila('/pasaporte/', '🛂', 'Pasaporte', 'Los sellos de Sevilla que llevas'),
      fila('/mis-resenas/', '✍️', 'Mis reseñas', 'Lo que has escrito y en qué ha quedado'),
      fila('/mis-rutas/', '🧭', 'Mis rutas', 'Las que has creado'),
      fila('/mis-aportaciones/', '📍', 'Mis aportaciones', 'Los sitios y datos que has aportado'),
    ]);
  }

  function pintarPublico(user) {
    const hueco = $('publico');
    if (!user) { hueco.textContent = ''; return; }
    pintarFilas(hueco, [
      fila('/perfil/', '🙂', 'Ver tu perfil público', 'Lo que ve el resto de la gente'),
      fila('/ajustes/', '⚙️', 'Ajustes', 'Avisos, cuenta y datos'),
    ]);
  }

  function inicial(user) {
    const m = user.user_metadata || {};
    const n = m.full_name || m.name || user.email || '?';
    return (n.charAt(0) || '?').toUpperCase();
  }

  function nombreDe(user) {
    const m = user.user_metadata || {};
    return m.full_name || m.name || (user.email || '').split('@')[0] || 'Tú';
  }

  function avatarDe(user) {
    const m = user.user_metadata || {};
    return m.avatar_url || m.picture || '';
  }

  function pintarNivelVacio() {
    const caja = $('nivel');
    caja.textContent = '';
    const dentro = el('div', 'nivel-entrar');
    dentro.appendChild(el('p', null,
      'Entra con Google y aquí tendrás tu nivel, tus reseñas, tus rutas y lo que has aportado. Es la misma cuenta que la de la app.'));
    const b = el('button', 'auth-entrar', 'Entrar con Google');
    b.type = 'button';
    b.addEventListener('click', function () {
      // El botón de la cabecera ya sabe entrar y volver a esta misma página;
      // aquí no se repite esa lógica, se usa la que hay.
      const entrar = document.querySelector('#auth-seccion .auth-entrar');
      if (entrar) { entrar.click(); return; }
      const ir = () => sb().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (sb()) ir();
      else if (window.SEVI && window.SEVI.conSupabase) window.SEVI.conSupabase(ir);
    });
    dentro.appendChild(b);
    caja.appendChild(dentro);
  }

  function pintarNivel(user, puntos) {
    const caja = $('nivel');
    caja.textContent = '';

    const filaArriba = el('div', 'nivel-fila');
    const foto = avatarDe(user);
    if (foto) {
      const img = document.createElement('img');
      img.className = 'nivel-avatar';
      img.src = foto;
      img.alt = '';
      img.width = 54;
      img.height = 54;
      img.referrerPolicy = 'no-referrer';
      filaArriba.appendChild(img);
    } else {
      filaArriba.appendChild(el('div', 'nivel-avatar', inicial(user)));
    }

    const quien = el('div', 'nivel-quien');
    quien.appendChild(el('strong', null, nombreDe(user)));
    if (puntos) {
      quien.appendChild(el('span', null,
        'Nivel ' + puntos.nivel + (puntos.titulo ? ' · ' + puntos.titulo : '')));
    }
    filaArriba.appendChild(quien);
    caja.appendChild(filaArriba);

    // Sin respuesta del servidor se queda la ficha sin barra: mejor que
    // inventar un nivel o dejar la página en blanco.
    if (!puntos) {
      caja.appendChild(el('p', 'nivel-pie', 'No se han podido leer tus puntos ahora mismo.'));
      return;
    }

    const inicio = puntos.xp_inicio_nivel || 0;
    const fin = puntos.xp_fin_nivel || 0;
    const tramo = Math.max(1, fin - inicio);
    const hecho = Math.min(Math.max(puntos.xp - inicio, 0), tramo);

    const barra = el('div', 'nivel-barra');
    const relleno = el('div', 'nivel-relleno');
    relleno.style.width = Math.round((hecho / tramo) * 100) + '%';
    barra.appendChild(relleno);
    // La barra es decoración de lo que ya dice el texto de abajo.
    barra.setAttribute('aria-hidden', 'true');
    caja.appendChild(barra);

    const pie = el('div', 'nivel-pie');
    const falta = Math.max(fin - puntos.xp, 0);
    pie.appendChild(el('span', null,
      puntos.xp + ' puntos' + (fin > inicio && falta > 0
        ? ' · ' + falta + ' para ' + (puntos.siguiente_titulo || 'el siguiente nivel')
        : '')));
    if (puntos.en_ranking && puntos.posicion) {
      const a = el('a', null, 'Puesto ' + puntos.posicion + ' en el cuadro de honor');
      a.href = '/ranking/';
      pie.appendChild(a);
    }
    caja.appendChild(pie);
  }

  async function leerPuntos() {
    try {
      const { data, error } = await sb().rpc('fn_mis_puntos');
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    } catch (_) {
      return null;
    }
  }

  // Las filas no dependen de la sesión: se pintan ya, y así la página no
  // aparece vacía mientras se resuelve quién eres. Cada destino pide cuenta
  // por su cuenta si hace falta, igual que en la app.
  pintarGuardados();
  pintarLoTuyo();

  async function cambioDeSesion(user) {
    if (!user) {
      pintarNivelVacio();
      pintarPublico(null);
      return;
    }
    pintarPublico(user);
    pintarNivel(user, await leerPuntos());
  }

  window.SEVI.onAuth.push(cambioDeSesion);
  const cliente = sb();
  if (cliente) {
    cliente.auth.getSession()
      .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
      .catch(() => cambioDeSesion(null));
  } else if (!haySesionGuardada()) {
    // Sin sesión guardada, `auth.js` ni carga Supabase ni avisa: hay que
    // pintar el «entra» sin esperar un aviso que no va a llegar.
    cambioDeSesion(null);
  }

  // La misma comprobación que hace `auth.js`: la clave de supabase-js es
  // `sb-<ref>-auth-token`, a veces troceada.
  function haySesionGuardada() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        if (clave && clave.indexOf('sb-') === 0 && clave.indexOf('-auth-token') !== -1) {
          return true;
        }
      }
    } catch (_) { /* almacenamiento bloqueado: trátalo como sin sesión */ }
    return false;
  }
})();
