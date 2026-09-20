// Explorar desde el navegador.
//
// Los sitios NO se piden a Overpass: se leen de la misma «foto diaria» que usa
// la app (tool/snapshot_lugares.mjs -> Storage). Es un JSON público con los
// sitios de Sevilla, CORS abierto y caché de una hora, así que la web lo pide
// una vez y filtra en local. Las categorías y sus colores están calcados de
// lib/models/place_types.dart para que web y app no se separen.
(function () {
  'use strict';

  // Tipos, categorías, colores y utilidades de lugares: módulo compartido con
  // /mapa/ (lugares.js), para que las dos páginas no se separen con el tiempo.
  const { SEVILLA, FILTROS, normalizar, metros, formatDist, cargar } = window.sevitimeLugares;

  // --- Estado ---
  const estado = { todos: [], resultados: [], centro: { ...SEVILLA }, filtro: 'todo', texto: '' };

  // Ubicación puesta a mano. Sin GPS en un PC, la del navegador cae donde la
  // red (Madrid, típicamente), así que se deja corregir y se recuerda.
  const CLAVE_UBIC = 'sevitime_ubicacion';
  function leerUbicGuardada() {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE_UBIC) || 'null');
      if (v && isFinite(v.lat) && isFinite(v.lon)) return { lat: v.lat, lon: v.lon };
    } catch (e) { /* sin almacén o JSON roto: se ignora */ }
    return null;
  }
  function guardarUbic(p) {
    try { localStorage.setItem(CLAVE_UBIC, JSON.stringify({ lat: p.lat, lon: p.lon })); } catch (e) { /* da igual */ }
  }
  function borrarUbic() {
    try { localStorage.removeItem(CLAVE_UBIC); } catch (e) { /* da igual */ }
  }

  const q = document.getElementById('q');
  const chips = document.getElementById('chips');
  const lista = document.getElementById('lista');
  const resumen = document.getElementById('resumen');
  const mapaResumen = document.getElementById('mapa-resumen');
  const aviso = document.getElementById('aviso-ubicacion');
  const coleccionVacia = { type: 'FeatureCollection', features: [] };

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

  // La web muestra toda la provincia. Solo encuadramos una vez al cargar los
  // datos para que los lugares no queden fuera de la vista inicial.
  let mapaEncuadrado = false;
  function encuadrarResultados(r) {
    if (mapaEncuadrado || !r.length) return;
    const bounds = new maplibregl.LngLatBounds();
    r.forEach((p) => bounds.extend([p.lon, p.lat]));
    if (bounds.isEmpty()) return;
    const ajustar = () => {
      if (mapaEncuadrado) return;
      map.fitBounds(bounds, { padding: 40, maxZoom: 11 });
      mapaEncuadrado = true;
    };
    if (map.loaded()) ajustar();
    else map.once('load', ajustar);
  }

  // Tu punto. Se pinta a mano en vez de con el control de MapLibre porque ese
  // arrastra la cámara a donde estés, y si estás lejos de Sevilla dejaría el
  // mapa sin un solo sitio a la vista.
  let yoMarker = null;
  function marcarYo(lat, lon) {
    if (!yoMarker) {
      const el = document.createElement('span');
      el.className = 'yo';
      el.title = 'Estás aquí';
      yoMarker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
    } else {
      yoMarker.setLngLat([lon, lat]);
    }
  }

  function montarCapas() {
    if (map.getSource('sitios')) return;
    map.addSource('sitios', { type: 'geojson', data: coleccionVacia });
    map.addLayer({
      id: 'sitios', type: 'circle', source: 'sitios',
      paint: {
        'circle-radius': 7,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255,255,255,0.9)',
      },
    });
    map.addLayer({
      id: 'sitios-label', type: 'symbol', source: 'sitios', minzoom: 15,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'nombre'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.1],
        'text-max-width': 8,
        'text-optional': true,
      },
      paint: {
        'text-color': prefiereOscuro.matches ? '#E8F0EF' : '#2c2c2c',
        'text-halo-color': prefiereOscuro.matches ? '#0F1C1A' : '#ffffff',
        'text-halo-width': 1.4,
      },
    });
  }
  map.on('load', montarCapas);
  map.on('styledata', montarCapas);
  prefiereOscuro.addEventListener('change', (e) => map.setStyle(sevitimeEstiloMapa(e.matches)));

  let colocando = false;

  // Clic en el mapa: si estamos en modo «poner mi ubicación», fija el punto.
  map.on('click', (e) => {
    if (!colocando) return;
    const punto = { lat: e.lngLat.lat, lon: e.lngLat.lng };
    estado.centro = punto;
    guardarUbic(punto);
    colocando = false;
    map.getCanvas().style.cursor = '';
    marcarYo(punto.lat, punto.lon);
    aplicar();
    setAviso('Ubicación puesta a mano.', 'Quitar', quitarUbicacion);
  });

  map.on('click', 'sitios', (e) => {
    if (colocando) return;
    const f = e.features[0];
    new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: '260px' })
      .setLngLat(f.geometry.coordinates)
      .setDOMContent(nodoPopup(f.properties))
      .addTo(map);
  });
  map.on('mouseenter', 'sitios', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'sitios', () => { map.getCanvas().style.cursor = ''; });

  // --- Chips ---
  FILTROS.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (f.id === 'todo' ? ' seleccionado' : '');
    b.dataset.filtro = f.id;
    b.textContent = f.emoji + ' ' + f.etiqueta;
    b.addEventListener('click', () => {
      estado.filtro = f.id;
      chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('seleccionado', c.dataset.filtro === f.id));
      aplicar();
    });
    chips.appendChild(b);
  });

  // --- Búsqueda y ubicación ---
  q.addEventListener('input', () => { estado.texto = q.value; aplicar(); });

  // Mensaje del estado de la ubicación, con una acción opcional.
  function setAviso(texto, accionTexto, accion) {
    aviso.textContent = texto;
    if (accionTexto) {
      aviso.append(' ');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = accionTexto;
      a.addEventListener('click', (e) => { e.preventDefault(); accion(); });
      aviso.appendChild(a);
    }
    aviso.hidden = false;
  }

  // Pedir la ubicación. El mapa es de Sevilla, así que una posición lejana no
  // se da por buena: en un PC el navegador no usa GPS, la calcula por red y
  // suele caer donde está el proveedor (Madrid, típicamente), no donde uno
  // está. Por eso:
  //  - si estás cerca, se pinta tu punto y la cámara va contigo;
  //  - si sales lejos, se ignora (se sigue en Sevilla) y se invita a fijarla a mano;
  //  - si falla o lo deniegas, se dice y se ofrece reintentar.
  function usarUbicacion() {
    if (!navigator.geolocation) {
      setAviso('Tu navegador no sabe darte la ubicación. Fíjala con el botón 📍 del mapa.', null, null);
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const punto = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      if (metros(SEVILLA, punto) < 40000) {
        estado.centro = punto;
        marcarYo(punto.lat, punto.lon);
        aplicar();
        aviso.hidden = true;
        map.flyTo({ center: [punto.lon, punto.lat], zoom: 14 });
        return;
      }
      const km = Math.round(metros(SEVILLA, punto) / 1000);
      setAviso(
        'Tu navegador te sitúa a ' + km + ' km de Sevilla (en un PC eso suele ser la ubicación de la red, no la tuya), así que se ordena desde Sevilla. Fija dónde estás con el botón 📍 del mapa.',
        null, null);
    }, (err) => {
      setAviso(
        err && err.code === 1
          ? 'Le has dicho que no al navegador. Actívalo en el candado de la barra de direcciones.'
          : 'No pudimos saber dónde estás.',
        'Reintentar', usarUbicacion);
    }, { timeout: 8000, maximumAge: 600000 });
  }

  // Poner la ubicación a mano: se entra en modo y el siguiente clic en el mapa
  // la fija y la recuerda. Es la vía fiable en un PC.
  function iniciarColocar() {
    colocando = true;
    map.getCanvas().style.cursor = 'crosshair';
    setAviso('Toca en el mapa el sitio donde estás.', 'Cancelar', cancelarColocar);
  }
  function cancelarColocar() {
    colocando = false;
    map.getCanvas().style.cursor = '';
    aviso.hidden = true;
  }
  function quitarUbicacion() {
    borrarUbic();
    if (yoMarker) { yoMarker.remove(); yoMarker = null; }
    estado.centro = { ...SEVILLA };
    aplicar();
    aviso.hidden = true;
    usarUbicacion();
  }

  // Botón «Mi ubicación» en el mapa: al pulsarlo, centra aunque estés lejos.
  class BotonUbicacion {
    onAdd(mapa) {
      this._mapa = mapa;
      const div = document.createElement('div');
      div.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      const b = document.createElement('button');
      b.type = 'button';
      b.title = 'Mi ubicación';
      b.setAttribute('aria-label', 'Mi ubicación');
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3A9 9 0 0013 3.06V1h-2v2.06A9 9 0 003.06 11H1v2h2.06A9 9 0 0011 20.94V23h2v-2.06A9 9 0 0020.94 13H23v-2h-2.06zM12 19a7 7 0 110-14 7 7 0 010 14z"/></svg>';
      b.addEventListener('click', usarUbicacion);
      div.appendChild(b);
      this._cont = div;
      return div;
    }
    onRemove() { this._cont.parentNode.removeChild(this._cont); this._mapa = undefined; }
  }
  map.addControl(new BotonUbicacion(), 'top-right');

  // Botón «Poner mi ubicación a mano»: un clic en el mapa y queda fijada.
  class BotonColocar {
    onAdd(mapa) {
      this._mapa = mapa;
      const div = document.createElement('div');
      div.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      const b = document.createElement('button');
      b.type = 'button';
      b.title = 'Poner mi ubicación en el mapa';
      b.setAttribute('aria-label', 'Poner mi ubicación en el mapa');
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
      b.addEventListener('click', iniciarColocar);
      div.appendChild(b);
      this._cont = div;
      return div;
    }
    onRemove() { this._cont.parentNode.removeChild(this._cont); this._mapa = undefined; }
  }
  map.addControl(new BotonColocar(), 'top-right');

  // --- Carga ---
  // Si hay ubicación puesta a mano, manda ella: no se molesta con el permiso
  // del navegador.
  const guardada = leerUbicGuardada();
  if (guardada) {
    estado.centro = guardada;
    marcarYo(guardada.lat, guardada.lon);
    setAviso('Ubicación puesta a mano.', 'Quitar', quitarUbicacion);
  }

  function cargarSitios() {
    resumen.textContent = 'Cargando los sitios de Sevilla…';
    mapaResumen.textContent = 'Cargando lugares…';
    lista.textContent = '';

    cargar()
      .then((lugares) => {
        estado.todos = lugares;
        aplicar();
        if (!guardada) usarUbicacion();
      })
      .catch(() => {
        // Antes el panel lateral avisaba, pero el mapa seguía diciendo
        // «Cargando». Ambos estados deben explicar el fallo y permitir salir
        // de él sin obligar a recargar toda la página.
        resumen.textContent = '';
        const texto = document.createTextNode('No se pudieron cargar los sitios. ');
        const reintentar = document.createElement('a');
        reintentar.href = '#';
        reintentar.textContent = 'Reintentar';
        reintentar.addEventListener('click', (event) => {
          event.preventDefault();
          cargarSitios();
        });
        resumen.append(texto, reintentar);
        mapaResumen.textContent = 'No se pudieron cargar los lugares';
      });
  }

  cargarSitios();

  function aplicar() {
    const nq = normalizar(estado.texto);
    const filtro = FILTROS.find((f) => f.id === estado.filtro);
    const tipos = filtro ? filtro.tipos : null;

    const r = estado.todos.filter((p) => {
      if (tipos && tipos.indexOf(p.tipo) < 0) return false;
      if (nq && normalizar(p.nombre).indexOf(nq) < 0) return false;
      return true;
    });
    r.forEach((p) => { p.dist = metros(estado.centro, p); });
    r.sort((a, b) => a.dist - b.dist);
    estado.resultados = r;
    pintar(r);
  }

  function pintar(r) {
    // Lista
    lista.textContent = '';
    if (!r.length) {
      resumen.textContent = 'Nada por aquí con esos filtros.';
      mapaResumen.textContent = 'No hay lugares con esos filtros';
    } else {
      resumen.textContent = r.length.toLocaleString('es-ES') +
        (r.length === 1 ? ' sitio' : ' sitios') +
        (estado.texto ? ' para «' + estado.texto.trim() + '»' : '');
      mapaResumen.textContent = r.length.toLocaleString('es-ES') +
        (r.length === 1 ? ' sitio en el mapa' : ' sitios en el mapa');
      const frag = document.createDocumentFragment();
      r.slice(0, 60).forEach((p) => frag.appendChild(ficha(p)));
      lista.appendChild(frag);
    }

    // Mapa
    // No limitar por distancia: el mapa web debe cubrir toda la provincia.
    // La lista sí conserva su límite visual independiente del mapa.
    const features = r.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        nombre: p.nombre, tipo: p.tipo, label: p.label, dist: p.dist,
        color: p.color, web: p.web, osm: p.osm, lat: p.lat, lon: p.lon,
      },
    }));
    const src = map.getSource('sitios');
    if (src) src.setData({ type: 'FeatureCollection', features });
    encuadrarResultados(r);
  }

  function ficha(p) {
    const li = document.createElement('li');
    li.className = 'ficha';
    li.tabIndex = 0;
    li.dataset.lat = p.lat;
    li.dataset.lon = p.lon;
    li.dataset.i = estado.resultados.indexOf(p);

    const punto = document.createElement('span');
    punto.className = 'punto';
    punto.style.background = p.color;
    punto.textContent = p.emoji;

    const texto = document.createElement('span');
    texto.className = 'texto';
    const nombre = document.createElement('span');
    nombre.className = 'nombre';
    nombre.textContent = p.nombre;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = p.label + ' · ' + formatDist(p.dist);
    texto.append(nombre, meta);
    li.append(punto, texto);

    const ir = () => abrir(p);
    li.addEventListener('click', ir);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
    return li;
  }

  function abrir(p) {
    map.flyTo({ center: [p.lon, p.lat], zoom: 16 });
    new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: '260px' })
      .setLngLat([p.lon, p.lat])
      .setDOMContent(nodoPopup({
        nombre: p.nombre, label: p.label, dist: p.dist, web: p.web, osm: p.osm,
        lat: p.lat, lon: p.lon,
      }))
      .addTo(map);
  }

  function nodoPopup(props) {
    const el = document.createElement('div');
    el.className = 'popup';
    const nombre = document.createElement('div');
    nombre.className = 'nombre';
    nombre.textContent = props.nombre;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = (props.label || '') + (props.dist != null ? ' · ' + formatDist(props.dist) : '');
    el.append(nombre, meta);

    const enlaces = document.createElement('div');
    if (props.web) {
      const a = document.createElement('a');
      a.href = props.web; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Web';
      enlaces.appendChild(a);
      enlaces.append(' · ');
    }
    if (props.osm) {
      const a = document.createElement('a');
      a.href = props.osm; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'OpenStreetMap';
      enlaces.appendChild(a);
      enlaces.append(' · ');
    }
    const g = document.createElement('a');
    g.href = 'https://www.google.com/maps/search/?api=1&query=' + props.lat + ',' + props.lon;
    g.target = '_blank'; g.rel = 'noopener';
    g.textContent = 'Cómo llegar';
    enlaces.appendChild(g);
    el.appendChild(enlaces);

    // Este mapa solo enseña; para aportar hay que ir al editor.
    const editor = document.createElement('div');
    editor.className = 'editor';
    const ea = document.createElement('a');
    ea.href = '/mapa/';
    ea.textContent = '¿Algo mal? Corregir en el mapa web';
    editor.appendChild(ea);
    el.appendChild(editor);
    return el;
  }
})();
