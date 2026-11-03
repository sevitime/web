// Lo que comparten la pantalla de la cronología y la tira de la portada.
//
// Son dos presentaciones de lo mismo —una lista entera y un resumen de tres
// líneas—, y lo que no puede diferir es cómo se nombra a la gente, cómo se
// dicen las fechas y cómo se pinta un avatar. El resto lo pone cada una.
(function () {
  'use strict';

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function haceCuanto(iso) {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 60) return min <= 1 ? 'ahora mismo' : 'hace ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return h === 1 ? 'hace 1 hora' : 'hace ' + h + ' horas';
    const d = Math.round(h / 24);
    if (d < 7) return d === 1 ? 'ayer' : 'hace ' + d + ' días';
    const sem = Math.round(d / 7);
    if (sem < 5) return sem === 1 ? 'hace 1 semana' : 'hace ' + sem + ' semanas';
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  }

  function estrellas(n) {
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    return '★'.repeat(v) + '☆'.repeat(5 - v);
  }

  // Los avatares no son URLs: la mayoría son `preset:<id>`, un dibujo de los
  // doce que ofrece la app. Pintarlos como imagen daba un error de esquema
  // desconocido y dejaba el hueco en blanco. Mismas tablas que `perfil.js`.
  const COLOR_PRESET = {
    giralda: '#00897B', catedral: '#5E7A8A', azahar: '#7CB342', ceramica: '#1E88E5',
    rebujito: '#C0A020', barco: '#00838F', flamenco: '#AD1457', abanico: '#6D4C9F',
    farol: '#E65100', sol: '#F9A825', madruga: '#37474F', cafe: '#6D4C41',
  };
  const EMOJI_PRESET = {
    giralda: '🏛️', catedral: '⛪', azahar: '🌸', ceramica: '🔷',
    rebujito: '🍷', barco: '⛵', flamenco: '🎵', abanico: '🎐',
    farol: '💡', sol: '☀️', madruga: '🌙', cafe: '☕',
  };

  function avatar(item) {
    const guardado = item.avatar || '';
    if (guardado.indexOf('preset:') === 0) {
      const id = guardado.slice(7);
      const d = el('span', 'crono-avatar crono-inicial', EMOJI_PRESET[id] || '📍');
      d.style.background = COLOR_PRESET[id] || '#00897B';
      return d;
    }
    if (guardado) {
      const img = document.createElement('img');
      img.className = 'crono-avatar';
      img.src = guardado;
      img.alt = '';
      img.width = 40;
      img.height = 40;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      return img;
    }
    // Sin nada, la inicial sobre un disco, como en el cuadro de honor.
    return el('span', 'crono-avatar crono-inicial',
      (item.apodo || '?').trim().charAt(0).toUpperCase());
  }


  /// «Fulano ha reseñado Tal sitio», con el sitio enlazando a su ficha.
  function linea(item, clase) {
    const p = el('p', clase || 'crono-linea');
    p.appendChild(el('strong', null, item.apodo));
    p.appendChild(document.createTextNode(
      item.tipo === 'lugar' ? ' ha añadido ' : ' ha reseñado '));
    if (item.place_key) {
      const a = el('a', 'crono-sitio', item.sitio);
      a.href = '/lugar/?k=' + encodeURIComponent(item.place_key);
      p.appendChild(a);
    } else {
      p.appendChild(el('span', 'crono-sitio', item.sitio));
    }
    return p;
  }

  const API = 'https://kdqiwhvtovafugpcrumf.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  // --- Novedades desde la última visita -------------------------------------
  //
  // Local y por dispositivo, igual que en la app: no es una tabla ni se
  // sincroniza. Solo sirve para el contador de «Qué pasa»; la cronología se
  // ve entera siempre.
  const CLAVE_VISTO = 'sevi-crono-visto';

  function leerVisto() {
    try { return localStorage.getItem(CLAVE_VISTO); } catch (_) { return null; }
  }

  function marcarVisto(cuando) {
    const t = new Date(cuando).getTime();
    if (isNaN(t)) return;
    try {
      const previo = new Date(localStorage.getItem(CLAVE_VISTO) || '').getTime();
      if (!isNaN(previo) && !(t > previo)) return;
      localStorage.setItem(CLAVE_VISTO, new Date(t).toISOString());
    } catch (_) { /* almacenamiento lleno o bloqueado: sin contador */ }
  }

  // La primera vez se siembra con la entrada más reciente, para no enseñar
  // como nuevas las que ya estaban antes de que nadie abriera la página.
  function inicializarVisto(filas) {
    if (leerVisto()) return;
    if (Array.isArray(filas) && filas.length) marcarVisto(filas[0].cuando);
  }

  function nuevas(filas) {
    const desde = new Date(leerVisto() || '').getTime();
    if (isNaN(desde) || !Array.isArray(filas)) return 0;
    return filas.reduce(function (total, f) {
      const t = new Date(f.cuando).getTime();
      return !isNaN(t) && t > desde ? total + 1 : total;
    }, 0);
  }

  function pedir(limite) {
    return fetch(API + 'rpc/fn_cronologia', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limite: limite }),
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  window.SeviCrono = {
    el: el,
    avatar: avatar,
    haceCuanto: haceCuanto,
    estrellas: estrellas,
    linea: linea,
    pedir: pedir,
    leerVisto: leerVisto,
    marcarVisto: marcarVisto,
    inicializarVisto: inicializarVisto,
    nuevas: nuevas,
  };
}());
