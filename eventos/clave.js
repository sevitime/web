// Clave de un evento para colgarle comentarios y asistencias.
//
// Gemela de lib/utils/clave_evento.dart en la app (sevitime/). Las dos
// tienen que dar EXACTAMENTE lo mismo, o lo que se comenta en la web no sale
// en la app. Por eso nada depende del navegador: el día se calcula en hora de
// Madrid con la regla del cambio de hora hecha a mano (no con la zona del
// visitante), y las tildes se quitan con una tabla propia (no con NFD), de
// modo que solo quedan a-z0-9. Los casos de tool/clave_evento.test.mjs son
// los mismos que los de test/clave_evento_test.dart de la app.
(function (global) {
  'use strict';

  function ultimoDomingoALaUna(anio, mes) {
    // Mes 1-12. El día 0 del mes siguiente es el último de este.
    const ultimo = new Date(Date.UTC(anio, mes, 0, 1));
    return new Date(ultimo.getTime() - ultimo.getUTCDay() * 86400000);
  }

  function enHorarioDeVerano(t) {
    const anio = new Date(t).getUTCFullYear();
    return t >= ultimoDomingoALaUna(anio, 3).getTime() &&
      t < ultimoDomingoALaUna(anio, 10).getTime();
  }

  // `AAAA-MM-DD` del día que es en Madrid en ese instante.
  function diaEnMadrid(instante) {
    const t = new Date(instante).getTime();
    const local = new Date(t + (enHorarioDeVerano(t) ? 2 : 1) * 3600000);
    const dos = (n) => String(n).padStart(2, '0');
    return String(local.getUTCFullYear()).padStart(4, '0') + '-' +
      dos(local.getUTCMonth() + 1) + '-' + dos(local.getUTCDate());
  }

  const SIN_TILDE = {
    'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ñ': 'n', 'ç': 'c',
  };

  function nombreParaClave(nombre) {
    let s = '';
    // for…of recorre por puntos de código, como los `runes` de Dart.
    for (const c of String(nombre || '').toLowerCase()) {
      const t = SIN_TILDE[c] || c;
      s += /^[a-z0-9]$/.test(t) ? t : ' ';
    }
    s = s.replace(/ +/g, ' ').trim();
    if (s.length > 150) s = s.slice(0, 150).trim();
    return s || 'evento';
  }

  function claveEvento(e) {
    return e.ref || 'n:' + diaEnMadrid(e.inicio) + ':' + nombreParaClave(e.nombre);
  }

  // Lo contrario: una fecha y hora escritas en hora de Madrid (la del
  // formulario de proponer evento) como instante, sea cual sea la zona del
  // visitante. Mes 1-12.
  function instanteDesdeMadrid(anio, mes, dia, hora, minuto) {
    const comoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto);
    const offset = enHorarioDeVerano(comoUtc - 2 * 3600000) ? 2 : 1;
    return new Date(comoUtc - offset * 3600000);
  }

  global.SeviClave = { claveEvento, diaEnMadrid, nombreParaClave, instanteDesdeMadrid };
})(typeof window !== 'undefined' ? window : globalThis);
