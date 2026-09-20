// Crear una ruta desde la web.
//
// Una ruta la guarda `fn_crear_ruta` (entre 1 y 12 paradas, con una nota
// opcional por parada; con una sola parada es una "recomendación" y la nota
// pasa a ser lo que la justifica). Nace `pendiente`: la revisa una persona
// antes de publicarse, igual que en la app.
(function () {
  'use strict';

  const { SEVILLA, colorFor, emojiFor, labelFor, textoSobre, normalizar, metros, claveDe, cargar } = window.sevitimeLugares;

  // Los iconos de una ruta, en el mismo orden y con las mismas claves que
  // lib/data/iconos_ruta.dart. Añadir uno allí es añadirlo aquí.
  const ICONOS = [
    { id: 'monumento', nombre: 'Monumentos', emoji: '🏛️' },
    { id: 'rio', nombre: 'El río', emoji: '🚤' },
    { id: 'parque', nombre: 'Parques', emoji: '🌳' },
    { id: 'iglesia', nombre: 'Iglesias', emoji: '⛪' },
    { id: 'tapas', nombre: 'Tapas', emoji: '🍻' },
    { id: 'setas', nombre: 'Moderno', emoji: '🍄' },
    { id: 'museo', nombre: 'Museos', emoji: '🖼️' },
    { id: 'cafe', nombre: 'Cafés', emoji: '☕' },
    { id: 'mirador', nombre: 'Miradores', emoji: '👀' },
    { id: 'compras', nombre: 'Compras', emoji: '🛍️' },
    { id: 'familia', nombre: 'Con niños', emoji: '👨‍👩‍👧' },
    { id: 'noche', nombre: 'De noche', emoji: '🌙' },
  ];

  const estado = { icono: 'monumento', paradas: [] };
  let catalogo = null; // snapshot de sitios, se carga al primer uso
  let cargandoCatalogo = false;
  let marcadores = [];
  let sb = null;
  let usuario = null;

  const COLECCION_VACIA = { type: 'FeatureCollection', features: [] };
  const $ = (id) => document.getElementById(id);
  const form = $('form');
  const avisoLogin = $('aviso-login');
  const misCaja = $('mis-caja');
  const resultados = $('resultados');
  const paradasUl = $('paradas');

  // --- Mapa ---
  usarProtocoloTeselas();
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)');
  const map = new maplibregl.Map({
    container: 'map',
    style: sevitimeEstiloMapa(prefiereOscuro.matches),
    center: [SEVILLA.lon, SEVILLA.lat],
    zoom: 13,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  vigilarTeselas(map);

  function montarCapas() {
    if (map.getSource('ruta-nueva') || !map.isStyleLoaded()) return;
    map.addSource('ruta-nueva', { type: 'geojson', data: COLECCION_VACIA });
    map.addLayer({
      id: 'ruta-nueva-linea', type: 'line', source: 'ruta-nueva',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#00897B', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.2] },
    });
  }
  map.on('load', montarCapas);
  map.on('styledata', () => { montarCapas(); pintarLinea(); });
  prefiereOscuro.addEventListener('change', (e) => map.setStyle(sevitimeEstiloMapa(e.matches)));

  function pintarLinea() {
    const src = map.getSource('ruta-nueva');
    if (!src) return;
    const coords = estado.paradas.map((p) => [p.lon, p.lat]);
    src.setData({
      type: 'FeatureCollection',
      features: coords.length > 1
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }]
        : [],
    });
  }

  function pintarMapa() {
    marcadores.forEach((m) => m.remove());
    marcadores = [];
    estado.paradas.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'parada-num';
      el.style.background = colorFor(p.tipo);
      el.style.color = textoSobre(colorFor(p.tipo));
      el.textContent = String(i + 1);
      marcadores.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map));
    });
    pintarLinea();
    $('mapa-resumen').textContent = estado.paradas.length === 0
      ? 'Añade paradas para verlas aquí'
      : estado.paradas.length + (estado.paradas.length === 1 ? ' parada' : ' paradas');
    if (estado.paradas.length) {
      const b = new maplibregl.LngLatBounds();
      estado.paradas.forEach((p) => b.extend([p.lon, p.lat]));
      const ajustar = () => map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 400 });
      if (map.loaded()) ajustar(); else map.once('load', ajustar);
    }
  }

  // --- Iconos ---
  const iconosCaja = $('f-iconos');
  ICONOS.forEach((ic) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (ic.id === estado.icono ? ' seleccionado' : '');
    b.dataset.icono = ic.id;
    b.textContent = ic.emoji + ' ' + ic.nombre;
    b.addEventListener('click', () => {
      estado.icono = ic.id;
      iconosCaja.querySelectorAll('.chip').forEach((c) => c.classList.toggle('seleccionado', c.dataset.icono === ic.id));
    });
    iconosCaja.appendChild(b);
  });

  // --- Buscador de sitios ---
  const inputBuscar = $('f-buscar');
  inputBuscar.addEventListener('input', async () => {
    const q = normalizar(inputBuscar.value);
    if (q.length < 2) { resultados.textContent = ''; return; }
    if (!catalogo && !cargandoCatalogo) await asegurarCatalogo();
    if (!catalogo) return;
    const ya = new Set(estado.paradas.map((p) => p.place_key));
    const encontrados = catalogo
      .filter((p) => normalizar(p.nombre).includes(q))
      .filter((p) => !ya.has(claveDe(p.lat, p.lon)))
      .map((p) => ({ p, d: metros(SEVILLA, p), r: relevancia(p.nombre, q) }))
      .sort((a, b) => a.r - b.r || a.d - b.d)
      .slice(0, 10);
    pintarResultados(encontrados.map((x) => x.p));
  });

  // Cuanto más "de verdad" es la coincidencia, antes sale: nombre exacto,
  // una palabra entera, una palabra que empieza por lo buscado, y por último
  // lo que solo lo contiene en medio. A igualdad, lo más céntrico.
  function relevancia(nombre, q) {
    const n = normalizar(nombre);
    if (n === q) return 0;
    const palabras = n.split(/[\s,.\-–()]+/);
    if (palabras.indexOf(q) >= 0) return 1;
    if (palabras.some((w) => w.startsWith(q))) return 2;
    return 3;
  }

  async function asegurarCatalogo() {
    cargandoCatalogo = true;
    try { catalogo = await cargar(); } catch (e) { catalogo = null; }
    cargandoCatalogo = false;
  }

  function pintarResultados(lista) {
    resultados.textContent = '';
    lista.forEach((p) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'resultado';
      const punto = document.createElement('span');
      punto.className = 'punto';
      punto.style.background = colorFor(p.tipo);
      punto.textContent = emojiFor(p.tipo);
      const texto = document.createElement('span');
      const nombre = document.createElement('span');
      nombre.className = 'r-nombre';
      nombre.textContent = p.nombre;
      const meta = document.createElement('span');
      meta.className = 'r-meta';
      meta.textContent = labelFor(p.tipo);
      texto.append(nombre, meta);
      b.append(punto, texto);
      b.addEventListener('click', () => {
        agregarParada({
          nombre: p.nombre, lat: p.lat, lon: p.lon, tipo: p.tipo,
          place_key: claveDe(p.lat, p.lon), nota: '',
        });
        inputBuscar.value = '';
        resultados.textContent = '';
        inputBuscar.focus();
      });
      li.appendChild(b);
      resultados.appendChild(li);
    });
  }

  // --- Paradas ---
  function agregarParada(p) {
    if (estado.paradas.length >= 12) return;
    estado.paradas.push(p);
    pintarParadas();
    pintarMapa();
  }

  function pintarParadas() {
    paradasUl.textContent = '';
    estado.paradas.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'parada';

      const cab = document.createElement('div');
      cab.className = 'parada-cab';

      const num = document.createElement('span');
      num.className = 'parada-num';
      num.style.background = colorFor(p.tipo);
      num.style.color = textoSobre(colorFor(p.tipo));
      num.textContent = String(i + 1);

      const titulo = document.createElement('span');
      titulo.className = 'parada-titulo';
      const nombre = document.createElement('span');
      nombre.className = 'parada-nombre';
      nombre.textContent = p.nombre;
      const meta = document.createElement('span');
      meta.className = 'parada-meta';
      meta.textContent = labelFor(p.tipo);
      titulo.append(nombre, meta);

      const acciones = document.createElement('span');
      acciones.className = 'parada-acciones';
      acciones.append(
        botonAccion('↑', 'Subir', i === 0, () => mover(i, -1)),
        botonAccion('↓', 'Bajar', i === estado.paradas.length - 1, () => mover(i, 1)),
        botonAccion('✕', 'Quitar', false, () => {
          estado.paradas.splice(i, 1);
          pintarParadas();
          pintarMapa();
        }),
      );

      cab.append(num, titulo, acciones);
      li.appendChild(cab);

      const nota = document.createElement('textarea');
      nota.maxLength = 300;
      nota.placeholder = estado.paradas.length === 1
        ? 'Cuenta por qué merece la pena (obligatorio)'
        : 'Nota para esta parada (opcional)';
      nota.value = p.nota || '';
      nota.addEventListener('input', () => { p.nota = nota.value; });
      li.appendChild(nota);

      paradasUl.appendChild(li);
    });
  }

  function botonAccion(texto, titulo, deshabilitado, alPulsar) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    b.disabled = deshabilitado;
    b.addEventListener('click', alPulsar);
    return b;
  }

  function mover(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= estado.paradas.length) return;
    const tmp = estado.paradas[i];
    estado.paradas[i] = estado.paradas[j];
    estado.paradas[j] = tmp;
    pintarParadas();
    pintarMapa();
  }

  // --- Sesión ---
  function actualizarSesion(user) {
    usuario = user || null;
    if (usuario) {
      form.hidden = false;
      avisoLogin.hidden = true;
      misCaja.hidden = false;
      cargarMisRutas();
    } else {
      form.hidden = true;
      misCaja.hidden = true;
      avisoLogin.hidden = false;
    }
  }

  async function cargarMisRutas() {
    const cont = $('mis');
    cont.textContent = '';
    const { data, error } = await sb.rpc('fn_mis_rutas');
    if (error || !data) {
      cont.innerHTML = '<li class="mis-vacio">No se pudieron cargar tus rutas.</li>';
      return;
    }
    if (!data.length) {
      cont.innerHTML = '<li class="mis-vacio">Todavía no has creado ninguna ruta.</li>';
      return;
    }
    data.forEach((r) => cont.appendChild(fichaMiRuta(r)));
  }

  function fichaMiRuta(r) {
    const li = document.createElement('li');
    li.className = 'mi';
    const titulo = document.createElement('div');
    titulo.className = 'mi-titulo';
    titulo.textContent = r.nombre;
    const meta = document.createElement('div');
    meta.className = 'mi-meta';
    const est = document.createElement('span');
    est.className = 'estado ' + r.estado;
    const etiquetas = { pendiente: 'En revisión', aprobada: 'Publicada', rechazada: 'No se publicó' };
    est.textContent = etiquetas[r.estado] || r.estado;
    const fecha = document.createElement('span');
    fecha.className = 'mi-fecha';
    const d = new Date(r.created_at);
    if (!isNaN(d.getTime())) fecha.textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const n = (r.paradas || []).length;
    const paradas = document.createElement('span');
    paradas.className = 'mi-fecha';
    paradas.textContent = n + (n === 1 ? ' parada' : ' paradas');
    meta.append(est, paradas, fecha);
    li.append(titulo, meta);
    if (r.motivo_rechazo) {
      const motivo = document.createElement('div');
      motivo.className = 'mi-motivo';
      motivo.textContent = 'Motivo: ' + r.motivo_rechazo;
      li.appendChild(motivo);
    }
    return li;
  }

  // --- Envío ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector('.error');
    const okEl = form.querySelector('.ok');
    errorEl.style.display = 'none';
    okEl.style.display = 'none';

    const nombre = $('f-nombre').value.trim();
    const descripcion = $('f-desc').value.trim();
    const minutos = parseInt($('f-minutos').value, 10);

    const fallo = validar(nombre, descripcion, minutos);
    if (fallo) { mostrarError(errorEl, fallo); return; }

    const boton = $('btn-enviar');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      const paradas = estado.paradas.map((p) => ({
        nombre: p.nombre, lat: p.lat, lon: p.lon, tipo: p.tipo,
        place_key: p.place_key, nota: (p.nota || '').trim(),
      }));
      const { error } = await sb.rpc('fn_crear_ruta', {
        p_nombre: nombre,
        p_descripcion: descripcion,
        p_icono: estado.icono,
        p_minutos: minutos,
        p_paradas: paradas,
      });
      if (error) { mostrarError(errorEl, mensajeError(error)); return; }

      okEl.style.display = 'block';
      form.reset();
      estado.paradas = [];
      estado.icono = 'monumento';
      iconosCaja.querySelectorAll('.chip').forEach((c) => c.classList.toggle('seleccionado', c.dataset.icono === 'monumento'));
      pintarParadas();
      pintarMapa();
      cargarMisRutas();
      // Sin redirigir: la ruta nace pendiente, así que su sitio es "Mis rutas",
      // que está aquí abajo, y no la lista pública donde todavía no sale.
      misCaja.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      boton.disabled = false;
      boton.textContent = 'Enviar a revisión';
    }
  });

  function validar(nombre, descripcion, minutos) {
    if (nombre.length < 3 || nombre.length > 60) return 'El nombre debe tener entre 3 y 60 caracteres.';
    if (descripcion.length < 10 || descripcion.length > 200) return 'La descripción debe tener entre 10 y 200 caracteres.';
    if (!(minutos >= 10 && minutos <= 600)) return 'La duración debe estar entre 10 y 600 minutos.';
    if (estado.paradas.length < 1) return 'Añade al menos una parada.';
    if (estado.paradas.length > 12) return 'Una ruta lleva como mucho 12 paradas.';
    if (estado.paradas.length === 1 && !(estado.paradas[0].nota || '').trim()) {
      return 'Con una sola parada hay que contar por qué merece la pena.';
    }
    return null;
  }

  function mensajeError(error) {
    if (error.code === '23505') return 'Ya tienes una ruta con ese nombre. Ponle otro.';
    if (error.code === '23514' || error.code === '22001') return 'Hay algún dato que no cumple el formato. Revísalo.';
    if (error.code === 'P0001') return error.message || 'No se pudo enviar la ruta.';
    return 'No se pudo enviar. Inténtalo de nuevo.';
  }

  function mostrarError(el, texto) {
    el.textContent = texto;
    el.style.display = 'block';
  }

  // --- Arranque ---
  window.SEVI = window.SEVI || { sb: null, onAuth: [] };
  sb = window.SEVI.sb;
  $('btn-login').addEventListener('click', () => {
    if (!sb) return;
    sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  });
  if (sb) {
    window.SEVI.onAuth.push(actualizarSesion);
    sb.auth.getSession().then(({ data: { session } }) => actualizarSesion(session ? session.user : null));
  } else {
    actualizarSesion(null);
  }
})();
