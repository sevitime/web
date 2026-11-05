// El Pasaporte en la web: los sellos que llevas y los que te faltan.
//
// La gemela de `PassportScreen`. Lee `passport_stamps`, la misma tabla que
// sincroniza la app, así que un sello conseguido en el móvil sale aquí y al
// revés. El catálogo (nombres, colores, pistas y los trazados de los iconos)
// está en `sellos.js`, que se **genera** desde el repo de la app con
// `node tool/actualizar_sellos.mjs`: no hay dos listas que mantener.
//
// Los iconos son los mismos dibujos que el móvil, sacados de la fuente
// Material Icons del SDK de Flutter, y no emoji. En Rutas la web sí usa
// emoji, pero allí son doce y aquí son veinticinco en una rejilla: una
// rejilla de emoji al lado de unos candados no se lee como un pasaporte.
//
// Sellar también se hace desde la web desde el 5-nov-2026, en la ficha del
// sitio (`lugar/sellar.js`): menos de 30 metros y a pie, las reglas de la
// app. Esta página solo enseña la colección.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;
  const $ = (id) => document.getElementById(id);
  const SELLOS = window.sevitimeSellos || [];

  // El de monumentos, para un sello que llegue sin trazado (ver el script
  // que genera `sellos.js`). Mismo criterio que `iconoDeSello` en la app.
  const ICONO_POR_DEFECTO = SELLOS.find((s) => s.id === 'casa_pilatos');

  const CANDADO = 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0' +
    ' 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34' +
    ' 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z';

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function svg(d) {
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" ' +
      'aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function tarjeta(sello, fecha) {
    const li = el('li', 'pas-sello' + (fecha ? '' : ' falta'));

    const ico = el('div', 'pas-ico');
    if (fecha) {
      ico.style.background = sello.color;
      ico.innerHTML = svg(sello.d || (ICONO_POR_DEFECTO && ICONO_POR_DEFECTO.d) || '');
    } else {
      // Un candado dice «te falta» sin tener que leer nada.
      ico.innerHTML = svg(CANDADO);
    }
    li.appendChild(ico);

    li.appendChild(el('span', 'pas-nombre', sello.label));
    if (fecha) {
      li.appendChild(el('span', 'pas-cuando', 'Sellado el ' + cuando(fecha)));
    } else if (sello.hint) {
      li.appendChild(el('span', 'pas-pista', sello.hint));
    }
    return li;
  }

  function pintar(conseguidos, user) {
    const rejilla = $('rejilla');
    const faltan = $('faltan');
    const aviso = $('aviso');
    rejilla.textContent = '';

    const total = SELLOS.length;
    const cuantos = conseguidos ? Object.keys(conseguidos).length : 0;

    if (!user) {
      faltan.textContent = total + ' sellos por conseguir';
      $('relleno').style.width = '0';
    } else if (conseguidos === null) {
      faltan.textContent = 'No se han podido leer tus sellos ahora mismo';
      $('relleno').style.width = '0';
    } else if (cuantos >= total) {
      faltan.textContent = '🎉 ¡Colección completa!';
      faltan.classList.add('completo');
      $('relleno').style.width = '100%';
    } else {
      faltan.textContent = (total - cuantos) + ' sellos por conseguir';
      $('relleno').style.width = Math.round((cuantos / total) * 100) + '%';
    }

    // Los conseguidos primero y los que faltan después, como en la app: lo
    // tuyo delante y lo que te queda detrás, que es lo que invita a seguir.
    const hechos = SELLOS.filter((s) => conseguidos && conseguidos[s.id]);
    const pendientes = SELLOS.filter((s) => !conseguidos || !conseguidos[s.id]);
    hechos.forEach((s) => rejilla.appendChild(tarjeta(s, conseguidos[s.id])));
    pendientes.forEach((s) => rejilla.appendChild(tarjeta(s, null)));

    aviso.hidden = false;
    aviso.textContent = '';
    if (!user) {
      aviso.appendChild(el('strong', null, 'Entra con Google para ver tus sellos. '));
      aviso.appendChild(document.createTextNode(
        'Son los mismos que los del móvil: la cuenta es la misma.'));
    } else {
      aviso.appendChild(el('strong', null, 'Los sellos se consiguen yendo. '));
      aviso.appendChild(document.createTextNode(
        'Abre la ficha de uno de estos sitios estando a menos de 30 metros y pulsa «Sellar». ' +
        'Vale desde aquí o desde la app: es el mismo pasaporte.'));
    }
  }

  async function cargar(user) {
    try {
      const { data, error } = await sb()
        .from('passport_stamps')
        .select('stamp_id, collected_at')
        .eq('user_id', user.id);
      if (error) throw error;
      const mapa = {};
      (data || []).forEach((f) => { mapa[f.stamp_id] = f.collected_at; });
      return mapa;
    } catch (_) {
      return null;   // null = no se ha podido leer, distinto de «ninguno»
    }
  }

  // El «¿cómo funciona?» del carné, que en la app es una hoja. Aquí se
  // despliega en el sitio: son tres frases, no hace falta tapar la pantalla.
  const boton = $('como');
  boton.addEventListener('click', function () {
    const pasos = $('pasos');
    const abierto = !pasos.hidden;
    pasos.hidden = abierto;
    boton.setAttribute('aria-expanded', String(!abierto));
  });

  async function cambioDeSesion(user) {
    if (!user) { pintar(null, null); return; }
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
