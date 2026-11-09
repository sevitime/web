// Sugerir un sitio nuevo: lo que de verdad decide qué se guarda.
//
// POR QUÉ EXISTE ESTE FICHERO. El formulario vivía solo dentro de `/mapa/`,
// y por eso «Añadir lugar» en Explorar te sacaba al mapa. En la app no pasa
// eso: pulsas y se abre el formulario ahí mismo, sobre la lista. Para que la
// web haga lo mismo hacían falta dos presentaciones distintas —en el mapa el
// panel tiene que convivir con el mapa, porque el pin se arrastra mientras
// está abierto; en Explorar es una hoja— pero **una sola lógica**.
//
// Así que aquí vive lo que importa: los tipos que se ofrecen, la validación,
// el aviso de posible duplicado y el INSERT en `sugerencias`. Cada pantalla
// pone su envoltorio y llama a `SeviSugerir.enviar(...)`. Dos formularios
// escribiendo en la misma tabla acabarían comportándose distinto, y lo que
// no puede separarse es esto.
(function () {
  'use strict';

  // Los mismos tipos, en el mismo orden, que ofrece la app al sugerir.
  const TIPOS = {
    bar: { emoji: '🍻', etiqueta: 'Bar / Pub' },
    restaurant: { emoji: '🍽️', etiqueta: 'Restaurante' },
    cafe: { emoji: '☕', etiqueta: 'Café' },
    nightclub: { emoji: '🪩', etiqueta: 'Discoteca' },
    fast_food: { emoji: '🍔', etiqueta: 'Comida rápida' },
    attraction: { emoji: '🎡', etiqueta: 'Atracción / Mirador' },
    museum: { emoji: '🖼️', etiqueta: 'Museo / Galería' },
    monument: { emoji: '🗿', etiqueta: 'Monumento' },
    parking: { emoji: '🅿️', etiqueta: 'Parking' },
    pharmacy: { emoji: '💊', etiqueta: 'Farmacia' },
    atm: { emoji: '🏧', etiqueta: 'Cajero' },
    otro: { emoji: '➕', etiqueta: 'Otro' },
  };

  /// Los tipos en los que tiene sentido preguntar «¿ponen tapas?».
  /// Igual que `tipoConTapas` en la app: si cambia una, cambia la otra.
  const TIPOS_CON_TAPAS = ['bar', 'restaurant'];

  /// Cómo se obtuvo el punto, en los mismos valores que usa la app.
  const ORIGENES = ['gps', 'mapa'];

  function normalizarNombre(nombre) {
    return (nombre || '').toLocaleLowerCase('es-ES').normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  /// Si dos nombres apuntan al mismo sitio. Mismo criterio que el mapa tenía
  /// antes de mudarse aquí, y que `duplicate_check_service.dart` en la app.
  function pareceElMismo(a, b) {
    const x = normalizarNombre(a);
    const y = normalizarNombre(b);
    if (!x || !y) return false;
    if (x.includes(y) || y.includes(x)) return true;
    const px = x.split(' ').find((p) => p.length >= 4) || '';
    const py = y.split(' ').find((p) => p.length >= 4) || '';
    return Boolean(px && px === py);
  }

  function metros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /// Avisa si ya hay algo en ese punto. Devuelve si se sigue adelante.
  ///
  /// 25 m y no menos: el nombre puede haber cambiado en OSM, así que
  /// cualquier sitio a esa distancia merece una confirmación. Los que además
  /// coinciden por nombre se ordenan primero y se explican como coincidencia
  /// fuerte, para que la decisión sea fácil.
  async function confirmarPosibleDuplicado(nombre, lat, lon, cercanos) {
    const lista = (cercanos || [])
      .map((p) => ({ ...p, distancia: metros(lat, lon, p.lat, p.lon) }))
      .filter((p) => p.distancia <= 25)
      .map((p) => ({ ...p, parecido: pareceElMismo(nombre, p.nombre) }))
      .sort((a, b) => Number(b.parecido) - Number(a.parecido) || a.distancia - b.distancia)
      .slice(0, 3);
    if (!lista.length) return true;

    const resumen = lista.map((p) =>
      `• «${p.nombre}», a unos ${Math.round(p.distancia)} m (${p.label || 'sitio'})` +
      (p.parecido ? ' · nombre parecido' : '')
    ).join('\n');
    return window.confirm(
      'Puede que ya exista un sitio en ese punto:\n\n' + resumen +
      '\n\nComprueba que no sea el mismo lugar. Pulsa «Aceptar» solo si es otro local.'
    );
  }

  /// Valida y guarda. Devuelve `{ok: true}` o `{error: '…'}` con el texto
  /// que hay que enseñarle a la persona, ya en cristiano.
  ///
  /// `punto_origen` va siempre como 'web' y nunca como 'gps': la lectura del
  /// navegador es un único tirón de 10-50 m y el punto llega arrastrable, así
  /// que no se puede afirmar que lo enviado sea la lectura. El panel de
  /// moderación trata 'mapa' y 'web' igual.
  async function enviar(opciones) {
    const nombre = (opciones.nombre || '').trim();
    const tipo = opciones.tipo;
    const notas = (opciones.notas || '').trim();

    if (!nombre) return { error: 'Ponle un nombre al sitio.' };
    if (tipo === 'otro' && notas.length < 3) {
      return { error: 'Cuéntanos qué es en las notas.' };
    }
    if (!isFinite(opciones.lat) || !isFinite(opciones.lon)) {
      return { error: 'No sabemos dónde está el sitio.' };
    }

    const seguir = await confirmarPosibleDuplicado(
      nombre, opciones.lat, opciones.lon, opciones.cercanos);
    if (!seguir) return { cancelado: true };

    const fila = {
      nombre,
      tipo,
      lat: opciones.lat,
      lon: opciones.lon,
      device_id: opciones.deviceId,
      // De dónde sale el punto. Quien lo revisa y quien lo mapea no se fían
      // igual de un GPS en la puerta que de una chincheta puesta con el
      // dedo, así que se dice cuál de las dos es, como en la app. `'web'`
      // queda para lo que no sabemos de dónde viene.
      punto_origen: ORIGENES.indexOf(opciones.puntoOrigen) >= 0
        ? opciones.puntoOrigen
        : 'web',
    };
    if (notas) fila.notas = notas;

    // Las tapas, solo donde la pregunta tiene sentido. Misma regla que
    // `tipoConTapas` en la app (`lib/utils/tapas.dart`): en una heladería o
    // una hamburguesería sobra. Sin esto, un bar sugerido desde la web no
    // entraba nunca en «Dónde tapear».
    if (opciones.tapas === true && TIPOS_CON_TAPAS.indexOf(tipo) >= 0) {
      fila.tapas = true;
    }

    // La calidad del fix, solo si el punto es un fix. En una chincheta no hay
    // precisión que medir y decir que la hay sería engañar a quien modera.
    if (fila.punto_origen === 'gps') {
      if (isFinite(opciones.precisionM)) {
        fila.gps_precision_m = opciones.precisionM;
      }
      if (opciones.tomadoEl) {
        fila.gps_fix_el = new Date(opciones.tomadoEl).toISOString();
      }
    }

    const { error } = await opciones.sb.from('sugerencias').insert(fila);
    if (error) {
      return {
        error: error.code === '23505'
          ? 'Ya sugeriste este sitio antes.'
          : 'No se pudo enviar. Inténtalo de nuevo.',
      };
    }
    return { ok: true };
  }

  /// Con qué identidad se firma la sugerencia: la cuenta si hay sesión y,
  /// si no, el UUID de este navegador. Clave `sevitime_device_id`, la que ya
  /// venía usando el mapa; no se cambia para no partir en dos lo aportado
  /// por quien lleva tiempo sugiriendo sin cuenta.
  function deviceId(usuario) {
    if (usuario && usuario.id) return usuario.id;
    let id = null;
    try { id = localStorage.getItem('sevitime_device_id'); } catch (e) {}
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
        });
      try { localStorage.setItem('sevitime_device_id', id); } catch (e) {}
    }
    return id;
  }

  window.SeviSugerir = {
    deviceId: deviceId,
    TIPOS: TIPOS,
    pareceElMismo: pareceElMismo,
    enviar: enviar,
  };
}());
