// Qué paradas de una ruta tienen sello del Pasaporte (14-nov-2026), como
// `PassportService.sellosDeParadas` en la app. Las rutas pasan justo por los
// monumentos con sello y no se decía en ninguna parte.
//
// Solo los sellos de un monumento concreto (con coordenadas), nunca los
// genéricos de tipo («Primer bar»): saldrían en cada bar de la ruta de
// tapas. Y cada sello una vez, en la parada más cercana a su monumento: el
// del Puente de Triana alcanza también al Castillo de San Jorge y al Mercado.
//
// Necesita pasaporte/sellos.js (window.sevitimeSellos y
// window.sevitimeTiposVisitables) y rutas/km.js (la misma fórmula de
// distancia que la app).
(function () {
  'use strict';

  function metros(a, b) {
    const p = 0.017453292519943295;
    const x = 0.5 - Math.cos((b.lat - a.lat) * p) / 2 +
      Math.cos(a.lat * p) * Math.cos(b.lat * p) * (1 - Math.cos((b.lon - a.lon) * p)) / 2;
    return 12742000 * Math.asin(Math.sqrt(x));
  }

  function selloPropioDe(parada) {
    const visitables = window.sevitimeTiposVisitables || [];
    if (visitables.indexOf(parada.tipo) < 0) return null;
    let mejor = null, mejorM = Infinity;
    for (const s of window.sevitimeSellos || []) {
      if (s.lat == null || s.radio == null) continue;
      const m = metros(parada, s);
      if (m <= s.radio && m < mejorM) { mejor = s; mejorM = m; }
    }
    return mejor;
  }

  function sellosDeParadas(paradas) {
    const sellos = paradas.map(selloPropioDe);
    const mejor = {};
    sellos.forEach((s, i) => {
      if (!s) return;
      const antes = mejor[s.id];
      if (antes == null || metros(paradas[i], s) < metros(paradas[antes], s)) mejor[s.id] = i;
    });
    return sellos.map((s, i) => (s && mejor[s.id] === i ? s : null));
  }

  function textoResumenSellos(sellos) {
    const n = new Set(sellos.filter(Boolean).map((s) => s.id)).size;
    if (n === 0) return '';
    return n === 1 ? '1 sello del Pasaporte en esta ruta'
      : n + ' sellos del Pasaporte en esta ruta';
  }

  window.sevitimeSellosRuta = { sellosDeParadas, textoResumenSellos };
})();
