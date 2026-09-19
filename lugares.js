// Lugares de SeviTime, compartidos por /explorar/ y /mapa/.
//
// Los sitios NO se piden a Overpass: se leen de la misma «foto diaria» que usa
// la app (tool/snapshot_lugares.mjs -> Storage). Es un JSON público con los
// sitios de Sevilla, CORS abierto y caché de una hora, así que se pide una vez
// y se filtra en local. Las categorías, colores y emojis están calcados de
// lib/models/place_types.dart y lib/theme/app_colors.dart para que web y app no
// se separen. Vive aquí, y no repetido en cada página, para que Explorar y el
// editor no se vayan separando con el tiempo —igual que se hizo con el estilo
// del mapa (mapa/estilo-mapa.js).
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

  // Un elemento del snapshot -> lugar listo para pintar o reportar. Se guardan
  // también `osmType`/`osmId` (no solo la URL) porque el editor los manda a
  // `reportes_lugares` para que la nota enlace el elemento exacto en OSM.
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
      osmType: e.type || null,
      osmId: e.id != null ? e.id : null,
    };
  }

  // Devuelve una promesa con el array de lugares ya convertidos y sin nulos.
  function cargar() {
    return fetch(SNAPSHOT_URL)
      .then((r) => r.json())
      .then((d) => (d.elements || []).map(aLugar).filter(Boolean));
  }

  window.sevitimeLugares = {
    SNAPSHOT_URL, SEVILLA, HISTORIA, CULTURA, PARQUES, IGLESIAS, GENERICOS, FILTROS,
    tipoDe, colorFor, emojiFor, labelFor, normalizar, metros, formatDist, aLugar, cargar,
  };
})();
