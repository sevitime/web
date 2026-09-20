// Estilo del basemap propio (PMTiles de la provincia), compartido por /mapa/ y
// /explorar/. Vive aquí, y no repetido en cada página, para que los dos mapas
// no se separen con el tiempo.
//
// Da por hecho que maplibre-gl y pmtiles ya están cargados en la página, y que
// quien lo use registra antes el protocolo `pmtiles`.

const SEVITIME_TILES_URL =
  'https://sevitime-tiles.sevitime-app.workers.dev/sevilla-provincia.pmtiles';

// El mapa deja un margen de unos 7–8 km alrededor del recorte de la provincia:
// permite seleccionar aportaciones limítrofes sin que, al alejarse, se termine
// mirando Andalucía o la península. Fuera del recorte puede no haber detalle
// del basemap, pero el punto sigue pudiéndose situar y enviar.
const SEVITIME_PROVINCIA_BOUNDS = [
  [-6.6185147, 36.7771915],
  [-4.5733503, 38.2620901],
];

// El basemap sigue al tema: si no, la web entera se oscurece y el mapa se
// queda blanco. Devuelve un `style` de MapLibre listo para `new Map` o
// `setStyle`.
function sevitimeEstiloMapa(oscuro) {
  const c = oscuro
    ? { fondo: '#0F1C1A', agua: '#0E3034', vegetacion: '#12302C', suelo: '#1A2B29',
        edificio: '#223634', via: '#3C514E', limite: '#6D4C9F',
        poi: '#26A69A', poiBorde: '#0F1C1A', texto: '#E8F0EF', halo: '#0F1C1A' }
    : { fondo: '#f8f4f0', agua: '#a0c8f0', vegetacion: '#d8e8c8', suelo: '#e6e0d8',
        edificio: '#d9d0c7', via: '#ffffff', limite: '#a56cc1',
        poi: '#00897B', poiBorde: '#ffffff', texto: '#2c2c2c', halo: '#ffffff' };
  return {
    version: 8,
    sources: {
      openmaptiles: { type: 'vector', url: `pmtiles://${SEVITIME_TILES_URL}` },
    },
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.fondo } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': c.agua } },
      { id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: { 'fill-color': c.vegetacion } },
      { id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', paint: { 'fill-color': c.suelo } },
      { id: 'buildings', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', paint: { 'fill-color': c.edificio } },
      { id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': c.via, 'line-width': 1.2 } },
      { id: 'boundary', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', paint: { 'line-color': c.limite, 'line-width': 1 } },
      {
        id: 'poi', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi',
        paint: {
          'circle-radius': 4,
          'circle-color': c.poi,
          'circle-stroke-width': 1,
          'circle-stroke-color': c.poiBorde,
        },
      },
      {
        id: 'poi-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi',
        filter: ['has', 'name'],
        minzoom: 15,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 0.6],
          'text-max-width': 8,
        },
        paint: { 'text-color': c.texto, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
      },
    ],
  };
}

// Aviso para cuando el mapa base no carga. Las teselas viven en Cloudflare y,
// en España, durante los partidos de LaLiga los ISPs bloquean rangos de IPs de
// Cloudflare por orden judicial: el .pmtiles no llega y el mapa se queda en
// blanco, aunque los pines y las listas sí funcionan. En vez de dejar que el
// usuario piense que la web está rota, se lo decimos.
//
// La web se apoya en `map.on('error')` para la fuente del basemap y, por si el
// error no llegara etiquetado, en un temporizador: si a los 10 s la fuente
// sigue sin cargar, se muestra el aviso.
function vigilarTeselas(map) {
  const aviso = document.createElement('div');
  aviso.className = 'aviso-teselas';
  aviso.setAttribute('role', 'status');
  aviso.hidden = true;

  const texto = document.createElement('p');
  texto.textContent =
    'El mapa base no ha cargado. Puede ser el bloqueo temporal de IPs de ' +
    'Cloudflare durante los partidos de LaLiga. Los sitios y las rutas siguen ' +
    'funcionando.';

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'aviso-teselas-cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar aviso');
  cerrar.textContent = '×';
  cerrar.addEventListener('click', () => { aviso.hidden = true; });

  aviso.append(texto, cerrar);
  document.body.appendChild(aviso);

  let mostrado = false;
  const mostrar = () => {
    if (mostrado) return;
    mostrado = true;
    aviso.hidden = false;
  };

  map.on('error', (e) => {
    const msg = (e && e.error && e.error.message) || '';
    if ((e && e.sourceId === 'openmaptiles') ||
        /pmtiles|provincia\.pmtiles/i.test(msg)) {
      mostrar();
    }
  });

  setTimeout(() => {
    try {
      if (!map.isSourceLoaded || !map.isSourceLoaded('openmaptiles')) mostrar();
    } catch (e) { /* mapa ya destruido */ }
  }, 10000);
}
