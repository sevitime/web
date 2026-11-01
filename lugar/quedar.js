// «Quedar aquí» desde la web: manda a quien quieras un enlace que dice dónde
// estás y caduca.
//
// Gemelo de `quedar_aqui_sheet.dart` en la app, con sus mismas reglas y sus
// mismas palabras. Hasta el 1-nov-2026 la web solo sabía **abrir** un punto
// que te mandaran (`/encuentro/?p=…`); crearlo pedía la app, así que con un
// iPhone podías ir a donde te citaran pero no citar a nadie.
//
// Lo importante, y es lo mismo que allí:
//
//   * **No se comparte la ubicación de nadie.** Lo que viaja es *este sitio*,
//     el que se tiene abierto, con las coordenadas públicas que ya están en
//     la ficha. Aquí no se mide dónde estás: tú dices dónde quedas. Por eso
//     esto no pide permiso de ubicación.
//   * **El plazo, el caducar y el «uno por persona» los decide el servidor**
//     (`docs/sql/punto_de_encuentro.sql`): de 15 a 180 minutos, y crear uno
//     termina el anterior. Aquí solo se ofrecen 30, 60 y 120, como en la app.
//   * **Se avisa de que sustituye al anterior antes de hacerlo**, no después,
//     y se puede terminar el que haya: la política de privacidad promete que
//     se puede, así que tiene que poderse desde donde se crea.
//
// Compartir: en el móvil, la hoja del sistema (`navigator.share`). En
// escritorio no la hay, así que se copia el enlace y se dice. Es la misma
// decisión que `compartirPuntoEncuentro` toma en la app.
(function () {
  'use strict';

  // Media hora para «estoy aquí ya», una para lo normal, dos para «luego nos
  // vemos». Mismos plazos que la app; la base acepta de 15 a 180.
  const PLAZOS = [30, 60, 120];
  const POR_DEFECTO = 60;
  const MAX_NOTA = 80;

  const sb = () => window.SEVI && window.SEVI.sb;

  let lugar = null;
  let usuario = null;
  let seccion = null;
  let enPie = null;   // el punto que ya tiene en pie, si tiene alguno
  let minutos = POR_DEFECTO;

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

  // --- Lo que ya hay -------------------------------------------------------

  // El punto activo de quien tiene la sesión abierta. La RLS solo deja ver
  // los propios (`puntos_encuentro_lee_propios`), así que esto no puede
  // enseñar el de nadie más.
  async function cargarEnPie() {
    enPie = null;
    if (!usuario) return;
    try {
      const { data } = await sb()
        .from('puntos_encuentro')
        .select('id, nombre, place_key, lat, lon, nota, caduca')
        .gt('caduca', new Date().toISOString())
        .order('caduca', { ascending: false })
        .limit(1);
      const fila = data && data[0];
      if (fila) enPie = fila;
    } catch (_) { /* si no se puede leer, se ofrece crear uno igualmente */ }
  }

  // --- Textos --------------------------------------------------------------

  function etiquetaPlazo(m) {
    if (m < 60) return m + ' minutos';
    const horas = Math.floor(m / 60);
    return horas === 1 ? '1 hora' : horas + ' horas';
  }

  // Cuánto queda, para decirlo sin reloj. Se redondea hacia arriba, como en
  // la app: truncando, un punto de una hora decía «59 minutos» recién creado.
  function loQueQueda(caducaIso) {
    const segundos = (new Date(caducaIso) - new Date()) / 1000;
    const m = Math.ceil(segundos / 60);
    if (m <= 0) return 'se ha terminado';
    if (m < 60) return m + ' minutos';
    const horas = Math.floor(m / 60);
    const resto = m % 60;
    if (resto === 0) return horas === 1 ? '1 hora' : horas + ' horas';
    return horas + 'h ' + resto + 'min';
  }

  function enlaceDe(id) {
    return 'https://sevitime.com/encuentro/?p=' + id;
  }

  // El mismo mensaje que manda la app. Una nota vacía no es una nota: sin
  // esto decía «Estoy en Taberna Coloniales ()».
  function mensajeDe(punto) {
    const pista = (punto.nota || '').trim();
    const nota = pista ? ' (' + pista + ')' : '';
    return 'Estoy en ' + punto.nombre + nota + '. ' +
      'Te espero ' + loQueQueda(punto.caduca) + ':\n' + enlaceDe(punto.id);
  }

  // --- Acciones ------------------------------------------------------------

  async function compartir(punto, aviso) {
    const texto = mensajeDe(punto);
    // En el móvil, la hoja del sistema. En escritorio no existe, así que se
    // copia: un punto de encuentro no se manda por correo.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Quedamos en ' + punto.nombre, text: texto });
        return;
      } catch (_) {
        // Cancelar el compartir no es un fallo; se cae al portapapeles.
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      aviso.textContent = 'Enlace copiado. Pégalo donde quieras.';
    } catch (_) {
      aviso.textContent = 'Copia este enlace: ' + enlaceDe(punto.id);
    }
  }

  async function crear(nota, aviso, boton) {
    boton.disabled = true;
    aviso.textContent = 'Creando el punto…';
    try {
      const { data, error } = await sb().rpc('fn_crear_punto_encuentro', {
        p_place_key: lugar.clave,
        p_nombre: lugar.nombre,
        p_lat: lugar.lat,
        p_lon: lugar.lon,
        p_nota: nota ? nota : null,
        p_minutos: minutos,
      });
      if (error) throw error;
      if (typeof data !== 'string' || !data) throw new Error('sin id');

      const punto = {
        id: data,
        nombre: lugar.nombre,
        nota: nota,
        caduca: new Date(Date.now() + minutos * 60000).toISOString(),
      };
      await cargarEnPie();
      pintar();
      const nuevoAviso = seccion.querySelector('.quedar-aviso');
      await compartir(punto, nuevoAviso);
      if (!nuevoAviso.textContent) {
        nuevoAviso.textContent = 'Punto de encuentro creado.';
      }
    } catch (_) {
      boton.disabled = false;
      aviso.textContent = 'No se ha podido crear el punto de encuentro.';
    }
  }

  async function terminar(aviso, boton) {
    boton.disabled = true;
    aviso.textContent = 'Terminando…';
    try {
      const { data, error } = await sb().rpc('fn_cancelar_punto_encuentro');
      if (error) throw error;
      await cargarEnPie();
      pintar();
      seccion.querySelector('.quedar-aviso').textContent = data === true
        ? 'Punto de encuentro terminado. El enlace ya no vale.'
        : 'No había ningún punto en pie.';
    } catch (_) {
      boton.disabled = false;
      aviso.textContent = 'No se ha podido terminar. Inténtalo más tarde.';
    }
  }

  // --- Pintado -------------------------------------------------------------

  function pintarEnPie(cuerpo, aviso) {
    const caja = el('div', 'quedar-en-pie');
    const mismoSitio = enPie.place_key === lugar.clave;
    caja.appendChild(el('p', 'quedar-en-pie-texto',
      (mismoSitio ? 'Ya has quedado aquí' : 'Ya has quedado en ' + enPie.nombre) +
      ', y te esperan ' + loQueQueda(enPie.caduca) + '.'));

    const acciones = el('div', 'quedar-acciones');
    const reenviar = el('button', 'quedar-btn', 'Reenviar el enlace');
    reenviar.type = 'button';
    reenviar.addEventListener('click', function () {
      compartir({
        id: enPie.id, nombre: enPie.nombre, nota: enPie.nota, caduca: enPie.caduca,
      }, aviso);
    });
    const fin = el('button', 'quedar-btn peligro', 'Terminar ya');
    fin.type = 'button';
    fin.addEventListener('click', function () { terminar(aviso, fin); });
    acciones.append(reenviar, fin);
    caja.appendChild(acciones);
    cuerpo.appendChild(caja);
  }

  function formulario(cuerpo, aviso) {
    cuerpo.appendChild(el('p', 'quedar-nota',
      'Se manda un enlace con ' + lugar.nombre + ' y la hora hasta la que ' +
      'esperas. No se comparte tu ubicación: se comparte este sitio.'));

    cuerpo.appendChild(el('p', 'quedar-etiqueta', 'Hasta cuándo esperas'));
    const chips = el('div', 'quedar-chips');
    chips.setAttribute('role', 'radiogroup');
    chips.setAttribute('aria-label', 'Hasta cuándo esperas');
    PLAZOS.forEach(function (m) {
      const b = el('button', 'chip' + (m === minutos ? ' seleccionado' : ''), etiquetaPlazo(m));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', m === minutos ? 'true' : 'false');
      b.addEventListener('click', function () {
        minutos = m;
        chips.querySelectorAll('.chip').forEach(function (c) {
          c.classList.remove('seleccionado');
          c.setAttribute('aria-checked', 'false');
        });
        b.classList.add('seleccionado');
        b.setAttribute('aria-checked', 'true');
      });
      chips.appendChild(b);
    });
    cuerpo.appendChild(chips);

    const pista = document.createElement('input');
    pista.type = 'text';
    pista.className = 'quedar-campo';
    pista.maxLength = MAX_NOTA;
    pista.placeholder = 'Una pista (opcional): en la terraza, al fondo…';
    pista.setAttribute('aria-label', 'Una pista, opcional');
    cuerpo.appendChild(pista);

    cuerpo.appendChild(el('p', 'quedar-nota',
      '🕐 El enlace deja de valer solo, y no queda guardado dónde has quedado.'));

    const crearBtn = el('button', 'quedar-btn primario',
      enPie ? 'Sustituir por este' : 'Compartir el punto');
    crearBtn.type = 'button';
    crearBtn.addEventListener('click', function () {
      crear(pista.value.trim(), aviso, crearBtn);
    });
    cuerpo.appendChild(crearBtn);
  }

  function pintar() {
    if (!seccion) return;
    const cuerpo = seccion.querySelector('.quedar-cuerpo');
    cuerpo.textContent = '';
    const aviso = el('p', 'quedar-aviso', '');
    aviso.setAttribute('role', 'status');

    if (!usuario) {
      cuerpo.appendChild(el('p', 'quedar-nota',
        'Manda a quien quieras un enlace que dice dónde estás y caduca solo. ' +
        'No se comparte tu ubicación: se comparte este sitio.'));
      const b = el('button', 'quedar-btn primario', 'Entrar con Google para quedar');
      b.type = 'button';
      b.addEventListener('click', entrar);
      cuerpo.appendChild(b);
      cuerpo.appendChild(aviso);
      return;
    }

    // El que ya está en pie va primero: uno nuevo lo sustituye, y eso no se
    // puede descubrir a base de sorpresas.
    if (enPie) pintarEnPie(cuerpo, aviso);
    formulario(cuerpo, aviso);
    cuerpo.appendChild(aviso);
  }

  // --- Arranque ------------------------------------------------------------

  window.SeviQuedar = {
    iniciar(datos, donde) {
      lugar = datos;
      seccion = el('section', 'quedar');
      seccion.id = 'quedar';
      seccion.appendChild(el('h2', null, 'Quedar aquí'));
      seccion.appendChild(el('div', 'quedar-cuerpo'));
      donde.appendChild(seccion);
      pintar();

      let ultimoId = false;
      async function cambioDeSesion(user) {
        const id = user ? user.id : null;
        if (id === ultimoId) return;
        ultimoId = id;
        usuario = user;
        await cargarEnPie();
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
