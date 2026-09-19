// Explorar desde el navegador.
//
// Los sitios NO se piden a Overpass: se leen de la misma «foto diaria» que usa
// la app (tool/snapshot_lugares.mjs -> Storage). Es un JSON público con los
// sitios de Sevilla, CORS abierto y caché de una hora, así que la web lo pide
// una vez y filtra en local. Las categorías y sus colores están calcados de
// lib/models/place_types.dart para que web y app no se separen.
(function () {
  'use strict';

  const SNAPSHOT_URL =
    'https://kdqiwhvtovafugpcrumf.supabase.co/storage/v1/object/public/snapshots/lugares-sevilla.json';
  const SEVILLA = { lat: 37.3891, lon: -5.9845 };

  // --- Tipos y categorías (espejo de place_types.dart) ---
  const HISTORIA = ['monument', 'memorial', 'castle', 'ruins', 'heritage', 'building',
    'heritage_building', 'manor', 'city_gate', 'citywalls', 'tower', 'watchtower',
    'aqueduct', 'bridge', 'archaeological_site', 'wayside_cross'];
  const CULTURA = ['museum', 'artwork', 'gallery', 'theatre', 'cinema', 'arts_centre', 'library'];
  const PARQUES = ['park', 'garden', 'nature_reserve'];
  const IGLESIAS = ['place_of_worship', 'mosque', 'synagogue'];

  const GENERICOS = { atm: 'Cajero automático', bank: 'Banco', toilets: 'Aseos públicos', drinking_water: 'Fuente de agua potable' };

  const FILTROS = [
    { id: 'todo', etiqueta: 'Todo', emoji: '📍', tipos: null },
    { id: 'bares', etiqueta: 'Bares', emoji: '🍻', tipos: ['bar', 'pub', 'biergarten'] },
    { id: 'restaurantes', etiqueta: 'Restaurantes', emoji: '🍽️', tipos: ['restaurant', 'fast_food'] },
    { id: 'cafes', etiqueta: 'Cafés', emoji: '☕', tipos: ['cafe', 'ice_cream'] },
    { id: 'monumentos', etiqueta: 'Monumentos', emoji: '🏛️', tipos: HISTORIA },
    { id: 'cultura', etiqueta: 'Cultura', emoji: '🖼️', tipos: CULTURA },
    { id: 'iglesias', etiqueta: 'Iglesias', emoji: '⛪', tipos: IGLESIAS },
    { id: 'parques', etiqueta: 'Parques', emoji: '🌳', tipos: PARQUES },
  ];

  function tipoDe(tags) {
    if (tags.amenity === 'place_of_worship') {
      const rel = (tags.religion || '').trim().toLowerCase();
      if (rel === 'muslim') return 'mosque';
      if (rel === 'jewish') return 'synagogue';
      return 'place_of_worship';
    }
    const principal = tags.historic || tags.tourism || tags.amenity || tags.leisure;
    if (typeof principal === 'string' && principal) return principal;
    const mm = (tags.man_made || '').trim().toLowerCase();
    if (mm === 'bridge' || mm === 'tower') return mm;
    return 'otro';
  }

  // Colores calcados de AppColors (lib/theme/app_colors.dart).
  function colorFor(tipo) {
    switch (tipo) {
      case 'bar': case 'pub': case 'biergarten': return '#5C6BC0';
      case 'restaurant': case 'fast_food': return '#EF6C00';
      case 'cafe': case 'ice_cream': return '#6D4C41';
      case 'parking': return '#3D6A7A';
      case 'pharmacy': case 'atm': case 'bank': return '#2E7D32';
      case 'toilets': case 'drinking_water': return '#0277BD';
      case 'park': case 'garden': case 'nature_reserve': return '#558B2F';
      case 'place_of_worship': case 'mosque': case 'synagogue': return '#8E6C3A';
      case 'museum': case 'artwork': case 'gallery': case 'theatre':
      case 'cinema': case 'arts_centre': case 'library': return '#9C27B0';
      default:
        if (HISTORIA.indexOf(tipo) >= 0) return '#795548';
        return '#00897B';
    }
  }

  function emojiFor(tipo) {
    switch (tipo) {
      case 'bar': return '🍺';
      case 'pub': case 'biergarten': return '🍻';
      case 'restaurant': return '🍽️';
      case 'fast_food': return '🍔';
      case 'cafe': return '☕';
      case 'ice_cream': return '🍨';
      case 'parking': return '🅿️';
      case 'pharmacy': return '💊';
      case 'atm': return '🏧';
      case 'bank': return '🏦';
      case 'toilets': return '🚻';
      case 'drinking_water': return '🚰';
      case 'park': case 'garden': case 'nature_reserve': return '🌳';
      case 'place_of_worship': case 'mosque': case 'synagogue': return '⛪';
      case 'museum': case 'gallery': case 'artwork': return '🖼️';
      case 'theatre': return '🎭';
      case 'cinema': return '🎬';
      case 'library': return '📚';
      case 'monument': case 'memorial': case 'castle': case 'ruins': return '🏛️';
      case 'city_gate': case 'citywalls': case 'tower': case 'watchtower': return '🏰';
      case 'bridge': case 'aqueduct': return '🌉';
      case 'attraction': case 'viewpoint': return '📸';
      default: return '📍';
    }
  }

  function labelFor(tipo) {
    const etiquetas = {
      bar: 'Bar', pub: 'Bar', biergarten: 'Terraza', restaurant: 'Restaurante',
      fast_food: 'Comida', cafe: 'Café', ice_cream: 'Heladería', parking: 'Parking',
      museum: 'Museo', artwork: 'Arte', gallery: 'Galería', theatre: 'Teatro',
      cinema: 'Cine', arts_centre: 'Centro cultural', library: 'Biblioteca',
      marketplace: 'Mercado', stadium: 'Estadio', park: 'Parque', garden: 'Jardín',
      nature_reserve: 'Espacio natural', toilets: 'Aseos', drinking_water: 'Fuente de agua',
      monument: 'Monumento', memorial: 'Memorial', castle: 'Castillo', ruins: 'Ruinas',
      heritage: 'Patrimonio', building: 'Edificio histórico', heritage_building: 'Edificio protegido',
      manor: 'Casa señorial', city_gate: 'Puerta', citywalls: 'Muralla', tower: 'Torre',
      watchtower: 'Torre', aqueduct: 'Acueducto', bridge: 'Puente',
      archaeological_site: 'Yacimiento', wayside_cross: 'Cruz', attraction: 'Atracción',
      pharmacy: 'Farmacia', atm: 'Cajero', bank: 'Banco', viewpoint: 'Mirador',
      place_of_worship: 'Iglesia', mosque: 'Mezquita', synagogue: 'Sinagoga',
    };
    return etiquetas[tipo] || 'Sitio';
  }

  // --- Utilidades ---
  function normalizar(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function metros(a, b) {
    const R = 6371000, rad = (d) => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function formatDist(m) {
    if (!isFinite(m)) return '';
    if (m < 1000) return Math.max(10, Math.round(m / 10) * 10) + ' m';
    return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  // --- Estado ---
  const estado = { todos: [], resultados: [], centro: { ...SEVILLA }, filtro: 'todo', texto: '' };

  const q = document.getElementById('q');
  const chips = document.getElementById('chips');
  const lista = document.getElementById('lista');
  const resumen = document.getElementById('resumen');
  const aviso = document.getElementById('aviso-ubicacion');
  const coleccionVacia = { type: 'FeatureCollection', features: [] };

  // --- Mapa ---
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)');

  const map = new maplibregl.Map({
    container: 'map',
    style: sevitimeEstiloMapa(prefiereOscuro.matches),
    center: [SEVILLA.lon, SEVILLA.lat],
    zoom: 13,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: false,
  }), 'top-right');

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

  map.on('click', 'sitios', (e) => {
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
  document.getElementById('usar-ubicacion').addEventListener('click', (e) => { e.preventDefault(); usarUbicacion(); });

  function usarUbicacion() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      estado.centro = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      aviso.hidden = true;
      map.flyTo({ center: [estado.centro.lon, estado.centro.lat], zoom: 14 });
      aplicar();
    }, () => { /* se queda en Sevilla centro */ }, { timeout: 8000 });
  }

  // --- Carga ---
  fetch(SNAPSHOT_URL)
    .then((r) => r.json())
    .then((d) => {
      estado.todos = (d.elements || []).map(aLugar).filter(Boolean);
      aviso.hidden = false;
      aplicar();
    })
    .catch(() => {
      resumen.textContent = 'No se pudieron cargar los sitios. Recarga en un momento.';
    });

  function aLugar(e) {
    const t = e.tags || {};
    const tipo = tipoDe(t);
    const nombre = (t.name || GENERICOS[tipo] || '').trim();
    if (!nombre) return null;
    const lat = e.lat != null ? e.lat : (e.center && e.center.lat);
    const lon = e.lon != null ? e.lon : (e.center && e.center.lon);
    if (lat == null || lon == null) return null;
    return {
      nombre, lat, lon, tipo,
      color: colorFor(tipo),
      emoji: emojiFor(tipo),
      label: labelFor(tipo),
      telefono: t.phone || t['contact:phone'] || '',
      web: t.website || t['contact:website'] || '',
      horario: t.opening_hours || '',
      osm: (e.type && e.id) ? 'https://www.openstreetmap.org/' + e.type + '/' + e.id : '',
    };
  }

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
    } else {
      resumen.textContent = r.length.toLocaleString('es-ES') +
        (r.length === 1 ? ' sitio' : ' sitios') +
        (estado.texto ? ' para «' + estado.texto.trim() + '»' : '');
      const frag = document.createDocumentFragment();
      r.slice(0, 60).forEach((p) => frag.appendChild(ficha(p)));
      lista.appendChild(frag);
    }

    // Mapa
    const features = r.slice(0, 200).map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        nombre: p.nombre, tipo: p.tipo, label: p.label, dist: p.dist,
        color: p.color, web: p.web, osm: p.osm, lat: p.lat, lon: p.lon,
      },
    }));
    const src = map.getSource('sitios');
    if (src) src.setData({ type: 'FeatureCollection', features });
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
    return el;
  }
})();
