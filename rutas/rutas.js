// Rutas de Sevilla en el navegador.
//
// Las rutas se piden a `fn_rutas_publicas()` (solo las aprobadas, con el
// nombre público de su autor y sus paradas). El icono, el color y el emoji de
// cada parada salen del módulo compartido lugares.js, para que un bar sea del
// mismo color aquí que en Explorar o en el editor.
(function () {
  'use strict';

  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const { SEVILLA, colorFor, emojiFor, labelFor, textoSobre } = window.sevitimeLugares;

  // El icono de una ruta llega como clave (`tapas`, `rio`…) desde la base.
  // Los ids viven en lib/data/iconos_ruta.dart; si se añade uno allí, se añade
  // aquí. Una clave desconocida cae en el de monumentos, como en la app.
  const ICONOS = {
    monumento: '🏛️', rio: '🚤', parque: '🌳', iglesia: '⛪', tapas: '🍻',
    setas: '🍄', museo: '🖼️', cafe: '☕', mirador: '👀', compras: '🛍️',
    familia: '👨‍👩‍👧', noche: '🌙',
  };
  function iconoDeRuta(id) { return ICONOS[id] || '🏛️'; }

  function duracionTexto(minutos) {
    if (!minutos || minutos < 60) return (minutos || 0) + ' min';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? h + ' h' : h + ' h ' + m + ' min';
  }

  const FILTROS = [
    { id: 'todas', etiqueta: 'Todas', emoji: '🧭' },
    { id: 'rutas', etiqueta: 'Rutas', emoji: '🥾' },
    { id: 'recomendaciones', etiqueta: 'Recomendaciones', emoji: '⭐' },
  ];

  // --- Estado ---
  let todas = [];
  let seleccionada = null;
  let filtro = 'todas';
  let marcadores = [];

  // --- Una ruta, su enlace ---
  //
  // `/rutas/?id=<id>` abre la página con esa ruta ya desplegada: es lo que
  // se comparte y adonde llevan los perfiles. Antes no había forma de mandar
  // a alguien a una ruta concreta dentro de sevitime.com; los perfiles
  // enlazaban a la página antigua de `sevitime.github.io/ruta/`, que sigue
  // existiendo porque es la que abren los enlaces que comparte la app.
  //
  // El reparto es el de la app: ver una ruta es libre, y lo que pide cuenta
  // es participar («Me ha servido», crear la tuya).
  const PAQUETE = 'com.selu.sevitime';
  const PLAY = 'https://play.google.com/store/apps/details?id=' + PAQUETE;
  const TITULO_BASE = document.title;
  const RECORDAR = 'sevitime_ruta_tras_entrar';
  let usuario = null;

  function idDelEnlace() {
    const id = parseInt(new URLSearchParams(location.search).get('id') || '', 10);
    return id > 0 ? id : null;
  }

  function enlaceDe(r) { return 'https://sevitime.com/rutas/?id=' + r.id; }

  /// La barra de direcciones y el título siguen a la ruta abierta, para que
  /// copiar la dirección sirva para compartirla. `replaceState` y no
  /// `pushState`: plegar y desplegar rutas no debe llenar el botón «atrás».
  function reflejarEnLaDireccion(r) {
    history.replaceState(null, '', r ? '/rutas/?id=' + r.id : '/rutas/');
    document.title = r ? r.nombre + ' — Rutas de Sevilla — SeviTime' : TITULO_BASE;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = r ? enlaceDe(r) : 'https://sevitime.com/rutas/';
  }

  const chips = document.getElementById('chips');
  const lista = document.getElementById('lista');
  const resumen = document.getElementById('resumen');
  const mapaResumen = document.getElementById('mapa-resumen');
  const COLECCION_VACIA = { type: 'FeatureCollection', features: [] };

  // --- Mapa ---
  usarProtocoloTeselas();
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)');

  const map = new maplibregl.Map({
    container: 'map',
    style: sevitimeEstiloMapa(prefiereOscuro.matches),
    center: [SEVILLA.lon, SEVILLA.lat],
    zoom: 13,
    minZoom: 8,
    maxBounds: SEVITIME_PROVINCIA_BOUNDS,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  vigilarTeselas(map);

  function montarCapas() {
    if (map.getSource('ruta-sel') || !map.isStyleLoaded()) return;
    map.addSource('ruta-sel', { type: 'geojson', data: COLECCION_VACIA });
    map.addLayer({
      id: 'ruta-sel-linea', type: 'line', source: 'ruta-sel',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#00897B', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.2] },
    });
  }
  map.on('load', montarCapas);
  map.on('styledata', () => {
    montarCapas();
    if (seleccionada) pintarLinea(seleccionada);
  });
  prefiereOscuro.addEventListener('change', (e) => map.setStyle(sevitimeEstiloMapa(e.matches)));

  function pintarLinea(r) {
    const src = map.getSource('ruta-sel');
    if (!src) return;
    const coords = r.paradas.map((p) => [p.lon, p.lat]);
    src.setData({
      type: 'FeatureCollection',
      features: coords.length > 1
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }]
        : [],
    });
  }

  function pintarMarcadores(r) {
    marcadores.forEach((m) => m.remove());
    marcadores = [];
    r.paradas.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'parada-num';
      el.style.background = colorFor(p.tipo);
      el.style.color = textoSobre(colorFor(p.tipo));
      el.style.cursor = 'pointer';
      el.textContent = String(i + 1);
      el.title = p.nombre;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        abrirPopupParada(p, i);
        map.flyTo({ center: [p.lon, p.lat], zoom: 16 });
      });
      marcadores.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
    });
  }

  function abrirPopupParada(p, i) {
    const el = document.createElement('div');
    el.className = 'popup';
    const nombre = document.createElement('div');
    nombre.className = 'nombre';
    nombre.textContent = (i + 1) + '. ' + p.nombre;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = labelFor(p.tipo);
    el.append(nombre, meta);
    if (p.nota) {
      const nota = document.createElement('div');
      nota.className = 'nota';
      nota.textContent = '“' + p.nota + '”';
      el.appendChild(nota);
    }
    const g = document.createElement('a');
    g.href = 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon;
    g.target = '_blank';
    g.rel = 'noopener';
    g.textContent = 'Cómo llegar';
    el.appendChild(g);
    new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '260px' })
      .setLngLat([p.lon, p.lat])
      .setDOMContent(el)
      .addTo(map);
  }

  function encuadrar(r) {
    if (!r.paradas.length) return;
    const b = new maplibregl.LngLatBounds();
    r.paradas.forEach((p) => b.extend([p.lon, p.lat]));
    if (b.isEmpty()) return;
    const ajustar = () => map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 500 });
    if (map.loaded()) ajustar();
    else map.once('load', ajustar);
  }

  // --- Lista ---
  function rutasFiltradas() {
    if (filtro === 'rutas') return todas.filter((r) => r.paradas.length > 1);
    if (filtro === 'recomendaciones') return todas.filter((r) => r.paradas.length === 1);
    return todas;
  }

  function pintarChips() {
    FILTROS.forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (f.id === filtro ? ' seleccionado' : '');
      b.dataset.filtro = f.id;
      b.textContent = f.emoji + ' ' + f.etiqueta;
      b.addEventListener('click', () => {
        filtro = f.id;
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('seleccionado', c.dataset.filtro === f.id));
        // Si la ruta dibujada ya no sale con el filtro, se quita del mapa.
        if (seleccionada && !rutasFiltradas().some((r) => r.id === seleccionada.id)) limpiarSeleccion();
        pintarLista();
      });
      chips.appendChild(b);
    });
  }

  function pintarLista() {
    const r = rutasFiltradas();
    resumen.textContent = r.length === 0
      ? 'No hay nada con ese filtro.'
      : r.length.toLocaleString('es-ES') + (r.length === 1 ? ' ruta' : ' rutas');
    lista.textContent = '';
    if (!r.length) return;
    const frag = document.createDocumentFragment();
    r.forEach((ruta) => frag.appendChild(ficha(ruta)));
    lista.appendChild(frag);
  }

  function ficha(r) {
    const li = document.createElement('li');
    li.className = 'ruta' + (seleccionada && seleccionada.id === r.id ? ' activa' : '');

    const cab = document.createElement('button');
    cab.type = 'button';
    cab.className = 'ruta-cab';

    const ico = document.createElement('span');
    ico.className = 'ruta-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = iconoDeRuta(r.icono);

    const texto = document.createElement('span');
    texto.className = 'ruta-texto';
    const nombre = document.createElement('span');
    nombre.className = 'ruta-nombre';
    nombre.textContent = r.nombre;
    const desc = document.createElement('span');
    desc.className = 'ruta-desc';
    desc.textContent = r.descripcion;
    const meta = document.createElement('span');
    meta.className = 'ruta-meta';
    const esRec = r.paradas.length === 1;
    const sello = document.createElement('span');
    sello.className = 'sello' + (esRec ? ' rec' : '');
    sello.textContent = esRec ? 'Recomendación' : r.paradas.length + ' paradas';
    const dur = document.createElement('span');
    dur.textContent = '⏱ ' + duracionTexto(r.minutos);
    meta.append(sello, dur);
    // El nombre del autor viene de usuarios: siempre como texto, nunca HTML.
    const quien = r.oficial ? 'SeviTime' : r.autor;
    if (quien) {
      const a = document.createElement('span');
      a.textContent = quien;
      meta.appendChild(a);
    }
    texto.append(nombre, desc, meta);
    cab.append(ico, texto);
    li.appendChild(cab);

    if (seleccionada && seleccionada.id === r.id) {
      li.appendChild(accionesDe(r));
      li.appendChild(paradasDe(r));
    }

    cab.addEventListener('click', () => seleccionar(r));
    return li;
  }

  /// Lo que se puede hacer con la ruta abierta: decir que te ha servido,
  /// compartirla, abrirla en la app y ver quién la hizo.
  function accionesDe(r) {
    const caja = document.createElement('div');
    caja.className = 'ruta-acciones';

    // La propia no se puede marcar (lo impide la base de datos), así que ni
    // se ofrece.
    if (!r.es_mia) caja.appendChild(botonMeSirvio(r, caja));

    const compartir = document.createElement('button');
    compartir.type = 'button';
    compartir.className = 'ruta-accion';
    compartir.textContent = 'Compartir';
    compartir.addEventListener('click', function () {
      const datos = { title: r.nombre, text: r.nombre + ' — una ruta de SeviTime', url: enlaceDe(r) };
      if (navigator.share) {
        navigator.share(datos).catch(function () {});
        return;
      }
      (navigator.clipboard ? navigator.clipboard.writeText(datos.url) : Promise.reject())
        .then(function () { avisarEn(caja, 'Enlace copiado.'); })
        .catch(function () { avisarEn(caja, datos.url); });
    });
    caja.appendChild(compartir);

    // En Android el enlace intenta abrir la app y, si no está, cae a Play.
    // En el ordenador no hay app que abrir: no se enseña.
    if (/android/i.test(navigator.userAgent)) {
      const app = document.createElement('a');
      app.className = 'ruta-accion';
      app.textContent = 'Abrir en la app';
      app.href = 'intent://ruta/' + r.id + '#Intent;scheme=sevitime;package=' + PAQUETE +
        ';S.browser_fallback_url=' + encodeURIComponent(PLAY) + ';end';
      caja.appendChild(app);
    }

    // Como en la app: «Ruta de X» lleva a su perfil. Las de la casa no
    // tienen autor que enseñar.
    if (!r.oficial && r.autor) {
      const autor = document.createElement('a');
      autor.className = 'ruta-autor';
      autor.href = '/perfil/?n=' + encodeURIComponent(r.autor);
      autor.textContent = r.es_mia ? 'Tu ruta' : 'Ruta de ' + r.autor;
      caja.appendChild(autor);
    }

    const aviso = document.createElement('p');
    aviso.className = 'ruta-aviso';
    aviso.setAttribute('role', 'status');
    aviso.hidden = true;
    caja.appendChild(aviso);
    return caja;
  }

  function avisarEn(caja, texto, accion) {
    const aviso = caja.querySelector('.ruta-aviso');
    aviso.textContent = texto;
    if (accion) {
      aviso.append(' ');
      aviso.appendChild(accion);
    }
    aviso.hidden = false;
  }

  /// «Me ha servido». Como en la app, cambia al momento y se deshace si el
  /// servidor dice que no; y sin sesión no vota: invita a entrar.
  function botonMeSirvio(r, caja) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ruta-accion ruta-util';
    function pintar() {
      const n = r.utiles_count || 0;
      b.textContent = '👍 ' + (n === 0 ? 'Me ha servido' : 'Me ha servido · ' + n);
      b.classList.toggle('marcado', !!r.me_sirvio);
      b.setAttribute('aria-pressed', r.me_sirvio ? 'true' : 'false');
    }
    pintar();
    b.addEventListener('click', function () {
      if (!usuario) {
        const entrar = document.createElement('button');
        entrar.type = 'button';
        entrar.className = 'ruta-entrar';
        entrar.textContent = 'Entrar con Google';
        entrar.addEventListener('click', function () {
          // El acceso vuelve a `/rutas/` a secas: se apunta la ruta para
          // reabrirla a la vuelta.
          try { sessionStorage.setItem(RECORDAR, String(r.id)); } catch (e) { /* sin almacenamiento */ }
          const delNav = document.querySelector('.auth-entrar');
          if (delNav) delNav.click();
        });
        avisarEn(caja, 'Inicia sesión para marcarla.', entrar);
        return;
      }
      const antes = !!r.me_sirvio;
      r.me_sirvio = !antes;
      r.utiles_count = (r.utiles_count || 0) + (antes ? -1 : 1);
      pintar();
      b.disabled = true;
      const peticion = antes
        ? sb.from('rutas_utiles').delete().eq('ruta_id', r.id).eq('user_id', usuario.id)
        : sb.from('rutas_utiles').insert({ ruta_id: r.id, user_id: usuario.id });
      peticion.then(function (res) {
        b.disabled = false;
        if (!res.error) return;
        r.me_sirvio = antes;
        r.utiles_count += antes ? 1 : -1;
        pintar();
        avisarEn(caja, 'No se ha podido guardar. Inténtalo otra vez.');
      });
    });
    return b;
  }

  function paradasDe(r) {
    const caja = document.createElement('div');
    caja.className = 'paradas';
    r.paradas.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'parada';
      const num = document.createElement('span');
      num.className = 'parada-num';
      num.style.background = colorFor(p.tipo);
      num.style.color = textoSobre(colorFor(p.tipo));
      num.textContent = String(i + 1);
      const texto = document.createElement('span');
      texto.className = 'parada-texto';
      const nombre = document.createElement('span');
      nombre.className = 'parada-nombre';
      nombre.textContent = p.nombre;
      const meta = document.createElement('span');
      meta.className = 'parada-meta';
      meta.textContent = labelFor(p.tipo);
      texto.append(nombre, meta);
      if (p.nota) {
        const nota = document.createElement('span');
        nota.className = 'parada-nota';
        nota.textContent = '“' + p.nota + '”';
        texto.appendChild(nota);
      }
      b.append(num, texto);
      b.addEventListener('click', () => {
        abrirPopupParada(p, i);
        map.flyTo({ center: [p.lon, p.lat], zoom: 16 });
      });
      caja.appendChild(b);
    });
    return caja;
  }

  function limpiarSeleccion() {
    seleccionada = null;
    marcadores.forEach((m) => m.remove());
    marcadores = [];
    const src = map.getSource('ruta-sel');
    if (src) src.setData(COLECCION_VACIA);
    mapaResumen.textContent = 'Elige una ruta';
    reflejarEnLaDireccion(null);
  }

  /// [porSuCuenta]: la abre la página sola (la primera, en pantalla grande),
  /// no la persona. Entonces la dirección no cambia: quien entra en
  /// `/rutas/` está en `/rutas/`, y así la ve también un buscador.
  function seleccionar(r, porSuCuenta) {
    if (seleccionada && seleccionada.id === r.id) {
      // Volver a tocar la misma la pliega.
      limpiarSeleccion();
      pintarLista();
      return;
    }
    seleccionada = r;
    mapaResumen.textContent = r.nombre;
    if (!porSuCuenta) reflejarEnLaDireccion(r);
    pintarLinea(r);
    pintarMarcadores(r);
    encuadrar(r);
    pintarLista();
  }

  // --- Carga ---
  pintarChips();
  function alLlegar({ data, error }) {
    if (error || !data) {
      resumen.textContent = 'No se pudieron cargar las rutas. Recarga en un momento.';
      // Fuera las siluetas: si se quedaran, parecería que sigue cargando.
      lista.textContent = '';
      lista.removeAttribute('aria-busy');
      return;
    }
    todas = data.map((r) => ({ ...r, paradas: r.paradas || [] }));
    pintarLista();
    if (window.SeviLlegada) window.SeviLlegada(lista);

    // Si se llega con el enlace de una ruta (o se vuelve de entrar con
    // Google habiéndola dejado abierta), esa es la que se abre, también en
    // el móvil: quien la ha recibido quiere ver esa.
    let pedida = idDelEnlace();
    if (!pedida) {
      try {
        pedida = parseInt(sessionStorage.getItem(RECORDAR) || '', 10) || null;
        sessionStorage.removeItem(RECORDAR);
      } catch (e) { /* sin almacenamiento */ }
    }
    const laPedida = pedida && todas.find((r) => Number(r.id) === pedida);
    if (laPedida) {
      seleccionar(laPedida);
      const tarjeta = lista.querySelector('.ruta.activa');
      if (tarjeta) tarjeta.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (pedida) {
      // No se abre otra en su lugar: taparía este aviso, y quien venía a
      // por una ruta concreta no ha pedido la primera de la lista.
      resumen.textContent = 'Esa ruta ya no está publicada. Aquí tienes las demás.';
      reflejarEnLaDireccion(null);
      return;
    }
    // En pantalla grande se abre la primera ruta; en móvil se deja limpio, que
    // ahí el mapa y la lista van apilados y abrir una llena la pantalla.
    if (todas.length && window.matchMedia('(min-width: 900px)').matches) seleccionar(todas[0], true);
  }

  // Quién ha entrado decide dos cosas de la lista: qué rutas tiene marcadas
  // («Me ha servido») y cuáles son suyas. Por eso se pide con la sesión ya
  // resuelta, y se vuelve a pedir si entra o sale sin recargar.
  let cargada = false;
  function cargar() {
    sb.rpc('fn_rutas_publicas').then(({ data, error }) => {
      if (cargada && !error && data) {
        // Recarga por cambio de sesión: se actualizan los datos sin volver a
        // elegir ruta ni mover el mapa.
        const abierta = seleccionada && seleccionada.id;
        todas = data.map((r) => ({ ...r, paradas: r.paradas || [] }));
        seleccionada = todas.find((r) => r.id === abierta) || null;
        pintarLista();
        return;
      }
      cargada = true;
      alLlegar({ data, error });
    });
  }
  sb.auth.getSession().then(({ data }) => {
    usuario = data && data.session ? data.session.user : null;
    cargar();
    sb.auth.onAuthStateChange((evento, sesion) => {
      const nuevo = sesion ? sesion.user : null;
      if ((nuevo && nuevo.id) === (usuario && usuario.id)) return;
      usuario = nuevo;
      cargar();
    });
  }).catch(() => cargar());
})();
