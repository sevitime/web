// Lo de hoy en la portada: el plan del día según el tiempo, la curiosidad
// del día y el lugar destacado.
//
// POR QUÉ. Era de lo poco que la app tenía y la web no, y es justo lo que le
// faltaba a la portada: un motivo para volver mañana. La portada se lleva 70
// de las 116 páginas vistas del último mes, así que es donde más se nota.
//
// LO MISMO QUE LA APP, Y POR LAS MISMAS REGLAS. Las dos tablas ya eran de
// lectura pública (`efemerides`, `lugar_destacado`), así que esto no pide
// permisos nuevos ni función de servidor; lo que sí había que copiar con
// cuidado es **cómo se elige**, o la web y la app enseñarían cosas distintas
// el mismo día:
//
//  * La curiosidad va por `month_day` de **hoy en Sevilla**, no en la hora
//    del aparato: alguien en América vería la de ayer.
//  * El lugar destacado: si alguno está clavado a la fecha de hoy o a una
//    fiesta que se mueve con la Pascua, ese; si no, el que toca por rotación
//    (`dia del año % total`), con la lista ordenada por id. Es la traducción
//    de `LugarDestacadoService._resolver` y de `fiestas_moviles.dart`.
//
// FOTOS. Ni la del sitio ni la de la curiosidad se publican **si no tienen
// guardado su crédito** (`foto_credito`). Es una regla sola y vale para las
// dos. La de la efeméride no existía hasta el 2-nov-2026: la app la sacaba
// de Wikipedia en caliente y la pintaba sin decir de quién era, y de las 230
// que se pudieron resolver, **131 están bajo CC BY o CC BY-SA**, que obligan
// a nombrar al autor. Se resolvieron en el servidor con
// `tool/fotos_efemerides.mjs` y aquí solo se lee lo guardado. Las que no
// tienen crédito —porque Commons no da autor y su licencia lo exige— se
// quedan sin foto a propósito.
//
// EL PLAN DEL DÍA. La misma frase que la app enseña en su portada, elegida
// igual: primero la condición del tiempo (`fraseDelDia` en
// `weather_widgets.dart`) y dentro de ella la frase que toca por día del año
// y franja horaria (`plan_del_dia.dart`). El tiempo es el del **centro de
// Sevilla**, como el resto de la web: no se pide la ubicación por esto, que
// un aviso del navegador para saber si llueve no se justifica, y la frase es
// de ciudad de todas formas.
//
// VÍDEOS. Si la curiosidad o el sitio tienen vídeo, sale el enlace. **Nunca
// incrustado**: un reproductor de YouTube es un tercero cargando en nuestra
// página, y la política dice que la web no habla con terceros. Un enlace lo
// abre quien quiere, en su pestaña.
(function () {
  'use strict';

  var API = 'https://kdqiwhvtovafugpcrumf.supabase.co/rest/v1/';
  var KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  function pedir(ruta) {
    return fetch(API + ruta, { headers: { apikey: KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // --- La fecha, en Sevilla -------------------------------------------------

  function hoyEnSevilla() {
    var f = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    var v = {};
    f.forEach(function (p) { v[p.type] = p.value; });
    return {
      anio: Number(v.year),
      mes: Number(v.month),
      dia: Number(v.day),
      iso: v.year + '-' + v.month + '-' + v.day,
      monthDay: v.month + '-' + v.day,
    };
  }

  /// Días transcurridos desde el 1 de enero, empezando en 0. Igual que
  /// `diaDelAnio` de la app, y en UTC por el mismo motivo: con horas locales
  /// el cambio de hora de marzo descuenta un día.
  function diaDelAnio(h) {
    var hoy = Date.UTC(h.anio, h.mes - 1, h.dia);
    var enero = Date.UTC(h.anio, 0, 1);
    return Math.round((hoy - enero) / 86400000);
  }

  // --- Las fiestas que se mueven con la Pascua ------------------------------
  //
  // Traducción de `lib/utils/fiestas_moviles.dart`. Mismo algoritmo de Gauss.
  // Si se toca allí, hay que tocarlo aquí: son dos copias de lo mismo.

  function domingoDePascua(anio) {
    var a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
    var d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31);
    var dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  function sumarDias(fecha, dias) {
    return new Date(fecha.getTime() + dias * 86400000);
  }

  function martesDeFeria(anio) {
    var d = sumarDias(domingoDePascua(anio), 14);
    while (d.getUTCDay() !== 2) d = sumarDias(d, 1);
    return d;
  }

  function fechaDeFiesta(clave, anio) {
    var p = domingoDePascua(anio);
    switch (clave) {
      case 'domingo_ramos': return sumarDias(p, -7);
      case 'jueves_santo': return sumarDias(p, -3);
      // La madrugá sale la noche del jueves, pero la jornada es la del
      // viernes: es el día en que la ciudad está en la calle.
      case 'viernes_santo': return sumarDias(p, -2);
      case 'domingo_resurreccion': return p;
      case 'martes_feria': return martesDeFeria(anio);
      case 'corpus': return sumarDias(p, 60);
      default: return null;
    }
  }

  function fiestaCaeEn(clave, h) {
    if (!clave) return false;
    var f = fechaDeFiesta(clave, h.anio);
    if (!f) return false;
    return f.getUTCFullYear() === h.anio && f.getUTCMonth() + 1 === h.mes &&
      f.getUTCDate() === h.dia;
  }

  // --- La referencia de una efeméride, para colgarle su vídeo ---------------
  //
  // Traducción de `lib/utils/efemeride_ref.dart`. El vídeo se ancla al HECHO
  // (año + texto) y no a la fecha, porque si no el vídeo de un día saldría en
  // cualquier otra efeméride que cayera ese mismo día.

  function slug(texto) {
    var limpio = (texto || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (limpio.length <= 72) return limpio;
    var recorte = limpio.slice(0, 72);
    var ultimo = recorte.lastIndexOf('-');
    return ultimo > 0 ? recorte.slice(0, ultimo) : recorte;
  }

  function refDeEfemeride(e) {
    if (!e) return null;
    var cuerpo = (e.text || '').trim();
    var titular = (e.wiki_title || '').trim();
    var base = slug(cuerpo || titular);
    if (!base) return null;
    var anio = slug((e.year || '').trim());
    return anio ? anio + '-' + base : base;
  }

  // --- Textos, con las palabras de la app ----------------------------------

  function formatAnio(raw) {
    var n = Number(raw);
    if (!raw || isNaN(n)) return raw || '';
    return n < 0 ? Math.abs(n) + ' a.C.' : 'el año ' + n;
  }

  function titularEfemeride(e) {
    var n = Number(e.year);
    // Sevilla es lo normal y no se dice de otra manera; entre 711 y 1248 la
    // ciudad se llamaba Isbiliya y la app lo respeta.
    var donde = (!isNaN(n) && n >= 711 && n <= 1248) ? 'En Isbiliya' : 'En Sevilla';
    if (!e.year) return donde + ', un día como hoy...';
    return donde + ', tal día como hoy en ' + formatAnio(e.year);
  }

  // --- El plan del día, según el tiempo ------------------------------------
  //
  // Traducción de `fraseDelDia` y `planDelDia`. El orden de los casos importa
  // y es el de la app: si se cambia allí, aquí también.

  var SEVILLA = { lat: 37.3891, lon: -5.9845 };

  function horaEnSevilla() {
    var h = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
    }).format(new Date());
    return Number(h);
  }

  function condicionDelTiempo(actual, hora) {
    var temp = Number(actual.temperature_2m);
    var sensacion = Number(actual.apparent_temperature);
    var lluvia = Number(actual.precipitation) || 0;
    var code = Number(actual.weather_code);
    // Mismos cortes que `familia()` de `explorar/tiempo.js`.
    var nublado = code === 2 || code === 3 || code === 45 || code === 48;
    var llueve = lluvia > 0 || (code >= 51 && code <= 67) ||
      (code >= 80 && code <= 82) || code >= 95;

    if (llueve) return lluvia >= 15 ? 'lluvia_fuerte' : 'lluvia';
    if (temp >= 35 || sensacion >= 37) return 'calor';
    if (temp <= 12 || sensacion <= 10) return 'frio';
    if (hora >= 20 || hora <= 6) return 'noche';
    if (temp >= 18 && temp <= 27 && !nublado) return 'buen_tiempo';
    if (nublado) return 'nublado';
    return 'default';
  }

  /// La frase que toca hoy de las de esa condición. Va por día del año y
  /// franja de ocho horas, no al azar: así dos aparatos enseñan la misma y
  /// la vuelta entera dura un año.
  function planDelDia(opciones, h, hora) {
    if (!opciones || !opciones.length) return '';
    var franja = Math.floor(hora / 8);
    var salto = Math.floor(opciones.length / 3) + 1;
    return opciones[(diaDelAnio(h) + franja * salto) % opciones.length];
  }

  // --- Pintado --------------------------------------------------------------

  function enlaceVideo(v, porDefecto) {
    if (typeof v.youtube_id !== 'string' || !/^[\w-]{11}$/.test(v.youtube_id)) {
      return null;
    }
    var a = el('a', 'diario-video',
      (v.titulo || porDefecto) + (v.es_short ? ' · Short' : ''));
    a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.youtube_id);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function tarjetaEfemeride(e, videos) {
    var art = el('article', 'diario-tarjeta');
    if (e.imagen_url && e.foto_credito) {
      var img = document.createElement('img');
      img.src = e.imagen_url;
      img.alt = e.wiki_title || 'Ilustración de la curiosidad de hoy';
      img.loading = 'lazy';
      img.className = 'diario-foto';
      art.appendChild(img);
    }
    art.appendChild(el('p', 'diario-etiqueta', 'La curiosidad de hoy'));
    art.appendChild(el('h3', null, titularEfemeride(e)));
    art.appendChild(el('p', 'diario-texto', e.text || ''));
    if (e.imagen_url && e.foto_credito) {
      art.appendChild(el('p', 'diario-credito', e.foto_credito));
    }
    videos.forEach(function (v) {
      var a = enlaceVideo(v, 'Ver el vídeo');
      if (a) art.appendChild(a);
    });
    return art;
  }

  function tarjetaDestacado(d, videos) {
    var art = el('article', 'diario-tarjeta');
    // Sin crédito guardado no se publica la foto. Es la regla de la web.
    if (d.imagen_url && d.foto_credito) {
      var img = document.createElement('img');
      img.src = d.imagen_url;
      img.alt = d.nombre;
      img.loading = 'lazy';
      img.className = 'diario-foto';
      art.appendChild(img);
    }
    art.appendChild(el('p', 'diario-etiqueta', 'El sitio de hoy'));
    art.appendChild(el('h3', null, d.nombre));
    art.appendChild(el('p', 'diario-texto', d.descripcion || ''));
    if (d.imagen_url && d.foto_credito) {
      art.appendChild(el('p', 'diario-credito', d.foto_credito));
    }
    videos.forEach(function (v) {
      var a = enlaceVideo(v, d.nombre);
      if (a) art.appendChild(a);
    });
    // Sin enlace a propósito: `lugar_destacado` guarda nombre y coordenadas,
    // no la clave del sitio, y `/mapa/` solo entiende `lat`/`lon` cuando se
    // va a sugerir algo. Un enlace que no lleva donde dice es peor que
    // ninguno. Cuando la tabla tenga `place_key`, aquí va «Ver la ficha».
    return art;
  }

  // --- Arranque -------------------------------------------------------------

  function arrancar() {
    var hueco = document.getElementById('hueco-diario');
    if (!hueco) return;
    var h = hoyEnSevilla();

    // El plan del día va por su cuenta y nunca tumba al resto: si Open-Meteo
    // no contesta, la curiosidad y el sitio salen igual, sin frase.
    var plan = Promise.all([
      pedir('planes_clima?select=condicion,texto&order=id.asc'),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + SEVILLA.lat +
        '&longitude=' + SEVILLA.lon +
        '&current=temperature_2m,apparent_temperature,weather_code,precipitation' +
        '&timezone=Europe%2FMadrid')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
    ]).then(function (res) {
      var filas = Array.isArray(res[0]) ? res[0] : [];
      var tiempo = res[1];
      if (!filas.length || !tiempo || !tiempo.current) return '';
      var porCondicion = {};
      filas.forEach(function (f) {
        (porCondicion[f.condicion] = porCondicion[f.condicion] || []).push(f.texto);
      });
      var hora = horaEnSevilla();
      return planDelDia(porCondicion[condicionDelTiempo(tiempo.current, hora)], h, hora);
    }).catch(function () { return ''; });

    var contenido = Promise.all([
      pedir('efemerides?select=year,text,wiki_title,imagen_url,foto_credito' +
        '&month_day=eq.' +
        encodeURIComponent(h.monthDay) + '&limit=1'),
      pedir('lugar_destacado?select=nombre,descripcion,imagen_url,foto_credito,' +
        'fecha_forzada,fiesta_movil&activo=eq.true&order=id.asc'),
    ]).then(function (res) {
      var efemeride = Array.isArray(res[0]) && res[0].length ? res[0][0] : null;
      var lista = Array.isArray(res[1]) ? res[1] : [];

      var destacado = null;
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].fecha_forzada === h.iso || fiestaCaeEn(lista[i].fiesta_movil, h)) {
          destacado = lista[i];
          break;
        }
      }
      if (!destacado && lista.length) {
        destacado = lista[diaDelAnio(h) % lista.length];
      }

      var ref = refDeEfemeride(efemeride);
      return Promise.all([
        ref ? pedir('place_videos?select=youtube_id,titulo,es_short&activo=eq.true' +
          '&efemeride_ref=eq.' + encodeURIComponent(ref) + '&order=orden.asc&limit=3') : [],
        destacado ? pedir('place_videos?select=youtube_id,titulo,es_short&activo=eq.true' +
          '&place_name=eq.' + encodeURIComponent(destacado.nombre) +
          '&order=orden.asc&limit=3') : [],
      ]).then(function (vids) {
        return {
          efemeride: efemeride, destacado: destacado,
          videosE: vids[0] || [], videosD: vids[1] || [],
        };
      });
    }).catch(function () { return null; });

    // Se pinta una sola vez, con todo lo que haya llegado.
    Promise.all([plan, contenido]).then(function (res) {
      var frase = res[0] || '';
      var c = res[1];
      if (!frase && (!c || (!c.efemeride && !c.destacado))) return;
      pintar(hueco, frase, c || {}, h);
    }).catch(function () {});
  }

  function pintar(hueco, frase, c) {
    var sec = el('section', 'diario');
    sec.appendChild(el('h2', null, 'Hoy en Sevilla'));
    if (frase) sec.appendChild(el('p', 'diario-plan', frase));
    var caja = el('div', 'diario-tarjetas');
    if (c.efemeride) caja.appendChild(tarjetaEfemeride(c.efemeride, c.videosE || []));
    if (c.destacado) caja.appendChild(tarjetaDestacado(c.destacado, c.videosD || []));
    if (caja.children.length) sec.appendChild(caja);
    hueco.appendChild(sec);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
}());
