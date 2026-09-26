// Lugares de SeviTime, compartidos por /explorar/ y /mapa/.
//
// Los sitios NO se piden a Overpass: se leen de la misma «foto diaria» que usa
// la app (tool/snapshot_lugares.mjs -> Storage). Es un JSON público con los
// sitios de Sevilla, CORS abierto y caché de una hora, así que se pide una vez
// y se filtra en local.
//
// Las categorías, colores y emojis (bloque CATEGORIAS_LUGARES, más abajo) ya
// no se escriben a mano: los genera `dart run
// tool/generar_categorias_lugares.dart` en el repo de la app, desde
// lib/models/place_categories_data.dart, y `tool/actualizar_categorias.mjs`
// (en este repo) los copia aquí. Antes había que mantener dos copias
// calcadas a mano, una en Dart y otra en JS, y se separaban sin avisar.
//
// Vive aquí, y no repetido en cada página, para que Explorar y el editor no
// se vayan separando con el tiempo —igual que se hizo con el estilo del mapa
// (mapa/estilo-mapa.js).
(function () {
  'use strict';

  const SNAPSHOT_URL =
    'https://kdqiwhvtovafugpcrumf.supabase.co/storage/v1/object/public/snapshots/lugares-sevilla.json';
  const SEVILLA = { lat: 37.3891, lon: -5.9845 };

  // Para leer las altas manuales (lectura pública). Mismo proyecto y clave
  // publicable que el resto de la web.
  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  // ===== INICIO categorias-lugares (generado, no editar a mano) =====
// Fuente: sevitime/lib/models/place_categories_data.dart. Para cambiar
// un tipo o un filtro, edita ese fichero, ejecuta allí
// "dart run tool/generar_categorias_lugares.dart" y luego aquí
// "node tool/actualizar_categorias.mjs".
const CATEGORIAS_LUGARES = {
  "version": 1,
  "tipos": {
    "bar": {
      "categoria": "hosteleria",
      "etiqueta": "Bar",
      "emoji": "🍺",
      "color": "#5C6BC0"
    },
    "pub": {
      "categoria": "hosteleria",
      "etiqueta": "Bar",
      "emoji": "🍻",
      "color": "#5C6BC0"
    },
    "biergarten": {
      "categoria": "hosteleria",
      "etiqueta": "Terraza",
      "emoji": "🍻",
      "color": "#5C6BC0"
    },
    "restaurant": {
      "categoria": "hosteleria",
      "etiqueta": "Restaurante",
      "emoji": "🍽️",
      "color": "#EF6C00"
    },
    "fast_food": {
      "categoria": "hosteleria",
      "etiqueta": "Comida",
      "emoji": "🍔",
      "color": "#EF6C00"
    },
    "cafe": {
      "categoria": "hosteleria",
      "etiqueta": "Café",
      "emoji": "☕",
      "color": "#6D4C41"
    },
    "ice_cream": {
      "categoria": "hosteleria",
      "etiqueta": "Heladería",
      "emoji": "🍨",
      "color": "#6D4C41"
    },
    "parking": {
      "categoria": "servicios",
      "etiqueta": "Parking",
      "emoji": "🅿️",
      "color": "#3D6A7A"
    },
    "pharmacy": {
      "categoria": "servicios",
      "etiqueta": "Farmacia",
      "emoji": "💊",
      "color": "#2E7D32"
    },
    "atm": {
      "categoria": "servicios",
      "etiqueta": "Cajero",
      "emoji": "🏧",
      "color": "#2E7D32"
    },
    "bank": {
      "categoria": "servicios",
      "etiqueta": "Banco",
      "emoji": "🏦",
      "color": "#2E7D32"
    },
    "toilets": {
      "categoria": "aseos",
      "etiqueta": "Aseos",
      "emoji": "🚻",
      "color": "#0277BD"
    },
    "drinking_water": {
      "categoria": "aseos",
      "etiqueta": "Fuente de agua",
      "emoji": "🚰",
      "color": "#0277BD"
    },
    "park": {
      "categoria": "parques",
      "etiqueta": "Parque",
      "emoji": "🌳",
      "color": "#558B2F"
    },
    "garden": {
      "categoria": "parques",
      "etiqueta": "Jardín",
      "emoji": "🌳",
      "color": "#558B2F"
    },
    "nature_reserve": {
      "categoria": "parques",
      "etiqueta": "Espacio natural",
      "emoji": "🌳",
      "color": "#558B2F"
    },
    "place_of_worship": {
      "categoria": "iglesias",
      "etiqueta": "Iglesia",
      "emoji": "⛪",
      "color": "#8E6C3A"
    },
    "mosque": {
      "categoria": "iglesias",
      "etiqueta": "Mezquita",
      "emoji": "⛪",
      "color": "#8E6C3A"
    },
    "synagogue": {
      "categoria": "iglesias",
      "etiqueta": "Sinagoga",
      "emoji": "⛪",
      "color": "#8E6C3A"
    },
    "museum": {
      "categoria": "cultura",
      "etiqueta": "Museo",
      "emoji": "🖼️",
      "color": "#9C27B0"
    },
    "artwork": {
      "categoria": "cultura",
      "etiqueta": "Arte",
      "emoji": "🖼️",
      "color": "#9C27B0"
    },
    "gallery": {
      "categoria": "cultura",
      "etiqueta": "Galería",
      "emoji": "🖼️",
      "color": "#9C27B0"
    },
    "theatre": {
      "categoria": "cultura",
      "etiqueta": "Teatro",
      "emoji": "🎭",
      "color": "#9C27B0"
    },
    "cinema": {
      "categoria": "cultura",
      "etiqueta": "Cine",
      "emoji": "🎬",
      "color": "#9C27B0"
    },
    "arts_centre": {
      "categoria": "cultura",
      "etiqueta": "Centro cultural",
      "emoji": "🎨",
      "color": "#9C27B0"
    },
    "library": {
      "categoria": "cultura",
      "etiqueta": "Biblioteca",
      "emoji": "📚",
      "color": "#9C27B0"
    },
    "monument": {
      "categoria": "historia",
      "etiqueta": "Monumento",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "memorial": {
      "categoria": "historia",
      "etiqueta": "Memorial",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "castle": {
      "categoria": "historia",
      "etiqueta": "Castillo",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "ruins": {
      "categoria": "historia",
      "etiqueta": "Ruinas",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "heritage": {
      "categoria": "historia",
      "etiqueta": "Patrimonio",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "building": {
      "categoria": "historia",
      "etiqueta": "Edificio histórico",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "heritage_building": {
      "categoria": "historia",
      "etiqueta": "Edificio protegido",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "manor": {
      "categoria": "historia",
      "etiqueta": "Casa señorial",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "city_gate": {
      "categoria": "historia",
      "etiqueta": "Puerta",
      "emoji": "🏰",
      "color": "#795548"
    },
    "citywalls": {
      "categoria": "historia",
      "etiqueta": "Muralla",
      "emoji": "🏰",
      "color": "#795548"
    },
    "tower": {
      "categoria": "historia",
      "etiqueta": "Torre",
      "emoji": "🏰",
      "color": "#795548"
    },
    "watchtower": {
      "categoria": "historia",
      "etiqueta": "Torre",
      "emoji": "🏰",
      "color": "#795548"
    },
    "aqueduct": {
      "categoria": "historia",
      "etiqueta": "Acueducto",
      "emoji": "🌉",
      "color": "#795548"
    },
    "bridge": {
      "categoria": "historia",
      "etiqueta": "Puente",
      "emoji": "🌉",
      "color": "#795548"
    },
    "archaeological_site": {
      "categoria": "historia",
      "etiqueta": "Yacimiento",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "wayside_cross": {
      "categoria": "historia",
      "etiqueta": "Cruz",
      "emoji": "🏛️",
      "color": "#795548"
    },
    "attraction": {
      "categoria": "atracciones",
      "etiqueta": "Atracción",
      "emoji": "📸",
      "color": "#00897B"
    },
    "viewpoint": {
      "categoria": "atracciones",
      "etiqueta": "Mirador",
      "emoji": "📸",
      "color": "#00897B"
    },
    "marketplace": {
      "categoria": "atracciones",
      "etiqueta": "Mercado",
      "emoji": "🛍️",
      "color": "#00897B"
    },
    "stadium": {
      "categoria": "atracciones",
      "etiqueta": "Estadio",
      "emoji": "🏟️",
      "color": "#00897B"
    }
  },
  "otros": {
    "categoria": "otros",
    "etiqueta": "Sitio",
    "emoji": "📍",
    "color": "#00897B"
  },
  "filtros": [
    {
      "id": "todo",
      "etiqueta": "Todo",
      "emoji": "📍",
      "tipos": null
    },
    {
      "id": "bares",
      "etiqueta": "Bares",
      "emoji": "🍻",
      "tipos": [
        "bar",
        "pub",
        "biergarten"
      ]
    },
    {
      "id": "restaurantes",
      "etiqueta": "Restaurantes",
      "emoji": "🍽️",
      "tipos": [
        "restaurant",
        "fast_food"
      ]
    },
    {
      "id": "cafes",
      "etiqueta": "Cafés",
      "emoji": "☕",
      "tipos": [
        "cafe",
        "ice_cream"
      ]
    },
    {
      "id": "monumentos",
      "etiqueta": "Monumentos",
      "emoji": "🏛️",
      "tipos": [
        "monument",
        "memorial",
        "castle",
        "ruins",
        "heritage",
        "building",
        "heritage_building",
        "manor",
        "city_gate",
        "citywalls",
        "tower",
        "watchtower",
        "aqueduct",
        "bridge",
        "archaeological_site",
        "wayside_cross"
      ]
    },
    {
      "id": "cultura",
      "etiqueta": "Cultura",
      "emoji": "🖼️",
      "tipos": [
        "museum",
        "artwork",
        "gallery",
        "theatre",
        "cinema",
        "arts_centre",
        "library"
      ]
    },
    {
      "id": "iglesias",
      "etiqueta": "Iglesias",
      "emoji": "⛪",
      "tipos": [
        "place_of_worship",
        "mosque",
        "synagogue"
      ]
    },
    {
      "id": "parques",
      "etiqueta": "Parques",
      "emoji": "🌳",
      "tipos": [
        "park",
        "garden",
        "nature_reserve"
      ]
    }
  ],
  "genericos": {
    "atm": "Cajero automático",
    "bank": "Banco",
    "toilets": "Aseos públicos",
    "drinking_water": "Fuente de agua potable"
  }
};
// ===== FIN categorias-lugares =====

  const GENERICOS = CATEGORIAS_LUGARES.genericos;

  const FILTROS = CATEGORIAS_LUGARES.filtros;

  function tiposDeCategoria(categoria) {
    return Object.keys(CATEGORIAS_LUGARES.tipos)
      .filter((t) => CATEGORIAS_LUGARES.tipos[t].categoria === categoria);
  }

  // Se mantienen como arrays sueltos porque los usa el editor de rutas para
  // agrupar el mapa por familia, igual que antes.
  const HISTORIA = tiposDeCategoria('historia');
  const CULTURA = tiposDeCategoria('cultura');
  const PARQUES = tiposDeCategoria('parques');
  const IGLESIAS = tiposDeCategoria('iglesias');

  function infoDe(tipo) {
    return CATEGORIAS_LUGARES.tipos[tipo] || CATEGORIAS_LUGARES.otros;
  }

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

  function colorFor(tipo) {
    return infoDe(tipo).color;
  }

  function emojiFor(tipo) {
    return infoDe(tipo).emoji;
  }

  function labelFor(tipo) {
    return infoDe(tipo).etiqueta;
  }

  // Color de texto legible (blanco o negro) para poner sobre un fondo dado.
  // Los colores de categoría no cambian con el tema, así que el mismo cálculo
  // vale para claro y oscuro. Con el blanco, el naranja (#EF6C00, 3,08), el
  // oliva (#558B2F, 4,10) y el verde de marca (#00897B, 4,32) se quedan por
  // debajo del 4,5:1 que pide AA para texto menudo; en esos se pasa a negro.
  function textoSobre(color) {
    const m = /^#?([0-9a-f]{6})$/i.exec(color || '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return 1.05 / (L + 0.05) >= 4.5 ? '#fff' : '#000';
  }

  // --- Utilidades ---
  function normalizar(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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

  // La clave de un lugar, `"lat_lon"` con 5 decimales. Replica
  // `Place.placeKey` de la app (`toStringAsFixed(5)`): es lo que guardan las
  // paradas de ruta y las reseñas para reconocer un sitio aunque le cambien
  // el nombre.
  function claveDe(lat, lon) {
    return lat.toFixed(5) + '_' + lon.toFixed(5);
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

  // --- Mismo sitio en OSM y en las altas manuales --------------------------
  //
  // Réplica de `DuplicateCheckService.sonMismoLugar` de la app, con los mismos
  // casos de prueba (`tool/mismo_lugar.test.mjs`). Antes la web solo juntaba
  // un alta con OSM si caían en el mismo punto al milímetro, y el mapeador casi
  // nunca pone el punto donde el nuestro: el 26-sep-2026 salían duplicados
  // Burger Up!, Shayka, Caprixo, Lamprea, C.D. Demo y Ronda Alamillo.

  function normalizarNombre(s) {
    return normalizar(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Palabras que dicen qué es el sitio, no cuál.
  const GENERICAS = new Set([
    'bar', 'bares', 'cafeteria', 'cafe', 'cerveceria', 'restaurante',
    'taberna', 'bodega', 'pub', 'meson', 'freiduria', 'heladeria',
    'pasteleria', 'confiteria', 'casa', 'el', 'la', 'los', 'las', 'de',
    'del', 'y',
  ]);

  // El nombre sin lo genérico ni espacios, con las letras que suenan igual
  // igualadas: «Cafetería Kimera» y «Quimera» dan lo mismo.
  function nucleo(n) {
    return n.split(' ').filter((w) => w && !GENERICAS.has(w)).join('')
      .replace(/qu/g, 'k')
      .replace(/c([ei])/g, 's$1')
      .replace(/c/g, 'k')
      .replace(/z/g, 's')
      .replace(/v/g, 'b')
      .replace(/ll/g, 'y')
      .replace(/h/g, '');
  }

  function distanciaEdicion(a, b) {
    let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const actual = [i];
      for (let j = 1; j <= b.length; j++) {
        const coste = a[i - 1] === b[j - 1] ? 0 : 1;
        actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + coste);
      }
      previa = actual;
    }
    return previa[b.length];
  }

  // Una letra de diferencia a partir de 6, dos a partir de 10; por debajo,
  // iguales: «Bar Pepe» y «Bar Pepa» pueden ser vecinos.
  function casiIguales(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const corto = Math.min(a.length, b.length);
    const margen = corto >= 10 ? 2 : (corto >= 6 ? 1 : 0);
    if (margen === 0 || Math.abs(a.length - b.length) > margen) return false;
    return distanciaEdicion(a, b) <= margen;
  }

  function pareceElMismo(a, b) {
    if (!a || !b) return false;
    if (a.includes(b) || b.includes(a)) return true;
    const primera = (n) => n.split(' ').find((w) => w.length >= 4) || '';
    const pa = primera(a), pb = primera(b);
    if (pa && pa === pb) return true;
    return casiIguales(nucleo(a), nucleo(b));
  }

  function sonMismoLugar(a, b, radioM = 80) {
    if (metros(a, b) > radioM) return false;
    return pareceElMismo(normalizarNombre(a.nombre), normalizarNombre(b.nombre));
  }

  // --- Sitios ocultos (`lugares_ocultos`) -----------------------------------
  //
  // Los cerrados que se aprueban en la app, y los que se tapan para dejar
  // sitio a un alta (el «Bar» de OSM bajo La Paraíta Los Militares). La web no
  // los leía y seguía enseñándolos. Misma regla que `LugaresOcultos` en la
  // app: se oculta cuando coinciden el nombre y el sitio (por la clave de
  // coordenadas o por el elemento de OSM); sin coordenadas, solo el nombre.
  function ocultos() {
    const cabeceras = {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    };
    const url = SUPABASE_URL +
      '/rest/v1/lugares_ocultos?activo=eq.true' +
      '&select=nombre_lugar,lat,lon,osm_type,osm_id';
    return fetch(url, { headers: cabeceras })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }

  function estaOculto(p, filas) {
    const nombre = p.nombre.toLowerCase();
    return filas.some((o) => {
      if ((o.nombre_lugar || '').toLowerCase() !== nombre) return false;
      if (o.lat == null || o.lon == null) return true;
      if (claveDe(o.lat, o.lon) === claveDe(p.lat, p.lon)) return true;
      return o.osm_id != null && o.osm_id === p.osmId &&
        (o.osm_type == null || o.osm_type === p.osmType);
    });
  }

  // Tipos en español de las altas manuales -> tipo canónico de la web. Los
  // mismos que la app (`lib/services/manual_places_service.dart`).
  const TIPO_ES = {
    'restaurante': 'restaurant', 'cafetería': 'cafe', 'cafeteria': 'cafe',
    'comida rápida': 'fast_food', 'comida rapida': 'fast_food',
    'atracción': 'attraction', 'atraccion': 'attraction', 'mirador': 'viewpoint',
    'museo': 'museum', 'galería': 'gallery', 'galeria': 'gallery',
    'monumento': 'monument', 'castillo': 'castle', 'ruinas': 'ruins',
    'patrimonio': 'heritage', 'heladería': 'ice_cream', 'heladeria': 'ice_cream',
    'teatro': 'theatre', 'cine': 'cinema', 'biblioteca': 'library',
    'centro cultural': 'arts_centre', 'mercado': 'marketplace',
    'puente': 'bridge', 'torre': 'tower', 'puerta': 'city_gate',
    'muralla': 'citywalls', 'acueducto': 'aqueduct',
    'edificio histórico': 'building', 'edificio historico': 'building',
    'yacimiento': 'archaeological_site', 'aparcamiento': 'parking',
    'farmacia': 'pharmacy', 'cajero': 'atm', 'banco': 'bank',
  };

  function normalizarTipo(t) {
    const k = (t || 'bar').toLowerCase().trim();
    return TIPO_ES[k] || k;
  }

  // Altas manuales (`lugares_manuales`): lo que se crea al aprobar una
  // sugerencia o un renombrado, para que el sitio aparezca ya sin esperar a
  // OSM. La app las mezcla en caliente; sin esto, la web no las veía y lo que
  // se aprobaba en la app no coincidía aquí. Son de lectura pública.
  function manuales() {
    const cabeceras = {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    };
    const url = SUPABASE_URL +
      '/rest/v1/lugares_manuales?activo=eq.true' +
      '&select=nombre,tipo,lat,lon,telefono,web,horario';
    return fetch(url, { headers: cabeceras })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }

  // Los datos editoriales no hacen falta para dibujar miles de pines. Se
  // piden solo al abrir la ficha de un sitio y se guardan por nombre durante
  // la visita. Así la web enseña la misma información enriquecida que la app
  // sin hacer más pesada la carga inicial del mapa.
  const curadosEnCache = new Map();

  function filasCuradas(nombre) {
    if (curadosEnCache.has(nombre)) return curadosEnCache.get(nombre);
    const cabeceras = {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    };
    const url = SUPABASE_URL +
      '/rest/v1/curated_places?name=eq.' + encodeURIComponent(nombre) +
      '&select=name,description,tags,image_url,verified_hours,lat,lon,curated_rating';
    const carga = fetch(url, { headers: cabeceras })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    curadosEnCache.set(nombre, carga);
    return carga;
  }

  // Igual que CuratedPlacesService.fetchForPlace en la app: si hay dos sitios
  // con el mismo nombre, gana el que tenga coordenadas más cercanas. Una fila
  // sin coordenadas solo sirve de respaldo.
  function cargarCurado(nombre, lat, lon) {
    return filasCuradas(nombre).then((filas) => {
      if (!filas.length) return null;
      let mejor = null;
      let mejorDistancia = Infinity;
      for (const fila of filas) {
        if (fila.lat == null || fila.lon == null) {
          mejor = mejor || fila;
          continue;
        }
        const dLat = lat - fila.lat;
        const dLon = lon - fila.lon;
        const distancia = dLat * dLat + dLon * dLon;
        if (distancia < mejorDistancia) {
          mejorDistancia = distancia;
          mejor = fila;
        }
      }
      return mejor;
    });
  }

  // Un alta manual -> lugar con la misma forma que los de la foto.
  function aLugarManual(m) {
    const nombre = (m.nombre || '').trim();
    if (!nombre || m.lat == null || m.lon == null) return null;
    const tipo = normalizarTipo(m.tipo);
    return {
      nombre, lat: m.lat, lon: m.lon, tipo,
      color: colorFor(tipo), emoji: emojiFor(tipo), label: labelFor(tipo),
      telefono: m.telefono || '', web: m.web || '', horario: m.horario || '',
      osm: '', osmType: null, osmId: null,
    };
  }

  // Junta las altas con la foto como `_mergeManualPlaces` en la app: si OSM
  // ya tiene el sitio, se enseña el de OSM (más probable que esté al día y es
  // donde cuelgan las reseñas) completado con lo que OSM no tenga; si no, el
  // alta entra como un sitio más.
  function juntar(snap, man) {
    const vistos = new Set(snap.map((p) => claveDe(p.lat, p.lon)));
    for (const m of man) {
      // Un cuadrado de ~100 m antes de medir: son miles de sitios por alta.
      const cerca = snap.filter((p) =>
        Math.abs(p.lat - m.lat) < 0.001 && Math.abs(p.lon - m.lon) < 0.0013);
      const osm = cerca.find((p) => sonMismoLugar(p, m));
      if (osm) {
        osm.telefono = osm.telefono || m.telefono;
        osm.web = osm.web || m.web;
        osm.horario = osm.horario || m.horario;
        continue;
      }
      const k = claveDe(m.lat, m.lon);
      if (vistos.has(k)) continue;
      vistos.add(k);
      snap.push(m);
    }
    return snap;
  }

  // Devuelve una promesa con el array de lugares ya convertidos y sin nulos:
  // la foto diaria de OSM (la misma que lee la app) **más las altas manuales**
  // y **menos los ocultos**, en el mismo orden que la app.
  function cargar() {
    return Promise.all([
      fetch(SNAPSHOT_URL)
        .then((r) => r.json())
        .then((d) => (d.elements || []).map(aLugar).filter(Boolean)),
      manuales().then((filas) => filas.map(aLugarManual).filter(Boolean)),
      ocultos(),
    ]).then(([snap, man, filasOcultas]) => {
      const visible = (p) => !estaOculto(p, filasOcultas);
      // Los ocultos se quitan ANTES de juntar: si no, un alta en el mismo
      // punto que un sitio oculto (La Paraíta sobre el «Bar» de OSM) se
      // descartaba por repetida y luego se ocultaba el otro, y no quedaba
      // ninguno. Y otra vez al final, por si la oculta es un alta.
      return juntar(snap.filter(visible), man).filter(visible);
    });
  }

  window.sevitimeLugares = {
    SNAPSHOT_URL, SEVILLA, HISTORIA, CULTURA, PARQUES, IGLESIAS, GENERICOS, FILTROS,
    tipoDe, colorFor, emojiFor, labelFor, textoSobre, normalizar, metros, formatDist, claveDe, aLugar, cargar,
    sonMismoLugar, juntar, estaOculto,
    cargarCurado,
  };
})();
