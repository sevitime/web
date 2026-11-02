// El tiempo y la calidad del aire, lo mismo que la app enseña en su portada.
//
// Mismas fuentes y mismos parámetros que `weather_service.dart` y
// `aire_service.dart`: Open-Meteo, sin clave y sin coste, y por eso se puede
// llamar desde el navegador de quien mira. Mismos textos (las descripciones
// WMO y los niveles de aire están copiados de allí) y misma atribución.
//
// Dos decisiones:
//
//  * **La ubicación no se pide por esto.** Si ya está concedida se lee en
//    silencio y el tiempo es el de donde estás; si no, es el del centro de
//    Sevilla, que es de lo que habla esta web. Un aviso del navegador para
//    saber si llueve no se justifica.
//  * **Iconos dibujados, no emojis.** Es lo que hizo la app el 18-oct-2026:
//    los emojis los pinta cada sistema a su manera y no son del color de la
//    marca.
(function () {
  'use strict';

  const L = window.sevitimeLugares;
  if (!L) return;

  const DESCRIPCIONES = {
    0: 'despejado', 1: 'mayormente despejado', 2: 'parcialmente nublado',
    3: 'nublado', 45: 'niebla', 48: 'niebla con escarcha',
    51: 'llovizna ligera', 53: 'llovizna', 55: 'llovizna intensa',
    61: 'lluvia ligera', 63: 'lluvia moderada', 65: 'lluvia intensa',
    71: 'nieve ligera', 73: 'nieve moderada', 75: 'nieve intensa',
    77: 'granizo', 80: 'chubascos ligeros', 81: 'chubascos',
    82: 'chubascos intensos', 85: 'chubascos de nieve',
    86: 'chubascos de nieve intensos', 95: 'tormenta',
    96: 'tormenta con granizo', 99: 'tormenta con granizo intenso'
  };

  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  function descripcion(code) { return DESCRIPCIONES[code] || 'nublado'; }

  // La familia de icono de cada código WMO, con los mismos cortes que
  // `iconos_tiempo.dart`.
  function familia(code) {
    if (code === 0 || code === 1) return 'sol';
    if (code === 2 || code === 3 || code === 45 || code === 48) return 'nube';
    if (code >= 71 && code <= 77) return 'nieve';
    if (code >= 85 && code <= 86) return 'nieve';
    if (code >= 95) return 'tormenta';
    return 'lluvia';
  }

  // El nivel de aire, igual que `AireService._nivel`.
  function nivelAire(aqi) {
    if (aqi <= 50) return 'Bueno';
    if (aqi <= 100) return 'Moderado';
    if (aqi <= 150) return 'Sensibles';
    if (aqi <= 200) return 'Malo';
    if (aqi <= 300) return 'Muy malo';
    return 'Peligroso';
  }

  // La escala de color del aire, en su versión legible sobre fondo claro y
  // sobre fondo oscuro (la misma conclusión que `_colorEscala` en la app: el
  // amarillo de Material no se ve sobre blanco).
  function claseAire(aqi) {
    if (aqi <= 50) return 'aire-bueno';
    if (aqi <= 100) return 'aire-moderado';
    if (aqi <= 150) return 'aire-sensibles';
    if (aqi <= 200) return 'aire-malo';
    return 'aire-peligroso';
  }

  // --- Iconos --------------------------------------------------------------

  const SVG = 'http://www.w3.org/2000/svg';

  function svgIcono(tipo, tamano) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', tamano);
    s.setAttribute('height', tamano);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'tiempo-icono tiempo-icono-' + tipo);

    function add(nombre, atributos) {
      const n = document.createElementNS(SVG, nombre);
      Object.keys(atributos).forEach(function (k) { n.setAttribute(k, atributos[k]); });
      s.appendChild(n);
      return n;
    }

    function nube(y) {
      add('path', {
        d: 'M7.5 ' + (y + 5) + 'h9a3 3 0 0 0 .2-6 4.6 4.6 0 0 0-8.7-1.1A3.1 3.1 0 0 0 7.5 ' + (y + 5) + 'z',
        fill: 'currentColor'
      });
    }

    if (tipo === 'sol') {
      add('circle', { cx: 12, cy: 12, r: 4.6, fill: 'currentColor' });
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        add('line', {
          x1: (12 + Math.cos(a) * 7.2).toFixed(2), y1: (12 + Math.sin(a) * 7.2).toFixed(2),
          x2: (12 + Math.cos(a) * 9.6).toFixed(2), y2: (12 + Math.sin(a) * 9.6).toFixed(2),
          stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round'
        });
      }
    } else if (tipo === 'nube') {
      nube(6);
    } else if (tipo === 'lluvia') {
      nube(3);
      [9, 13, 17].forEach(function (x) {
        add('line', {
          x1: x, y1: 16.5, x2: x - 1, y2: 20.5,
          stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round'
        });
      });
    } else if (tipo === 'nieve') {
      nube(3);
      [9, 13, 17].forEach(function (x) {
        add('line', { x1: x - 1.6, y1: 18.5, x2: x + 1.6, y2: 18.5, stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
        add('line', { x1: x, y1: 16.9, x2: x, y2: 20.1, stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
      });
    } else {
      nube(3);
      add('path', { d: 'M13.4 16l-3.2 5h2.4l-1 3.6 3.8-5.6h-2.3l1.1-3z', fill: 'currentColor' });
    }
    return s;
  }

  // --- Datos ---------------------------------------------------------------

  function pedir(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function tiempoDe(lat, lon) {
    return pedir('https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,precipitation' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&forecast_days=7&timezone=auto');
  }

  function aireDe(lat, lon) {
    return pedir('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat +
      '&longitude=' + lon +
      '&current=us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,' +
      'alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen');
  }

  async function dondeMirar() {
    try {
      if (!navigator.permissions || !navigator.permissions.query) return null;
      const p = await navigator.permissions.query({ name: 'geolocation' });
      if (p.state !== 'granted') return null;
      return await new Promise(function (listo) {
        navigator.geolocation.getCurrentPosition(
          function (pos) { listo({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
          function () { listo(null); },
          { timeout: 5000, maximumAge: 300000 }
        );
      });
    } catch (_) { return null; }
  }

  // --- Pintado -------------------------------------------------------------

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function fila(nombre, valor, clase) {
    const f = el('div', 'tiempo-fila');
    f.appendChild(el('span', null, nombre));
    f.appendChild(el('span', clase || 'tiempo-valor', valor));
    return f;
  }

  function pintarPanel(panel, t, aire) {
    panel.textContent = '';

    const dias = (t.daily && t.daily.time) || [];
    if (dias.length) {
      panel.appendChild(el('h3', 'tiempo-subtitulo', 'Siete días'));
      const lista = el('div', 'tiempo-dias');
      for (let i = 0; i < dias.length; i++) {
        const code = t.daily.weather_code[i];
        const f = el('div', 'tiempo-dia');
        const fecha = new Date(dias[i] + 'T12:00:00');
        f.appendChild(el('span', 'tiempo-dia-nombre',
          i === 0 ? 'Hoy' : DIAS[(fecha.getDay() + 6) % 7]));
        f.appendChild(svgIcono(familia(code), 22));
        f.appendChild(el('span', 'tiempo-dia-desc', descripcion(code)));
        const prob = t.daily.precipitation_probability_max[i];
        const agua = el('span', 'tiempo-dia-agua', prob > 0 ? prob + '%' : '');
        f.appendChild(agua);
        f.appendChild(el('span', 'tiempo-dia-max',
          Math.round(t.daily.temperature_2m_max[i]) + '°'));
        f.appendChild(el('span', 'tiempo-dia-min',
          Math.round(t.daily.temperature_2m_min[i]) + '°'));
        lista.appendChild(f);
      }
      panel.appendChild(lista);
    }

    if (aire && aire.current && aire.current.us_aqi != null) {
      const c = aire.current;
      const aqi = Math.round(c.us_aqi);
      panel.appendChild(el('h3', 'tiempo-subtitulo', 'Calidad del aire'));
      const cab = el('div', 'tiempo-aire-cab');
      cab.appendChild(el('span', 'tiempo-aqi ' + claseAire(aqi), String(aqi)));
      cab.appendChild(el('span', 'tiempo-aire-nivel ' + claseAire(aqi), nivelAire(aqi)));
      panel.appendChild(cab);

      const datos = el('div', 'tiempo-contaminantes');
      [['PM2.5', c.pm2_5], ['PM10', c.pm10], ['NO₂', c.nitrogen_dioxide], ['O₃', c.ozone]]
        .forEach(function (par) {
          if (par[1] == null) return;
          datos.appendChild(fila(par[0], Math.round(par[1] * 10) / 10 + ' µg/m³'));
        });
      panel.appendChild(datos);

      const polen = [
        ['Olivo', c.olive_pollen], ['Gramíneas', c.grass_pollen],
        ['Abedul', c.birch_pollen], ['Álamo', c.alder_pollen],
        ['Artemisa', c.mugwort_pollen], ['Ambrosía', c.ragweed_pollen]
      ].filter(function (par) { return par[1] != null && par[1] > 0; });
      if (polen.length) {
        panel.appendChild(el('h3', 'tiempo-subtitulo', 'Polen'));
        const caja = el('div', 'tiempo-contaminantes');
        polen.forEach(function (par) {
          caja.appendChild(fila(par[0], Math.round(par[1]) + ' granos/m³'));
        });
        panel.appendChild(caja);
      }
    }

    // La atribución que pide Open-Meteo, igual que en la app.
    const pie = el('p', 'tiempo-atribucion');
    const a = el('a', null, 'Open-Meteo');
    a.href = 'https://open-meteo.com/';
    a.rel = 'noopener';
    a.target = '_blank';
    pie.append(document.createTextNode('Datos de '), a, document.createTextNode(' (CC BY 4.0)'));
    panel.appendChild(pie);
  }

  async function iniciar(donde) {
    const punto = (await dondeMirar()) ||
      { lat: L.SEVILLA.lat, lon: L.SEVILLA.lon };

    let t = null;
    let aire = null;
    try { t = await tiempoDe(punto.lat, punto.lon); } catch (_) { return; }
    if (!t || !t.current) return;
    try { aire = await aireDe(punto.lat, punto.lon); } catch (_) { /* el aire es opcional */ }

    const code = t.current.weather_code;
    const temp = Math.round(t.current.temperature_2m);

    const caja = el('div', 'tiempo');
    const boton = el('button', 'tiempo-resumen');
    boton.type = 'button';
    boton.setAttribute('aria-expanded', 'false');
    boton.appendChild(svgIcono(familia(code), 24));
    boton.appendChild(el('span', 'tiempo-temp', temp + '°'));
    boton.appendChild(el('span', 'tiempo-desc', descripcion(code)));
    if (aire && aire.current && aire.current.us_aqi != null) {
      const aqi = Math.round(aire.current.us_aqi);
      boton.appendChild(el('span', 'tiempo-chip ' + claseAire(aqi),
        'Aire ' + nivelAire(aqi).toLowerCase()));
    }
    boton.appendChild(el('span', 'tiempo-flecha', '▾'));

    const panel = el('div', 'tiempo-panel');
    panel.hidden = true;
    const id = 'tiempo-panel';
    panel.id = id;
    boton.setAttribute('aria-controls', id);

    let pintado = false;
    boton.addEventListener('click', function () {
      const abierto = panel.hidden;
      if (abierto && !pintado) { pintarPanel(panel, t, aire); pintado = true; }
      panel.hidden = !abierto;
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      caja.classList.toggle('abierto', abierto);
    });

    caja.append(boton, panel);
    donde.appendChild(caja);
  }

  window.SeviTiempo = { iniciar: iniciar };

  // Arranca solo: no tiene nada que ver con la lista de sitios, así que no
  // hace falta tocar `explorar.js` ni esperarla. Si falla la petición no se
  // pinta nada y la página sigue entera.
  function arrancar() {
    const donde = document.getElementById('hueco-tiempo');
    if (donde) iniciar(donde);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
