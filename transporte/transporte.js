// Transporte: la parada, la estación y la bici que tienes al lado.
//
// Las mismas tres fuentes que la app (`tussam_service.dart`,
// `metro_service.dart`, `sevici_service.dart`) y llamadas desde el propio
// navegador, porque las tres lo permiten (`access-control-allow-origin: *`):
// no hace falta ningún intermediario nuestro.
//
//  * **Tussam y Metro**: capas públicas de ArcGIS del portal de datos
//    abiertos del Ayuntamiento de Sevilla. Una parada nueva aparece sola.
//  * **Sevici**: CityBikes, que devuelve la red entera en una llamada con las
//    bicis y los anclajes libres de cada estación.
//
// Esta página **sí pide la ubicación**, y es la única que lo hace al entrar
// si ya está concedida: sin ella no hay nada que enseñar, porque todo es «lo
// que tengo cerca». Los tres servicios reciben tu posición aproximada para
// buscar, y eso está dicho en la política de privacidad.
//
// Lo que falta respecto a la app: los autobuses interurbanos del Consorcio
// (CTAN). Su API también permite llamadas desde el navegador, así que es
// trabajo pendiente y no un imposible.
(function () {
  'use strict';

  const ARCGIS = 'https://services1.arcgis.com/hcmP7kr0Cx3AcTJk/arcgis/rest/services';
  const RADIO_M = 700;
  const MAX_POR_SECCION = 5;

  // Colores oficiales de las líneas de Tussam, copiados de
  // `TussamService._coloresLineas` en el repo de la app.
  const COLORES_LINEA = {
    '01': '#f54129', '02': '#f54129', '03': '#f54129', '05': '#f54129',
    '06': '#f54129', '10': '#f54129', '11': '#f54129', '12': '#f54129',
    '13': '#f54129', '14': '#f54129', '15': '#f54129', '16': '#f54129',
    '20': '#f54129', '21': '#000d6f', '22': '#f54129', '24': '#000d6f',
    '25': '#f54129', '26': '#f54129', '27': '#000d6f', '28': '#f54129',
    '29': '#f54129', '30': '#f54129', '31': '#f54129', '32': '#008431',
    '33': '#f54129', '34': '#f54129', '37': '#f54129', '38': '#f54129',
    '39': '#f54129', '40': '#f54129', '41': '#f54129', '43': '#f54129',
    '52': '#f54129', 'C1': '#008431', 'C2': '#008431', 'C3': '#008431',
    'C4': '#008431', 'C5': '#008431', 'C6': '#008431', 'A1': '#f5a623',
    'A2': '#f5a623', 'A3': '#f5a623', 'A4': '#f5a623', 'A5': '#f5a623',
    'A6': '#f5a623', 'A7': '#f5a623', 'A8': '#f5a623', 'EA': '#f5a623',
    'LN': '#f54129', 'LS': '#f54129', 'T1': '#f54129', 'TB1': '#f54129'
  };
  const COLOR_LINEA_POR_DEFECTO = '#f54129';
  // Los de identidad de cada servicio (`colores_transporte.dart`).
  const COLOR_METRO = '#0D6928';
  const COLOR_CTAN = '#E35205';
  // El Consorcio sirve TODA su lista de paradas de una vez (1.147, 255 KB).
  // Igual que la app (`ctat_service.dart`), se baja una vez, se guarda y se
  // filtra en local. Siete días: las paradas interurbanas no se mueven.
  const CTAN = 'https://api.ctan.es/v1/Consorcios/1';
  const CTAN_CACHE = 'sevi-ctan-paradas-v1';
  const CTAN_DIAS = 7;
  // Más lejos que los 700 m del resto a propósito: una parada interurbana
  // sirve a un pueblo entero y nadie espera tenerla en la puerta. Es el
  // mismo radio que usa la app.
  const CTAN_RADIO_M = 3000;
  const CTAN_MAX = 3;
  const COLOR_SEVICI = '#BE0000';

  const estado = document.getElementById('estado');
  const caja = document.getElementById('ubicacion-caja');
  const secciones = document.getElementById('secciones');

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // Haversine, los mismos metros que mide la app.
  function metros(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  function distanciaTexto(m) {
    return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  function pedir(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // --- Las tres fuentes ----------------------------------------------------

  // Las paradas que caen en el radio, agrupadas por nodo: ArcGIS devuelve una
  // fila por línea y parada, así que la misma parada viene repetida.
  async function tussam(punto) {
    const url = ARCGIS + '/TUSSAM_Paradas/FeatureServer/0/query?' + new URLSearchParams({
      where: '1=1',
      geometry: punto.lon + ',' + punto.lat,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: String(RADIO_M),
      units: 'esriSRUnit_Meter',
      outFields: 'Nodo,Nombre,LabelLinea',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
      resultRecordCount: '500',
    });
    const datos = await pedir(url);
    const porNodo = new Map();
    (datos.features || []).forEach(function (f) {
      const a = f.attributes || {};
      const g = f.geometry || {};
      if (!a.Nodo) return;
      let parada = porNodo.get(a.Nodo);
      if (!parada) {
        parada = {
          nombre: a.Nombre || '',
          lat: g.y, lon: g.x,
          lineas: [],
        };
        porNodo.set(a.Nodo, parada);
      }
      const label = (a.LabelLinea || '').trim();
      if (label && parada.lineas.indexOf(label) === -1) parada.lineas.push(label);
    });
    return [...porNodo.values()]
      .map(function (p) { return Object.assign(p, { m: metros(punto, p) }); })
      .sort(function (a, b) { return a.m - b.m; })
      .slice(0, MAX_POR_SECCION);
  }

  async function metro(punto) {
    const url = ARCGIS + '/METRO_Estacion/FeatureServer/0/query' +
      '?where=1%3D1&outFields=NOMBRE&returnGeometry=true&outSR=4326&f=json';
    const datos = await pedir(url);
    return (datos.features || [])
      .map(function (f) {
        const g = f.geometry || {};
        return {
          nombre: (f.attributes && f.attributes.NOMBRE) || '',
          lat: g.y, lon: g.x,
        };
      })
      .filter(function (e) { return e.lat && e.lon; })
      .map(function (e) { return Object.assign(e, { m: metros(punto, e) }); })
      .sort(function (a, b) { return a.m - b.m; })
      .slice(0, 3);
  }

  async function sevici(punto) {
    const datos = await pedir('https://api.citybik.es/v2/networks/sevici');
    const red = (datos.network && datos.network.stations) || [];
    return red
      .map(function (s) {
        return {
          // CityBikes prefija los nombres con un id opcional y un guion bajo
          // («123_PLAZA…», «_PLAZA DE LA CONCORDIA»). Igual que en la app.
          nombre: (s.name || '').replace(/^\d*_/, '').trim(),
          bicis: s.free_bikes == null ? null : s.free_bikes,
          anclajes: s.empty_slots == null ? null : s.empty_slots,
          lat: s.latitude, lon: s.longitude,
        };
      })
      .map(function (s) { return Object.assign(s, { m: metros(punto, s) }); })
      .sort(function (a, b) { return a.m - b.m; })
      .slice(0, MAX_POR_SECCION);
  }

  // --- Interurbanos (Consorcio de Transporte) -------------------------------

  function ctanGuardadas() {
    try {
      const crudo = localStorage.getItem(CTAN_CACHE);
      if (!crudo) return null;
      const g = JSON.parse(crudo);
      if (!g || !Array.isArray(g.paradas)) return null;
      if (Date.now() - g.cuando > CTAN_DIAS * 86400000) return null;
      return g.paradas;
    } catch (e) { return null; }
  }

  async function ctanParadas() {
    const guardadas = ctanGuardadas();
    if (guardadas) return guardadas;
    const d = await pedir(CTAN + '/paradas/?lang=ES');
    const lista = (d && Array.isArray(d.paradas) ? d.paradas : [])
      // Solo lo que se usa: así lo guardado baja de 255 KB a unos 60.
      .map(function (p) {
        return {
          id: p.idParada,
          nombre: p.nombre || '',
          municipio: p.municipio || '',
          lat: parseFloat(p.latitud),
          lon: parseFloat(p.longitud),
        };
      })
      .filter(function (p) { return isFinite(p.lat) && isFinite(p.lon); });
    try {
      localStorage.setItem(CTAN_CACHE,
        JSON.stringify({ cuando: Date.now(), paradas: lista }));
    } catch (e) {}
    return lista;
  }

  /// Las próximas salidas de una parada. El código de línea sale de la
  /// primera palabra del nombre («M-101A Circular Bormujos…»), igual que
  /// `CtatServicio._extraerCodigo` en la app.
  async function ctanServicios(id) {
    const d = await pedir(CTAN + '/paradas/' + encodeURIComponent(id) + '/servicios?lang=ES');
    const lista = (d && Array.isArray(d.servicios) ? d.servicios : []).slice(0, 4);
    return lista.map(function (s) {
      const nombre = (s.nombre || '').trim();
      return {
        hora: s.servicio || '',
        linea: nombre.split(' ')[0] || nombre,
        destino: s.destino || '',
      };
    });
  }

  async function ctan(punto) {
    const todas = await ctanParadas();
    const cerca = todas
      .map(function (p) { return Object.assign({}, p, { m: metros(punto, p) }); })
      .filter(function (p) { return p.m <= CTAN_RADIO_M; })
      .sort(function (a, b) { return a.m - b.m; })
      .slice(0, CTAN_MAX);
    // Las salidas solo de las que se van a enseñar: una petición por parada.
    await Promise.all(cerca.map(async function (p) {
      p.servicios = await ctanServicios(p.id).catch(function () { return []; });
    }));
    return cerca;
  }

  function pintarCtan(paradas) {
    const s = seccion('Interurbanos (Consorcio)', COLOR_CTAN);
    if (!paradas.length) {
      s.appendChild(el('p', 't-nada',
        'No hay paradas del Consorcio a menos de 3 km. Son las de los ' +
        'autobuses entre Sevilla y los pueblos.'));
      return s;
    }
    const lista = el('ul', 't-lista');
    paradas.forEach(function (p) {
      const { fila, cuerpo } = filaBase(p.nombre, p.m);
      if (p.municipio) cuerpo.appendChild(el('span', 't-detalle', p.municipio));
      if (p.servicios && p.servicios.length) {
        const prox = el('div', 't-lineas');
        p.servicios.forEach(function (sv) {
          const chip = el('span', 't-linea', sv.linea + (sv.hora ? ' · ' + sv.hora : ''));
          chip.style.background = COLOR_CTAN;
          chip.title = sv.destino;
          prox.appendChild(chip);
        });
        cuerpo.appendChild(prox);
      } else {
        // El Consorcio devuelve solo la hora siguiente: de madrugada está
        // vacío y no es un fallo. Decirlo así evita que parezca roto.
        cuerpo.appendChild(el('span', 't-detalle', 'Sin salidas en la próxima hora'));
      }
      lista.appendChild(fila);
    });
    s.appendChild(lista);
    return s;
  }

  // --- Pintado -------------------------------------------------------------

  function seccion(titulo, color) {
    const s = el('section', 't-seccion');
    const h = el('h2', 't-titulo', titulo);
    h.style.borderLeftColor = color;
    s.appendChild(h);
    return s;
  }

  function filaBase(nombre, metrosDist) {
    const fila = el('li', 't-fila');
    const cuerpo = el('div', 't-cuerpo');
    cuerpo.appendChild(el('span', 't-nombre', nombre));
    fila.appendChild(cuerpo);
    fila.appendChild(el('span', 't-dist', distanciaTexto(metrosDist)));
    return { fila: fila, cuerpo: cuerpo };
  }

  function pintarTussam(paradas) {
    const s = seccion('Autobús (Tussam)', '#B40129');
    if (!paradas.length) {
      s.appendChild(el('p', 't-nada', 'No hay paradas de Tussam a menos de 700 m.'));
      return s;
    }
    const lista = el('ul', 't-lista');
    paradas.forEach(function (p) {
      const { fila, cuerpo } = filaBase(p.nombre, p.m);
      if (p.lineas.length) {
        const chips = el('div', 't-lineas');
        p.lineas.sort().forEach(function (l) {
          const chip = el('span', 't-linea', l);
          chip.style.background = COLORES_LINEA[l] || COLOR_LINEA_POR_DEFECTO;
          chips.appendChild(chip);
        });
        cuerpo.appendChild(chips);
      }
      lista.appendChild(fila);
    });
    s.appendChild(lista);
    return s;
  }

  function pintarMetro(estaciones) {
    const s = seccion('Metro', COLOR_METRO);
    if (!estaciones.length) {
      s.appendChild(el('p', 't-nada', 'No hemos podido leer las estaciones de metro.'));
      return s;
    }
    const lista = el('ul', 't-lista');
    estaciones.forEach(function (e) {
      const { fila, cuerpo } = filaBase(e.nombre, e.m);
      cuerpo.appendChild(el('span', 't-detalle', 'Línea 1'));
      lista.appendChild(fila);
    });
    s.appendChild(lista);
    return s;
  }

  function pintarSevici(estaciones) {
    const s = seccion('Bici (Sevici)', COLOR_SEVICI);
    if (!estaciones.length) {
      s.appendChild(el('p', 't-nada', 'No hemos podido leer las estaciones de Sevici.'));
      return s;
    }
    const lista = el('ul', 't-lista');
    estaciones.forEach(function (e) {
      const { fila, cuerpo } = filaBase(e.nombre, e.m);
      // Las dos cifras, porque las dos hacen falta: una para coger bici y la
      // otra para poder dejarla.
      const partes = [];
      if (e.bicis != null) partes.push(e.bicis === 1 ? '1 bici' : e.bicis + ' bicis');
      if (e.anclajes != null) partes.push(e.anclajes === 1 ? '1 anclaje libre' : e.anclajes + ' anclajes libres');
      if (partes.length) cuerpo.appendChild(el('span', 't-detalle', partes.join(' · ')));
      lista.appendChild(fila);
    });
    s.appendChild(lista);
    return s;
  }

  // --- Arranque ------------------------------------------------------------

  async function buscar(punto) {
    estado.textContent = 'Buscando lo que tienes cerca…';
    secciones.textContent = '';

    // Cada sección falla por su cuenta: que CityBikes esté caído no deja sin
    // autobuses a nadie.
    const [paradas, estaciones, bicis, interurbanos] = await Promise.all([
      tussam(punto).catch(function () { return []; }),
      metro(punto).catch(function () { return []; }),
      sevici(punto).catch(function () { return []; }),
      ctan(punto).catch(function () { return []; }),
    ]);

    secciones.append(
      pintarTussam(paradas),
      pintarMetro(estaciones),
      pintarCtan(interurbanos),
      pintarSevici(bicis)
    );
    estado.textContent = '';
    estado.hidden = true;
    if (caja) caja.hidden = true;
  }

  function ubicar() {
    if (!navigator.geolocation) {
      estado.textContent = 'Tu navegador no sabe decirnos dónde estás.';
      return;
    }
    estado.hidden = false;
    estado.textContent = 'Buscando tu ubicación…';
    navigator.geolocation.getCurrentPosition(
      function (p) { buscar({ lat: p.coords.latitude, lon: p.coords.longitude }); },
      function () {
        estado.textContent = 'Sin tu ubicación no podemos decirte qué tienes cerca. ' +
          'Puedes permitirla y volver a intentarlo.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  const boton = document.getElementById('btn-ubicacion');
  if (boton) boton.addEventListener('click', ubicar);

  // Si el permiso ya está concedido, no se hace esperar a nadie: esta página
  // no es nada sin la ubicación.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' })
      .then(function (p) { if (p.state === 'granted') ubicar(); })
      .catch(function () {});
  }
})();
