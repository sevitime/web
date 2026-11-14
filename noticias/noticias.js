// «Sevilla al día»: las noticias que ha recogido el servidor.
//
// La web **no** puede leer los canales RSS: ninguno de los tres medios
// permite CORS. Las recoge `sync-noticias` (repo de la app) cada dos horas y
// las deja en la tabla `noticias`, que es de lectura pública con `activa =
// true`. La app lee esa misma tabla, así que las dos enseñan lo mismo.
//
// Se enseña titular, extracto corto y enlace al medio, que es lo que guarda
// el servidor y el modelo de agregador defendible. El cuerpo de la noticia no
// se copia ni se aloja.
(function () {
  'use strict';

  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';
  // Una semana de los tres medios ronda las 250.
  const CUANTAS = 300;
  const { seccionar, temasCon, TEMAS, DIAS } = window.SeviNoticias;

  const estado = document.getElementById('estado');
  const lista = document.getElementById('lista');
  const chips = document.getElementById('chips');
  let todas = [];
  let tema = null;

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const minutos = Math.round((Date.now() - d.getTime()) / 60000);
    if (minutos < 60) return minutos <= 1 ? 'ahora mismo' : 'hace ' + minutos + ' min';
    const horas = Math.round(minutos / 60);
    if (horas < 24) return horas === 1 ? 'hace 1 hora' : 'hace ' + horas + ' horas';
    const dias = Math.round(horas / 24);
    if (dias === 1) return 'ayer';
    if (dias < 7) return 'hace ' + dias + ' días';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  }

  function pintarChips(temas) {
    chips.textContent = '';
    // Con un solo tema, los chips no filtran nada.
    if (temas.length < 2) { chips.hidden = true; return; }
    const opciones = [{ id: null, etiqueta: 'Todas' }]
      .concat(TEMAS.filter((t) => temas.indexOf(t.id) >= 0));
    opciones.forEach(function (o) {
      const b = el('button', 'chip' + (o.id === tema ? ' seleccionado' : ''), o.etiqueta);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(o.id === tema));
      b.addEventListener('click', function () { tema = o.id; pintar(); });
      chips.appendChild(b);
    });
    chips.hidden = false;
  }

  // Por días, como en la app: «Hoy», «Ayer» y «Esta semana».
  function pintar() {
    const ahora = new Date();
    const temas = temasCon(todas, ahora);
    // Si el tema elegido se ha quedado sin noticias, vuelta a «Todas».
    if (temas.indexOf(tema) < 0) tema = null;
    pintarChips(temas);
    lista.textContent = '';
    seccionar(todas, ahora, tema).forEach(function (s) {
      const cab = el('h2', 'n-dia', s.titulo);
      cab.appendChild(el('span', 'n-cuenta', String(s.noticias.length)));
      lista.appendChild(cab);
      const ul = el('ul', 'n-lista');
      pintarLista(ul, s.noticias);
      lista.appendChild(ul);
    });
    estado.hidden = true;
  }

  function pintarLista(ul, noticias) {
    noticias.forEach(function (n) {
      const item = el('li', 'n-item');
      const enlace = el('a', 'n-enlace');
      enlace.href = n.url;
      enlace.rel = 'noopener nofollow';
      enlace.target = '_blank';

      if (n.imagen_url) {
        const img = document.createElement('img');
        img.className = 'n-foto';
        img.src = n.imagen_url;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 104;
        img.height = 104;
        // La imagen es del medio: ni se le dice de dónde viene la visita ni
        // se guarda nada de quien mira.
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { img.remove(); });
        enlace.appendChild(img);
      }

      const cuerpo = el('div', 'n-cuerpo');
      // Todo esto viene de un medio: se pinta con `textContent`, nunca como
      // HTML.
      cuerpo.appendChild(el('h3', 'n-titulo', n.titulo || ''));
      if (n.descripcion) cuerpo.appendChild(el('p', 'n-extracto', n.descripcion));
      cuerpo.appendChild(el('span', 'n-meta',
        [n.fuente, cuando(n.fecha)].filter(Boolean).join(' · ')));
      enlace.appendChild(cuerpo);
      item.appendChild(enlace);
      ul.appendChild(item);
    });
  }

  fetch(SUPABASE_URL + '/rest/v1/noticias' +
    '?select=titulo,descripcion,url,imagen_url,fuente,fecha,tema' +
    '&activa=eq.true&fecha=gte.' + new Date(Date.now() - DIAS * 864e5).toISOString() +
    '&order=fecha.desc&limit=' + CUANTAS, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (noticias) {
      if (!noticias.length) {
        // Puede ser que el recolector aún no esté en marcha. Se dice sin
        // echarle la culpa a nadie y sin dejar la página en blanco.
        estado.textContent = 'Ahora mismo no hay noticias guardadas. ' +
          'Vuelve dentro de un rato.';
        return;
      }
      todas = noticias;
      pintar();
    })
    .catch(function () {
      estado.textContent = 'No se han podido cargar las noticias. ' +
        'Recarga dentro de un momento.';
    });
})();
