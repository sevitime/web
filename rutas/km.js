// Kilómetros de una ruta para /rutas/. Va aparte de rutas.js para poder
// probarlo sin el DOM (tool/rutas_km.test.mjs).
(function () {
  'use strict';
  // Lo que mide una ruta sumando sus tramos en línea recta, igual que
  // `kmDeRuta` y `textoKm` en la app (lib/utils/paradas_ruta.dart), con la
  // misma fórmula que `metrosEntre`. Por las calles siempre es algo más.
  function metrosEntre(a, b) {
    const p = 0.017453292519943295;
    const x = 0.5 - Math.cos((b.lat - a.lat) * p) / 2 +
      Math.cos(a.lat * p) * Math.cos(b.lat * p) * (1 - Math.cos((b.lon - a.lon) * p)) / 2;
    return 12742000 * Math.asin(Math.sqrt(x));
  }
  function kmDeRuta(paradas) {
    let km = 0;
    for (let i = 1; i < paradas.length; i++) km += metrosEntre(paradas[i - 1], paradas[i]) / 1000;
    return km;
  }
  // «450 m» o «2,4 km»: por debajo del kilómetro, de 50 en 50 metros.
  function textoKm(km) {
    if (km < 1) return Math.ceil(km * 1000 / 50) * 50 + ' m';
    const r = Math.round(km * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + ' km';
  }
  window.sevitimeRutasKm = { kmDeRuta, textoKm };
})();
