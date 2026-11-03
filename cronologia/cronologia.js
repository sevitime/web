// La cronología: lo que va pasando en SeviTime, con nombre y apellidos.
//
// Las reseñas de la gente, sus fotos y los sitios que añaden, en orden. Es
// lo mismo que ya se ve repartido por las fichas de cada sitio, junto y por
// fecha: la idea es que al abrirlo se note que esto lo mueve gente.
//
// Lo que decide qué sale está en el servidor (`fn_cronologia`), no aquí:
// solo lo aprobado, solo quien tiene apodo y solo quien no ha pedido salirse
// de las listas públicas. Ver `docs/sql/cronologia.sql` en el repo de la app.
//
// No se puede etiquetar a nadie, y es a propósito: que una persona publique
// dónde estuvo otra es dato de un tercero.
(function () {
  'use strict';

  const lista = document.getElementById('lista');
  const estado = document.getElementById('estado');
  if (!lista) return;

  const API = 'https://kdqiwhvtovafugpcrumf.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

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

  function fila(item) {
    const li = el('li', 'crono-item');

    const cabecera = el('div', 'crono-cabecera');
    cabecera.appendChild(avatar(item));
    const quien = el('div', 'crono-quien');
    const linea = el('p', 'crono-linea');
    linea.appendChild(el('strong', null, item.apodo));
    linea.appendChild(document.createTextNode(
      item.tipo === 'lugar' ? ' ha añadido ' : ' ha reseñado '));
    // El sitio enlaza a su ficha, que es a donde quiere ir quien lo lea.
    if (item.place_key) {
      const a = el('a', 'crono-sitio', item.sitio);
      a.href = '/lugar/?k=' + encodeURIComponent(item.place_key);
      linea.appendChild(a);
    } else {
      linea.appendChild(el('span', 'crono-sitio', item.sitio));
    }
    quien.appendChild(linea);
    quien.appendChild(el('span', 'crono-cuando', haceCuanto(item.cuando)));
    cabecera.appendChild(quien);
    li.appendChild(cabecera);

    if (item.rating != null) {
      li.appendChild(el('p', 'crono-estrellas', estrellas(item.rating)));
    }
    if (item.texto) li.appendChild(el('p', 'crono-texto', '«' + item.texto + '»'));
    if (item.foto_url) {
      const img = document.createElement('img');
      img.className = 'crono-foto';
      img.src = item.foto_url;
      img.alt = 'Foto de ' + item.sitio + ', por ' + item.apodo;
      img.loading = 'lazy';
      li.appendChild(img);
    }
    return li;
  }

  fetch(API + 'rpc/fn_cronologia', {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_limite: 40 }),
  })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (filas) {
      if (!Array.isArray(filas) || !filas.length) {
        estado.textContent = 'Todavía no hay nada que contar. En cuanto alguien ' +
          'reseñe un sitio o añada uno nuevo, saldrá aquí.';
        return;
      }
      estado.hidden = true;
      filas.forEach(function (f) { lista.appendChild(fila(f)); });
    })
    .catch(function () {
      estado.textContent = 'No hemos podido cargarlo. Inténtalo en un momento.';
    });
}());
