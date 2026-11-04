// Explorar en la web: los sitios que tienes cerca, como en la app.
//
// Hasta el 1-nov-2026 `/explorar/` era una redirección a `/mapa/`, que es un
// editor del mapa, no una lista. Quien entra desde un iPhone —donde no hay
// app— no tenía la pantalla principal de SeviTime en ninguna parte.
//
// Qué hace, y es a propósito el mismo criterio que `HomeScreen` en la app:
//
//   * La ubicación la da el **navegador** (`navigator.geolocation`), solo
//     cuando se pulsa. Nunca se envía a ningún sitio: se usa aquí para medir
//     distancias y ordenar.
//   * Sin ubicación NO se dice «cerca de ti»: se dice que la lista sale del
//     centro de Sevilla y se ordena por valoración, igual que hace la app en
//     escritorio (ver `CercaDeTiHeader`). Llamarlo «cerca» sería mentir.
//   * Los sitios salen de la **foto diaria** (`lugares.js`, la misma que lee
//     la app) con las altas manuales, los ocultos y las fusiones ya
//     aplicadas. No se habla con Overpass.
//   * «Todos» no enseña cajeros ni farmacias (`TIPOS_DE_TODO`): tienen su
//     propio chip, igual que en la app.
//   * Los chips son `FILTROS_EXPLORAR`, espejo de los de Explorar de la app
//     (`categorias_chips.dart`), NO los de la lupa (`FILTROS`). Por eso
//     bares, restaurantes y cafés van juntos en «Hostelería»: aquí se ojea
//     «dónde comer o tomar algo»; en la lupa ya sabes qué buscas.
//
// Lo que esta página NO hace: mapa (está en `/mapa/`, y cargarlo aquí son
// 600 KB más en datos móviles), «¿está abierto?», guardar ni modo
// explorador. Ver `docs/paridad_app_web.md` en el repo de la app.
(function () {
  'use strict';

  const L = window.sevitimeLugares;

  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  // De cuántos en cuántos crece la lista. La app amplía sola al acercarse al
  // final en vez de obligar a pulsar, y aquí igual.
  const POR_TANDA = 20;

  // Los mismos radios que los chips de la app (`filtros_sheet_content.dart`).
  const RADIOS = [500, 1000, 3000, 5000, 6000];
  const RADIO_POR_DEFECTO = 3000;

  // Hasta dónde se considera que alguien está «en Sevilla». Más lejos, su
  // posición real no sirve para nada: no hay sitios que enseñar.
  const LEJOS = 60000;

  const estado = {
    origen: { lat: L.SEVILLA.lat, lon: L.SEVILLA.lon },
    ubicacionReal: false,
    filtro: 'todos',
    orden: 'valoracion',
    radio: RADIO_POR_DEFECTO,
    texto: '',
    visibles: POR_TANDA,
    sitios: null,
    notas: new Map(),
  };

  const $ = (id) => document.getElementById(id);
  const lista = $('lista');
  const resumen = $('resumen');
  const avisoUbicacion = $('aviso-ubicacion');

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // --- Datos ----------------------------------------------------------------

  // La nota de cada sitio. Son menos de cien filas en toda la base, así que
  // se piden de una vez en lugar de trocear por clave como hace la app (allí
  // la URL del `in.(...)` se pasaba de largo).
  function cargarNotas() {
    return fetch(SUPABASE_URL + '/rest/v1/place_ratings' +
      '?select=place_key,average_rating,vote_count,score&limit=1000', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((filas) => {
        const mapa = new Map();
        (filas || []).forEach((f) => {
          if (!f.place_key) return;
          mapa.set(f.place_key, {
            media: Number(f.average_rating) || 0,
            votos: Number(f.vote_count) || 0,
            // `score` es la media bayesiana que calcula el servidor y con la
            // que la app ordena «Valoración». Nunca se enseña como número.
            score: Number(f.score) || 0,
          });
        });
        return mapa;
      })
      .catch(() => new Map());
  }

  // --- Ubicación ------------------------------------------------------------

  function pedirUbicacion() {
    const boton = $('btn-ubicacion');
    if (!navigator.geolocation) {
      avisar('Tu navegador no sabe darnos tu ubicación. La lista sale del centro de Sevilla.');
      return;
    }
    boton.disabled = true;
    boton.textContent = 'Buscando dónde estás…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          // Se guardan para poder contarle a quien modera lo fiable que es
          // el punto cuando desde aquí se sugiere un sitio.
          precisionM: pos.coords.accuracy,
          tomadoEl: pos.timestamp,
        };
        const aSevilla = L.metros(punto, L.SEVILLA);
        if (aSevilla > LEJOS) {
          // Está fuera de la provincia: su posición es correcta y aun así no
          // sirve. Decirlo es mejor que enseñar una lista de sitios «a 230
          // km».
          volverAlBoton(boton);
          avisar('Estás a ' + L.formatDist(aSevilla) + ' de Sevilla, y SeviTime ' +
            'solo cubre Sevilla y su provincia. La lista sale del centro de la ciudad.');
          return;
        }
        estado.origen = punto;
        estado.ubicacionReal = true;
        estado.orden = 'distancia';
        estado.visibles = POR_TANDA;
        $('orden').value = 'distancia';
        $('ubicacion-caja').hidden = true;
        avisoUbicacion.hidden = true;
        guardarPermiso();
        pintar();
      },
      (err) => {
        volverAlBoton(boton);
        avisar(err && err.code === 1
          ? 'No nos has dado permiso para saber dónde estás. Puedes dárselo ' +
            'desde el candado de la barra de direcciones; en iPhone, además, ' +
            'en Ajustes → Privacidad → Localización → Safari. Mientras, la ' +
            'lista sale del centro de Sevilla.'
          : 'No hemos podido leer tu ubicación. La lista sale del centro de Sevilla.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function volverAlBoton(boton) {
    boton.disabled = false;
    boton.textContent = 'Ver lo que tengo cerca';
  }

  function avisar(texto) {
    avisoUbicacion.textContent = texto;
    avisoUbicacion.hidden = false;
  }

  // Si ya dio permiso una vez, al volver no hace falta pedírselo con un
  // botón: el navegador no vuelve a preguntar y la lista sale ya centrada
  // donde está. Se guarda aquí, no en el servidor.
  function guardarPermiso() {
    try { localStorage.setItem('sevi-ubicacion-ok', '1'); } catch (_) { /* sin almacenamiento */ }
  }

  function yaDioPermiso() {
    try { return localStorage.getItem('sevi-ubicacion-ok') === '1'; }
    catch (_) { return false; }
  }

  // --- Añadir un lugar que falta --------------------------------------------

  // Lo mismo que el botón «Añadir lugar» de la app (`sugerirSitio`), con su
  // misma regla: **sin posición real no se abre el formulario**, porque el
  // sitio se clavaría en el centro de Sevilla y acabaría ahí en el mapa de
  // todo el mundo. Si hace falta, se pide la ubicación en ese momento.
  //
  // El formulario es el de `/mapa/`, no una copia: allí está la comprobación
  // de duplicados, los tipos, el aviso de tapas y la sesión. Dos formularios
  // escribiendo en `sugerencias` acabarían comportándose distinto.
  // Las dos formas de decir dónde está el sitio, igual que en la app: o
  // estás delante y vale tu posición, o lo marcas tú en el mapa.
  //
  // Antes esto exigía el GPS y, si fallaba o lo denegabas, soltaba un aviso
  // y te dejaba ahí. Quien no quiere dar la ubicación —o está en casa
  // acordándose de un sitio— no tenía por dónde seguir, aunque la otra vía
  // existiera en `/mapa/`. Preguntar es una pulsación más y no deja a nadie
  // fuera.
  function elegirComoUbicar() {
    const fondo = document.createElement('div');
    fondo.className = 'hoja-fondo';
    const hoja = document.createElement('div');
    hoja.className = 'hoja';
    hoja.setAttribute('role', 'dialog');
    hoja.setAttribute('aria-modal', 'true');
    hoja.setAttribute('aria-label', 'Dónde está el sitio que quieres añadir');

    const h = document.createElement('h2');
    h.textContent = '¿Dónde está el sitio?';
    const p = document.createElement('p');
    p.textContent = 'Lo necesitamos para no clavarlo en el centro de Sevilla.';
    hoja.append(h, p);

    function opcion(titulo, detalle, alPulsar) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hoja-opcion';
      const t = document.createElement('strong');
      t.textContent = titulo;
      const d = document.createElement('span');
      d.textContent = detalle;
      b.append(t, d);
      b.addEventListener('click', () => { cerrar(); alPulsar(); });
      return b;
    }

    function cerrar() {
      fondo.remove();
      document.removeEventListener('keydown', porTecla);
    }
    function porTecla(e) { if (e.key === 'Escape') cerrar(); }

    hoja.appendChild(opcion('Estoy delante del sitio',
      'Usamos tu ubicación y podrás ajustar el punto después.', porUbicacion));
    hoja.appendChild(opcion('Marcarlo en el mapa',
      'Lo pones tú donde esté, sin dar tu ubicación.',
      () => { location.href = '/mapa/?modo=sugerir'; }));

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'hoja-cancelar';
    no.textContent = 'Ahora no';
    no.addEventListener('click', cerrar);
    hoja.appendChild(no);

    fondo.appendChild(hoja);
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    document.addEventListener('keydown', porTecla);
    document.body.appendChild(fondo);
    hoja.querySelector('.hoja-opcion').focus();
  }

  function anadirLugar() {
    if (estado.ubicacionReal) { irAlFormulario(); return; }
    elegirComoUbicar();
  }

  function porUbicacion() {
    if (!navigator.geolocation) {
      avisar('Tu navegador no sabe decirnos dónde estás. Puedes añadirlo ' +
        'marcándolo en el mapa.');
      return;
    }
    const boton = $('btn-aportar');
    boton.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        boton.disabled = false;
        const punto = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          // Se guardan para poder contarle a quien modera lo fiable que es
          // el punto cuando desde aquí se sugiere un sitio.
          precisionM: pos.coords.accuracy,
          tomadoEl: pos.timestamp,
        };
        if (L.metros(punto, L.SEVILLA) > LEJOS) {
          avisar('Estás a ' + L.formatDist(L.metros(punto, L.SEVILLA)) +
            ' de Sevilla y SeviTime solo cubre Sevilla y su provincia, así que ' +
            'no podemos dar por buena tu posición para un sitio nuevo. Puedes ' +
            'marcarlo en el mapa.');
          return;
        }
        estado.origen = punto;
        estado.ubicacionReal = true;
        guardarPermiso();
        $('ubicacion-caja').hidden = true;
        avisoUbicacion.hidden = true;
        pintar();
        irAlFormulario();
      },
      () => {
        boton.disabled = false;
        // Sin ubicación no se acaba el camino: se sigue por el mapa.
        avisar('No hemos podido leer tu ubicación. Te llevamos al mapa para ' +
          'que lo marques tú.');
        setTimeout(() => { location.href = '/mapa/?modo=sugerir'; }, 1600);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // El formulario se abre AQUÍ, sobre la lista, como en la app: pulsas
  // «Añadir lugar» y rellenas, sin pasar por ningún mapa. Antes te mandaba a
  // `/mapa/?modo=sugerir`, que es un rodeo que la app no hace y que además
  // carga 600 KB de librería de mapas para rellenar cuatro campos.
  //
  // Lo que decide qué se guarda —validación, duplicados e INSERT— vive en
  // `/sugerir.js`, compartido con el panel del mapa.
  // Quién está mirando, para firmar la sugerencia. `auth.js` lo avisa.
  let usuario = null;
  if (window.SEVI && window.SEVI.onAuth) {
    window.SEVI.onAuth.push(function (u) { usuario = u; });
  }

  function irAlFormulario() {
    const fondo = document.createElement('div');
    fondo.className = 'hoja-fondo';
    const hoja = document.createElement('div');
    hoja.className = 'hoja hoja-form';
    hoja.setAttribute('role', 'dialog');
    hoja.setAttribute('aria-modal', 'true');
    hoja.setAttribute('aria-label', 'Sugerir un sitio nuevo');

    function cerrar() { fondo.remove(); document.removeEventListener('keydown', tecla); }
    function tecla(ev) { if (ev.key === 'Escape') cerrar(); }

    const h = document.createElement('h2');
    h.textContent = 'Un sitio que falta';
    const sub = document.createElement('p');
    sub.textContent = 'Lo ponemos donde estás. Se revisa antes de publicarse.';
    hoja.append(h, sub);

    function campo(etiqueta, nodo, id) {
      const l = document.createElement('label');
      l.className = 'hoja-campo';
      l.htmlFor = id;
      l.textContent = etiqueta;
      hoja.append(l, nodo);
    }

    const nombre = document.createElement('input');
    nombre.id = 'sug-nombre';
    nombre.type = 'text';
    nombre.maxLength = 120;
    nombre.autocomplete = 'off';
    campo('Cómo se llama', nombre, 'sug-nombre');

    const etiquetaTipo = document.createElement('span');
    etiquetaTipo.className = 'hoja-campo';
    etiquetaTipo.id = 'sug-tipo-label';
    etiquetaTipo.textContent = 'Qué es';
    const chips = document.createElement('div');
    chips.className = 'chips hoja-chips';
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-labelledby', 'sug-tipo-label');
    let tipo = 'bar';
    Object.entries(window.SeviSugerir.TIPOS).forEach(function ([valor, t]) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip' + (valor === tipo ? ' seleccionado' : '');
      c.dataset.valor = valor;
      c.appendChild(document.createTextNode(t.emoji + ' ' + t.etiqueta));
      c.addEventListener('click', function () {
        tipo = valor;
        chips.querySelectorAll('.chip').forEach(function (x) {
          x.classList.toggle('seleccionado', x.dataset.valor === valor);
        });
        actualizarTapas();
      });
      chips.appendChild(c);
    });
    hoja.append(etiquetaTipo, chips);

    // «¿Ponen tapas?», solo en bares y restaurantes, como en la app. Sin
    // esto, un bar sugerido desde la web no entraba en «Dónde tapear».
    const filaTapas = document.createElement('label');
    filaTapas.className = 'hoja-casilla';
    const tapas = document.createElement('input');
    tapas.type = 'checkbox';
    tapas.id = 'sug-tapas';
    filaTapas.append(tapas, document.createTextNode(' Ponen tapas'));
    hoja.appendChild(filaTapas);

    function actualizarTapas() {
      const cabe = tipo === 'bar' || tipo === 'restaurant';
      filaTapas.hidden = !cabe;
      if (!cabe) tapas.checked = false;
    }
    actualizarTapas();

    const notas = document.createElement('textarea');
    notas.id = 'sug-notas';
    notas.maxLength = 300;
    notas.rows = 2;
    campo('Notas (opcional)', notas, 'sug-notas');

    const aviso = document.createElement('p');
    aviso.className = 'hoja-error';
    aviso.setAttribute('role', 'alert');
    aviso.hidden = true;
    hoja.appendChild(aviso);

    const enviar = document.createElement('button');
    enviar.type = 'button';
    enviar.className = 'hoja-enviar';
    enviar.textContent = 'Enviarlo';
    enviar.addEventListener('click', async function () {
      aviso.hidden = true;
      enviar.disabled = true;
      const r = await window.SeviSugerir.enviar({
        nombre: nombre.value,
        tipo: tipo,
        notas: notas.value,
        lat: estado.origen.lat,
        lon: estado.origen.lon,
        tapas: tapas.checked,
        // Aquí el punto es donde está quien sugiere, no una chincheta: salvo
        // que no haya dado la ubicación y la lista salga del centro.
        puntoOrigen: estado.ubicacionReal ? 'gps' : 'web',
        precisionM: estado.origen.precisionM,
        tomadoEl: estado.origen.tomadoEl,
        deviceId: window.SeviSugerir.deviceId(usuario),
        cercanos: estado.sitios || [],
        sb: window.SEVI.sb,
      });
      enviar.disabled = false;
      if (r.cancelado) return;
      if (r.error) {
        aviso.textContent = r.error;
        aviso.hidden = false;
        return;
      }
      hoja.textContent = '';
      const ok = document.createElement('p');
      ok.className = 'hoja-ok';
      ok.textContent = '¡Gracias! Lo revisamos y, si entra, lo verás en el mapa.';
      hoja.appendChild(ok);
      const cerrarlo = document.createElement('button');
      cerrarlo.type = 'button';
      cerrarlo.className = 'hoja-cancelar';
      cerrarlo.textContent = 'Cerrar';
      cerrarlo.addEventListener('click', cerrar);
      hoja.appendChild(cerrarlo);
    });
    hoja.appendChild(enviar);

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'hoja-cancelar';
    no.textContent = 'Cancelar';
    no.addEventListener('click', cerrar);
    hoja.appendChild(no);

    fondo.appendChild(hoja);
    fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(); });
    document.addEventListener('keydown', tecla);
    document.body.appendChild(fondo);
    nombre.focus();
  }

  // --- Filtrado y orden -----------------------------------------------------

  function tiposDelFiltro(id) {
    const f = (L.FILTROS_EXPLORAR || []).find((x) => x.id === id);
    return f && f.tipos ? f.tipos : null;
  }

  function entraEnElFiltro(p) {
    const tipos = tiposDelFiltro(estado.filtro);
    if (tipos) return tipos.includes(p.tipo);
    return L.TIPOS_DE_TODO.includes(p.tipo);
  }

  function notaDe(p) {
    return estado.notas.get(L.claveDe(p.lat, p.lon)) || null;
  }

  // Sin votos, la media bayesiana del servidor: cinco votos ficticios de 3,6
  // que hay que superar. Lo mismo que `_notaPonderada` en la app, para que
  // los dos ordenen igual.
  function paraOrdenar(p) {
    const n = notaDe(p);
    return n && n.score ? n.score : 3.6;
  }

  function lista_filtrada() {
    const q = L.normalizar(estado.texto);
    let fuera = estado.sitios.filter(entraEnElFiltro);

    if (q) {
      // Buscando por texto el radio no manda: igual que en la app, quien
      // escribe «alcázar» quiere el Alcázar esté a 300 m o a 3 km.
      fuera = fuera.filter((p) =>
        L.normalizar(p.nombre).includes(q) || L.normalizar(p.direccion).includes(q));
    } else {
      fuera = fuera.filter((p) => L.metros(estado.origen, p) <= estado.radio);
    }

    const conDistancia = fuera.map((p) => ({ p, m: L.metros(estado.origen, p) }));
    if (estado.orden === 'nombre') {
      conDistancia.sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'));
    } else if (estado.orden === 'valoracion') {
      conDistancia.sort((a, b) => paraOrdenar(b.p) - paraOrdenar(a.p) || a.m - b.m);
    } else {
      conDistancia.sort((a, b) => a.m - b.m);
    }
    return conDistancia;
  }

  // --- Pintar ---------------------------------------------------------------

  function estrellas(nota) {
    const n = Math.max(0, Math.min(5, Math.round(nota)));
    const s = el('span', 'estrellas');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', n + ' de 5 estrellas');
    s.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    return s;
  }

  function tarjeta(entrada) {
    const p = entrada.p;
    const li = el('li', 'sitio');
    const a = el('a', 'sitio-enlace');
    a.href = '/lugar/?k=' + encodeURIComponent(L.claveDe(p.lat, p.lon));

    const ico = el('span', 'sitio-ico', p.emoji || '📍');
    ico.setAttribute('aria-hidden', 'true');
    ico.style.background = p.color;
    ico.style.color = L.textoSobre(p.color);
    a.appendChild(ico);

    const txt = el('span', 'sitio-txt');
    txt.appendChild(el('span', 'sitio-nombre', p.nombre));

    const meta = el('span', 'sitio-meta');
    meta.appendChild(el('span', null, p.label || 'Sitio'));
    meta.appendChild(el('span', 'punto', '·'));
    meta.appendChild(el('span', null, L.formatDist(entrada.m)));
    txt.appendChild(meta);

    if (p.direccion) txt.appendChild(el('span', 'sitio-dir', p.direccion));
    a.appendChild(txt);

    const n = notaDe(p);
    if (n && n.votos > 0 && n.media > 0) {
      const caja = el('span', 'sitio-nota');
      caja.appendChild(el('b', null,
        n.media.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
      caja.appendChild(estrellas(n.media));
      caja.appendChild(el('small', null, n.votos === 1 ? '1 voto' : n.votos + ' votos'));
      a.appendChild(caja);
    }

    li.appendChild(a);
    return li;
  }

  function textoDelResumen(total) {
    if (estado.texto) {
      return total === 0
        ? 'Ningún sitio se llama así.'
        : (total === 1 ? '1 sitio' : total.toLocaleString('es-ES') + ' sitios') +
          ' con «' + estado.texto.trim() + '»';
    }
    const cuantos = total === 1 ? '1 sitio' : total.toLocaleString('es-ES') + ' sitios';
    const hasta = estado.radio < 1000
      ? estado.radio + ' m'
      : (estado.radio / 1000) + ' km';
    return estado.ubicacionReal
      ? cuantos + ' a menos de ' + hasta + ' de ti'
      : cuantos + ' a menos de ' + hasta + ' del centro de Sevilla';
  }

  function pintar() {
    if (!estado.sitios) return;
    const todas = lista_filtrada();

    $('titulo-lista').textContent = estado.ubicacionReal
      ? 'Cerca de ti'
      : 'En el centro de Sevilla';
    resumen.textContent = textoDelResumen(todas.length);

    lista.textContent = '';
    lista.removeAttribute('aria-busy');
    todas.slice(0, estado.visibles).forEach((e) => lista.appendChild(tarjeta(e)));

    if (!todas.length) {
      const vacio = el('li', 'vacio');
      vacio.appendChild(el('p', null, estado.texto
        ? 'No hay ningún sitio con ese nombre.'
        : 'Aquí no hay sitios de este tipo. Prueba a ampliar la distancia.'));
      const mapa = el('a', 'vacio-enlace', 'Buscar en el mapa');
      mapa.href = '/mapa/';
      vacio.appendChild(mapa);
      lista.appendChild(vacio);
    }

    // El tope no pasa de lo que hay. Sin esto, cada clic de más seguía
    // sumando 20 a `visibles` y el botón restaba: «Ver más sitios (-36)».
    // Que esté acotado aquí vale aunque alguien vuelva a romper el CSS que
    // oculta el botón.
    estado.visibles = Math.min(estado.visibles, Math.max(POR_TANDA, todas.length));
    const quedan = Math.max(0, todas.length - estado.visibles);
    const mas = $('btn-mas');
    mas.hidden = quedan === 0;
    mas.textContent = 'Ver más sitios (' + quedan + ')';
  }

  // --- Controles ------------------------------------------------------------

  function pintarChips() {
    const caja = $('chips');
    (L.FILTROS_EXPLORAR || []).forEach((f) => {
      const b = el('button', 'chip' + (f.id === estado.filtro ? ' seleccionado' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', f.id === estado.filtro ? 'true' : 'false');
      b.appendChild(el('span', null, f.emoji || ''));
      b.appendChild(el('span', null, f.etiqueta));
      b.addEventListener('click', () => {
        estado.filtro = f.id;
        estado.visibles = POR_TANDA;
        caja.querySelectorAll('.chip').forEach((c) => {
          c.classList.remove('seleccionado');
          c.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('seleccionado');
        b.setAttribute('aria-pressed', 'true');
        pintar();
      });
      caja.appendChild(b);
    });
  }

  function pintarRadios() {
    const sel = $('radio');
    RADIOS.forEach((m) => {
      const o = document.createElement('option');
      o.value = String(m);
      o.textContent = m < 1000 ? m + ' m' : (m / 1000) + ' km';
      if (m === estado.radio) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      estado.radio = Number(sel.value) || RADIO_POR_DEFECTO;
      estado.visibles = POR_TANDA;
      pintar();
    });
  }

  function conectarControles() {
    $('orden').value = estado.orden;
    $('orden').addEventListener('change', (e) => {
      estado.orden = e.target.value;
      estado.visibles = POR_TANDA;
      pintar();
    });

    let espera = null;
    $('buscar').addEventListener('input', (e) => {
      const v = e.target.value;
      clearTimeout(espera);
      // Filtrar 8.900 sitios en cada tecla se nota en un móvil modesto.
      espera = setTimeout(() => {
        estado.texto = v;
        estado.visibles = POR_TANDA;
        pintar();
      }, 180);
    });

    $('btn-ubicacion').addEventListener('click', pedirUbicacion);
    $('btn-aportar').addEventListener('click', anadirLugar);
    $('btn-mas').addEventListener('click', () => {
      estado.visibles += POR_TANDA;
      pintar();
    });

    // Crece sola al acercarse al final, como la lista de la app. El botón se
    // queda para quien navega con teclado o tiene el scroll desactivado.
    if ('IntersectionObserver' in window) {
      const centinela = $('centinela');
      new IntersectionObserver((entradas) => {
        if (!entradas.some((x) => x.isIntersecting)) return;
        if ($('btn-mas').hidden) return;
        estado.visibles += POR_TANDA;
        pintar();
      }, { rootMargin: '600px 0px' }).observe(centinela);
    }
  }

  // --- Arranque -------------------------------------------------------------

  pintarChips();
  pintarRadios();
  conectarControles();

  // Quien ya dio permiso no tiene que volver a pulsar nada.
  if (yaDioPermiso() && navigator.geolocation) {
    $('ubicacion-caja').hidden = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          // Se guardan para poder contarle a quien modera lo fiable que es
          // el punto cuando desde aquí se sugiere un sitio.
          precisionM: pos.coords.accuracy,
          tomadoEl: pos.timestamp,
        };
        if (L.metros(punto, L.SEVILLA) > LEJOS) return;
        estado.origen = punto;
        estado.ubicacionReal = true;
        estado.orden = 'distancia';
        $('orden').value = 'distancia';
        pintar();
      },
      () => { $('ubicacion-caja').hidden = false; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  Promise.all([L.cargar(), cargarNotas()])
    .then(([sitios, notas]) => {
      estado.sitios = sitios;
      estado.notas = notas;
      pintar();
    })
    .catch(() => {
      lista.textContent = '';
      lista.removeAttribute('aria-busy');
      const vacio = el('li', 'vacio');
      vacio.appendChild(el('p', null,
        'No hemos podido cargar los sitios. Comprueba la conexión y vuelve a intentarlo.'));
      const reintentar = el('button', 'vacio-enlace', 'Volver a intentarlo');
      reintentar.type = 'button';
      reintentar.addEventListener('click', () => location.reload());
      vacio.appendChild(reintentar);
      lista.appendChild(vacio);
      resumen.textContent = '';
    });
})();
