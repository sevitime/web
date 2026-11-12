// La página de un sitio, para que compartir un bar lleve a SeviTime y no a
// Google Maps.
//
// La clave del sitio va en `?k=`, y es la MISMA que usa la app
// (`Place.placeKey`: latitud y longitud con cinco decimales, separadas por
// un guion bajo). Así el enlace que comparte la app y lo que busca esta
// página hablan el mismo idioma, sin una tabla de equivalencias que
// mantener.
//
// Este script sirve a dos clases de página:
//
//   * `/lugar/?k=…`, una sola para cualquier sitio. Es adonde llevan el
//     mapa, Explorar y los enlaces que comparte la app. Su HTML es genérico:
//     el nombre y los datos los pone este script.
//   * `/sitio/<nombre>/`, una página generada por sitio para los que tienen
//     datos (`tool/sitemap_lugares.mjs`). Trae el nombre, la dirección, el
//     horario y los datos estructurados ya escritos, que es lo que leen
//     Google y la vista previa de WhatsApp, y la clave en `<html data-k>`.
//     Se hicieron el 12-nov-2026: un mes después de mandarle a Google 526
//     direcciones `?k=`, no había indexado ninguna.
(function () {
  const PLAY = 'https://play.google.com/store/apps/details?id=com.selu.sevitime';
  // La clave del sitio. Si falta, se mira la que guardó `lugar/resena.js`
  // antes de mandar a alguien al login: así, aunque Supabase devuelva a
  // `/lugar/` sin el `?k=`, se vuelve a la ficha que se estaba mirando y no
  // a un «no encontramos ese sitio».
  //
  // Las páginas generadas (`/sitio/<nombre>/`, ver `tool/fichas_sitio.mjs`)
  // la traen escrita en `<html data-k="…">`: son esta misma ficha con el
  // sitio ya puesto, para que Google y WhatsApp lean el nombre, la dirección
  // y el horario sin tener que ejecutar nada.
  const claveFija = document.documentElement.getAttribute('data-k');
  const clave = claveFija ||
    new URLSearchParams(location.search).get('k') || claveGuardada();

  function claveGuardada() {
    try {
      const k = sessionStorage.getItem('sevi-lugar-abierto');
      // Se usa una vez y se borra: si no, entrar en `/lugar/` sin clave
      // llevaría semanas después al último sitio que alguien miró.
      sessionStorage.removeItem('sevi-lugar-abierto');
      if (k) history.replaceState(null, '', '/lugar/?k=' + encodeURIComponent(k));
      return k;
    } catch (_) { return null; }
  }

  const ficha = document.getElementById('ficha');
  const aviso = document.getElementById('no-encontrado');

  function noEncontrado() {
    ficha.hidden = true;
    aviso.hidden = false;
    // Un enlace a un sitio que ya no está (cerró, se ocultó) no tiene nada
    // que enseñar: que Google no lo guarde como si fuera una página.
    meta('name', 'robots', 'noindex');
  }

  /// Crea o actualiza un <meta> de la cabecera.
  function meta(atributo, clave, contenido) {
    let m = document.head.querySelector('meta[' + atributo + '="' + clave + '"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute(atributo, clave);
      document.head.appendChild(m);
    }
    m.setAttribute('content', contenido);
  }

  /// Lo que lee un buscador de esta ficha: dirección propia, descripción con
  /// lo que de verdad se enseña y los datos estructurados del sitio.
  ///
  /// Solo se declara lo que está a la vista en la página. Nada de
  /// valoraciones ni de «abierto ahora»: aquí no se enseñan, y unos datos
  /// estructurados que dicen más que la página son justo lo que Google
  /// penaliza.
  function paraBuscadores(p) {
    // En una página generada todo esto ya viene escrito en el HTML. Solo se
    // recogen los datos estructurados, por si luego hay que sumarles la nota.
    if (claveFija) {
      const escrito = document.head.querySelector('script[type="application/ld+json"]');
      if (escrito) {
        try {
          datosEstructurados = { nodo: escrito, datos: JSON.parse(escrito.textContent) };
        } catch (_) { /* Sin datos estructurados no se rompe nada. */ }
      }
      return;
    }

    const url = 'https://sevitime.com/lugar/?k=' + clave;
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = url;
    document.head.appendChild(canonical);
    // Si este sitio tiene página propia, la buena es aquella: se le dice a
    // Google para que no guarde las dos.
    fetch('/sitio/indice.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (indice) {
        if (indice && indice[clave]) {
          canonical.href = 'https://sevitime.com/sitio/' + indice[clave] + '/';
        }
      }).catch(function () {});

    const tipo = (p.label || 'Sitio').trim();
    const sabe = [
      p.horario ? 'horario' : '',
      p.telefono ? 'teléfono' : '',
      p.web ? 'web' : '',
    ].filter(Boolean);
    const descripcion = p.nombre + ' (' + tipo.toLowerCase() + ') en SeviTime, el mapa de Sevilla y su provincia' +
      (sabe.length ? ', con su ' + sabe.join(', ').replace(/, ([^,]*)$/, ' y $1') : '') +
      '.';
    meta('name', 'description', descripcion);
    meta('property', 'og:url', url);
    meta('property', 'og:title', p.nombre + ' — SeviTime');
    meta('property', 'og:description', descripcion);

    const datos = {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: p.nombre,
      url: url,
      geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon },
    };
    if (p.telefono) datos.telephone = p.telefono;
    if (p.web) datos.sameAs = p.web;
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify(datos);
    document.head.appendChild(ld);
    datosEstructurados = { nodo: ld, datos: datos };
  }

  // ---- Lo que dice la gente ------------------------------------------------
  //
  // Hasta el 11-oct-2026 la ficha de la web solo enseñaba los datos del
  // sitio; la de la app, además, su nota y sus reseñas. Aquí se enseñan las
  // dos cosas tal como salen en la app: la media de `place_ratings` y las
  // reseñas aprobadas de `fn_resenas_publicas`, de cinco en cinco.
  //
  // Solo se leen. Valorar, reseñar y dar me gusta a una reseña piden
  // cuenta en la app, y aquí no se ofrecen: se manda a la app.
  //
  // Todo lo que viene de una reseña es texto de un usuario: se pinta con
  // `textContent`, nunca como HTML.
  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';
  const POR_TANDA = 5;
  let datosEstructurados = null;
  let resenasPintadas = 0;
  // Qué repintado de las opiniones es el válido. Si entra una sesión
  // mientras la primera carga está en vuelo, las dos vaciaban la lista y
  // luego las dos añadían sus filas: salía la nota dos veces y ocho reseñas
  // donde había cinco. Gana el último que empezó.
  let generacionOpiniones = 0;

  // El token de la sesión, si la hay. Importa para `fn_resenas_publicas`:
  // con la clave pública a secas el servidor no puede decir cuáles reseñas
  // son tuyas ni a cuáles ya diste «me gusta», y el botón saldría mal puesto.
  let tokenActual = null;

  function leerToken() {
    const sb = window.SEVI && window.SEVI.sb;
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession()
      .then(function (r) {
        return (r && r.data && r.data.session) ? r.data.session.access_token : null;
      })
      .catch(function () { return null; });
  }

  function pedir(ruta, opciones) {
    const o = opciones || {};
    return fetch(SUPABASE_URL + '/rest/v1/' + ruta, {
      method: o.cuerpo ? 'POST' : 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + (tokenActual || SUPABASE_KEY),
        'Content-Type': 'application/json',
      },
      body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function estrellas(nota) {
    const n = Math.max(0, Math.min(5, Math.round(nota)));
    const s = document.createElement('span');
    s.className = 'estrellas';
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', n + ' de 5 estrellas');
    s.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    return s;
  }

  function pintarNota(fila) {
    const votos = fila ? Number(fila.vote_count) || 0 : 0;
    const media = fila ? Number(fila.average_rating) || 0 : 0;
    if (votos < 1 || media <= 0) return;
    const caja = document.getElementById('opiniones-nota');
    const numero = document.createElement('span');
    numero.className = 'opiniones-media';
    numero.textContent = media.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const cuantas = document.createElement('span');
    cuantas.className = 'opiniones-cuantas';
    cuantas.textContent = votos === 1 ? '1 valoración' : votos.toLocaleString('es-ES') + ' valoraciones';
    caja.append(numero, estrellas(media), cuantas);
    caja.hidden = false;

    // La nota, también para los buscadores: es un dato que está a la vista.
    if (datosEstructurados) {
      datosEstructurados.datos.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Math.round(media * 10) / 10,
        ratingCount: votos,
        bestRating: 5,
        worstRating: 1,
      };
      datosEstructurados.nodo.textContent = JSON.stringify(datosEstructurados.datos);
    }
  }

  // Datos editoriales, vídeos y rutas son de lectura pública. Se cargan
  // después de tener la ficha y cada bloque falla de forma independiente.
  function pintarExtras(p) {
    pedir('place_videos?select=youtube_id,titulo,es_short&activo=eq.true&place_name=eq.' + encodeURIComponent(p.nombre) + '&order=orden.asc&limit=5')
      .then(function (filas) {
        if (!Array.isArray(filas) || !filas.length) return;
        const lista = document.getElementById('lista-videos');
        filas.forEach(function (v) {
          if (typeof v.youtube_id !== 'string' || !/^[\w-]{11}$/.test(v.youtube_id)) return;
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.youtube_id);
          a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.textContent = (v.titulo || p.nombre) + (v.es_short ? ' · Short' : '');
          li.appendChild(a); lista.appendChild(li);
        });
        if (lista.children.length) document.getElementById('videos-sitio').hidden = false;
      }).catch(function () {});

    pedir('rpc/fn_rutas_de_lugar', { cuerpo: { p_place_key: clave } })
      .then(function (filas) {
        if (!Array.isArray(filas) || !filas.length) return;
        const lista = document.getElementById('lista-rutas');
        filas.slice(0, 5).forEach(function (r) {
          const id = Number(r.id);
          const nombre = typeof r.nombre === 'string' ? r.nombre : '';
          if (!Number.isInteger(id) || !nombre) return;
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '/rutas/?id=' + encodeURIComponent(id);
          a.textContent = nombre;
          li.appendChild(a);
          const detalle = [
            Number(r.paradas) > 1 ? Number(r.paradas) + ' paradas' : 'Recomendación',
            Number(r.minutos) > 0 ? Number(r.minutos) + ' min' : '',
          ].filter(Boolean).join(' · ');
          const meta = document.createElement('p');
          meta.className = 'extra-nota'; meta.textContent = detalle;
          li.appendChild(meta);
          if (typeof r.nota === 'string' && r.nota.trim()) {
            const nota = document.createElement('p');
            nota.className = 'extra-nota'; nota.textContent = r.nota;
            li.appendChild(nota);
          }
          lista.appendChild(li);
        });
        if (lista.children.length) document.getElementById('rutas-sitio').hidden = false;
      }).catch(function () {});
  }

  // El autor y la licencia de un crédito de Commons, o `null` si no están.
  //
  // `foto_credito` se guarda como «Autor · CC BY-SA 4.0 · Wikimedia Commons».
  // La licencia no siempre es una CC con versión: de las 150 fotos del
  // catálogo, 33 son CC0 o dominio público, que no obligan a atribuir. Se
  // acredita igual, así que aquí valen las tres formas.
  const ES_LICENCIA = /^(CC[\s0]|Dominio público$)/i;

  function partesDelCredito(texto) {
    const limpio = (texto || '').replace(/\s*·\s*Wikimedia Commons\s*$/i, '').trim();
    if (!limpio) return null;
    const trozos = limpio.split(' · ');
    const licencia = trozos.find(function (t) { return ES_LICENCIA.test(t); });
    const autor = trozos.filter(function (t) { return !ES_LICENCIA.test(t); }).join(' · ');
    if (!autor || !licencia) return null;
    return { autor: autor, licencia: licencia };
  }

  // El enlace al texto de la licencia, o `null` si no lo tiene (el dominio
  // público no es una licencia que enlazar: es la ausencia de una).
  function enlaceDeLicencia(licencia) {
    if (/^CC0/i.test(licencia)) {
      return 'https://creativecommons.org/publicdomain/zero/1.0/';
    }
    const cc = licencia.match(/^CC\s+(BY(?:-SA)?)\s+(\d+(?:\.\d+)?)(?:\s+([a-z-]+))?/i);
    if (!cc) return null;
    const tipo = cc[1].toLowerCase() === 'by-sa' ? 'by-sa' : 'by';
    return 'https://creativecommons.org/licenses/' + tipo + '/' + cc[2] + '/' +
      (cc[3] ? cc[3].toLowerCase() + '/' : '');
  }

  function pintarFotoSitio(p) {
    function esHttps(url) {
      try { return new URL(url).protocol === 'https:'; }
      catch (_) { return false; }
    }
    const cercania = 0.0005;
    const parametros = new URLSearchParams({
      select: 'imagen_url,foto_web_autorizada_at,lat,lon',
      nombre: 'eq.' + p.nombre,
      activo: 'eq.true',
      foto_web_autorizada_at: 'not.is.null',
      and: '(lat.gte.' + (p.lat - cercania) + ',lat.lte.' + (p.lat + cercania) +
        ',lon.gte.' + (p.lon - cercania) + ',lon.lte.' + (p.lon + cercania) + ')',
      limit: '30',
    });
    // La selección final se hace por distancia exacta entre altas homónimas.
    const manual = pedir('lugares_manuales?' + parametros.toString())
      .then(function (filas) {
        return (filas || [])
          .filter(function (f) { return esHttps(f.imagen_url); })
          .sort(function (a, b) {
            return Math.hypot(a.lat - p.lat, a.lon - p.lon) - Math.hypot(b.lat - p.lat, b.lon - p.lon);
          })[0] || null;
      }).catch(function () { return null; });
    const curada = pedir('curated_places?select=image_url,image_use_scope,image_permission_recorded_at,image_author,image_title,image_license,image_source_url,image_license_url&name=eq.' + encodeURIComponent(p.nombre) + '&limit=1')
      .then(function (filas) {
        const f = filas && filas[0];
        if (!f || f.image_use_scope !== 'external_license' || !esHttps(f.image_url) ||
            !f.image_author || !f.image_license || !esHttps(f.image_source_url) ||
            !esHttps(f.image_license_url)) return null;
        return { tipo: 'externa', ...f };
      }).catch(function () { return null; });

    // Las fotos editoriales de Wikimedia ya tienen su crédito en
    // `lugar_destacado.foto_credito`. Son independientes de las fotos que
    // aportan usuarios y no requieren el permiso opcional de estas últimas.
    //
    // `foto_credito` es obligatorio aquí: son fotos CC BY o CC BY-SA, y su
    // licencia exige nombrar al autor y decir bajo qué licencia están. De las
    // 150 filas activas con foto, 33 no lo tienen guardado; esas no se
    // publican en la web hasta que se complete el crédito, porque una foto
    // CC sin atribución es un incumplimiento, no un hueco estético.
    const commons = pedir('lugar_destacado?select=nombre,imagen_url,foto_credito&nombre=eq.' + encodeURIComponent(p.nombre) + '&activo=eq.true&foto_credito=not.is.null&limit=1')
      .then(function (filas) {
        const f = filas && filas[0];
        if (!f || !esHttps(f.imagen_url) ||
            !/^https:\/\/commons\.wikimedia\.org\//i.test(f.imagen_url)) return null;
        // Que esté la columna no basta: hace falta poder sacar de ella un
        // autor y una licencia.
        const partes = partesDelCredito(f.foto_credito);
        if (!partes) return null;
        return { tipo: 'commons', partes: partes, ...f };
      }).catch(function () { return null; });

    Promise.all([manual, curada, commons]).then(function (resultados) {
      const f = resultados[0]
        ? { ...resultados[0], tipo: 'usuario' }
        : (resultados[1] || resultados[2]);
      if (!f) return;
      const imagen = document.getElementById('foto-sitio-imagen');
      imagen.src = f.tipo === 'externa' ? f.image_url : f.imagen_url;
      imagen.alt = f.tipo === 'externa' && f.image_title ? f.image_title : 'Foto del sitio ' + p.nombre;
      imagen.addEventListener('error', function () {
        document.getElementById('foto-sitio').hidden = true;
      }, { once: true });
      const credito = document.getElementById('foto-sitio-credito');
      if (f.tipo === 'externa') {
        const autor = document.createElement('span');
        autor.textContent = f.image_author + (f.image_title ? ' · «' + f.image_title + '»' : '');
        const fuente = document.createElement('a');
        fuente.href = f.image_source_url;
        fuente.textContent = 'Fuente';
        fuente.target = '_blank'; fuente.rel = 'noopener noreferrer';
        const licencia = document.createElement('a');
        licencia.href = f.image_license_url;
        licencia.textContent = f.image_license;
        licencia.target = '_blank'; licencia.rel = 'noopener noreferrer';
        credito.append(autor, document.createTextNode(' · '), fuente, document.createTextNode(' · '), licencia);
      } else if (f.tipo === 'commons') {
        const archivo = new URL(f.imagen_url).pathname.match(/Special:FilePath\/([^/]+)/i);
        const enlaceFuente = document.createElement('a');
        enlaceFuente.href = archivo
          ? 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(decodeURIComponent(archivo[1]))
          : f.imagen_url;
        enlaceFuente.textContent = 'Wikimedia Commons';
        enlaceFuente.target = '_blank'; enlaceFuente.rel = 'noopener noreferrer';
        credito.append(document.createTextNode(f.partes.autor + ' · '));
        const href = enlaceDeLicencia(f.partes.licencia);
        if (href) {
          const enlaceLicencia = document.createElement('a');
          enlaceLicencia.href = href;
          enlaceLicencia.textContent = f.partes.licencia;
          enlaceLicencia.target = '_blank'; enlaceLicencia.rel = 'noopener noreferrer';
          credito.append(enlaceLicencia, document.createTextNode(' · '));
        } else {
          credito.append(document.createTextNode(f.partes.licencia + ' · '));
        }
        credito.append(enlaceFuente);
      } else {
        credito.textContent = 'Foto aportada a SeviTime';
      }
      document.getElementById('foto-sitio').hidden = false;
    });
  }

  function tarjetaResena(r) {
    const li = document.createElement('li');
    li.className = 'resena';

    const cab = document.createElement('div');
    cab.className = 'resena-cab';
    const quien = (r.nombre_publico || '').trim();
    let autor;
    // Quien no ha elegido apodo llega como «Usuario de SeviTime»: no es un
    // nombre, así que no hay perfil al que enlazar.
    if (quien && quien !== 'Usuario de SeviTime') {
      autor = document.createElement('a');
      autor.href = '/perfil/?n=' + encodeURIComponent(quien);
      autor.textContent = quien;
    } else {
      autor = document.createElement('span');
      autor.textContent = quien || 'Usuario de SeviTime';
    }
    autor.className = 'resena-autor';
    cab.append(autor, estrellas(r.rating));
    const cuando = new Date(r.created_at);
    if (!isNaN(cuando)) {
      const fecha = document.createElement('span');
      fecha.className = 'resena-fecha';
      fecha.textContent = cuando.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      cab.appendChild(fecha);
    }
    // Con sesión, el recuento se convierte en el botón de «Me gusta» (lo pone
    // `lugar/resena.js`, que es quien puede escribirlo). Sin sesión, o en la
    // reseña propia, se queda en el texto de siempre.
    const boton = window.SeviResena ? window.SeviResena.botonUtil(r) : null;
    if (!boton && r.utiles_count > 0) {
      const util = document.createElement('span');
      util.className = 'resena-util';
      util.textContent = r.utiles_count === 1 ? 'Le gusta a 1 persona' : 'Le gusta a ' + r.utiles_count + ' personas';
      cab.appendChild(util);
    }
    li.appendChild(cab);

    // Una reseña de cuando el local era otro negocio: se dice, para que no
    // se lea como una opinión del de ahora.
    if (r.epoca_anterior) {
      const epoca = document.createElement('span');
      epoca.className = 'resena-epoca';
      epoca.textContent = r.nombre_epoca
        ? 'De cuando se llamaba «' + r.nombre_epoca + '»'
        : 'De una etapa anterior del local';
      li.appendChild(epoca);
    }

    const texto = (r.comentario || '').trim();
    if (texto) {
      const p = document.createElement('p');
      p.className = 'resena-texto';
      p.textContent = texto;
      li.appendChild(p);
    }

    const fotos = (Array.isArray(r.fotos) && r.fotos.length ? r.fotos : (r.foto_url ? [r.foto_url] : []))
      .filter(function (u) { return typeof u === 'string' && /^https:\/\//.test(u); });
    if (fotos.length) {
      const tira = document.createElement('div');
      tira.className = 'resena-fotos';
      fotos.forEach(function (url, i) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        const img = document.createElement('img');
        img.src = url;
        img.loading = 'lazy';
        img.width = 96;
        img.height = 96;
        img.referrerPolicy = 'no-referrer';
        img.alt = 'Foto ' + (i + 1) + ' de la reseña de ' + (quien || 'alguien de SeviTime');
        a.appendChild(img);
        tira.appendChild(a);
      });
      li.appendChild(tira);
    }
    // El botón va al final, debajo del texto y de las fotos: primero se lee
    // la reseña y después se dice si ha servido.
    if (boton) li.appendChild(boton);
    return li;
  }

  function cargarResenas(generacion) {
    const boton = document.getElementById('resenas-mas');
    boton.disabled = true;
    // Se pide una de más para saber si quedan, sin una segunda llamada.
    return pedir('rpc/fn_resenas_publicas', {
      cuerpo: { p_place_key: clave, p_limit: POR_TANDA + 1, p_offset: resenasPintadas },
    }).then(function (filas) {
      if (generacion !== undefined && generacion !== generacionOpiniones) return;
      const lista = document.getElementById('resenas');
      (filas || []).slice(0, POR_TANDA).forEach(function (r) {
        lista.appendChild(tarjetaResena(r));
        resenasPintadas++;
      });
      boton.hidden = !filas || filas.length <= POR_TANDA;
      boton.disabled = false;
    });
  }

  function pintarOpiniones() {
    const seccion = document.getElementById('opiniones');
    const caja = document.getElementById('opiniones-nota');
    // Al recargar (alguien entra, deja su reseña o la borra) se parte de
    // cero: si no, la nota se pintaría dos veces y las reseñas saldrían
    // duplicadas debajo de las anteriores.
    caja.textContent = '';
    caja.hidden = true;
    document.getElementById('resenas').textContent = '';
    document.getElementById('resenas-mas').hidden = true;
    resenasPintadas = 0;
    const generacion = ++generacionOpiniones;

    return Promise.all([
      pedir('place_ratings?select=average_rating,vote_count&place_key=eq.' + encodeURIComponent(clave))
        .then(function (filas) {
          if (generacion !== generacionOpiniones) return;
          pintarNota(filas && filas[0]);
        })
        .catch(function () {}),
      cargarResenas(generacion).then(function () { return true; }, function () { return false; }),
    ]).then(function (resultado) {
      if (generacion !== generacionOpiniones) return;
      const hayNota = !caja.hidden;
      const seLeyeron = resultado[1];
      // Si las reseñas no se han podido leer y tampoco hay nota, la sección
      // no se enseña: «todavía no tiene reseñas» sería afirmar algo que no
      // se sabe.
      if (!seLeyeron && !hayNota) return;
      document.getElementById('opiniones-vacio').hidden =
        !seLeyeron || hayNota || resenasPintadas > 0;
      seccion.hidden = false;
    });
  }

  // Una clave con forma, antes de tocar nada: `37.38910_-5.98450`.
  if (!clave || !/^-?\d+\.\d+_-?\d+\.\d+$/.test(clave)) {
    noEncontrado();
    return;
  }
  const [lat, lon] = clave.split('_').map(Number);
  if (!isFinite(lat) || !isFinite(lon)) {
    noEncontrado();
    return;
  }

  // El mapa se pinta ya, con la posición, sin esperar a saber el nombre: es
  // lo que más tarda en llegar y lo que antes contesta «¿dónde está esto?».
  function pintarMapa() {
    if (!window.maplibregl || !window.sevitimeEstiloMapa) return;
    const oscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    usarProtocoloTeselas();
    const map = new maplibregl.Map({
      container: 'mapa-sitio',
      style: sevitimeEstiloMapa(oscuro),
      center: [lon, lat],
      zoom: 16,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    new maplibregl.Marker({ color: oscuro ? '#26A69A' : '#00897B' })
      .setLngLat([lon, lat]).addTo(map);
    // Si el mapa base no carga -el bloqueo de IPs de Cloudflare durante los
    // partidos lo tumba a ratos-, que lo diga en vez de dejar un rectángulo
    // vacío con un pin flotando. Lo mismo que hacen /mapa/ y /rutas/.
    if (window.vigilarTeselas) vigilarTeselas(map);
  }

  function fila(etiqueta, valor, href) {
    const li = document.createElement('li');
    const e = document.createElement('span');
    e.className = 'etiqueta';
    e.textContent = etiqueta;
    li.appendChild(e);
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = valor;
      if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
      li.appendChild(a);
    } else {
      const s = document.createElement('span');
      s.textContent = valor;
      li.appendChild(s);
    }
    return li;
  }

  // A qué distancia está, desde donde está quien mira: lo mismo que la
  // cabecera de la ficha en la app («1,2 km · 14 min andando»).
  //
  // Solo con el permiso de ubicación YA dado (en Explorar, el tiempo o el
  // navegador): abrir la ficha de un sitio no es motivo para pedirlo, y sin
  // ubicación real no se inventa una distancia desde el centro de Sevilla.
  // La app tuvo justo ese fallo: enseñaba «10 m» de sitios lejanos.
  async function pintarDistancia(p) {
    const caja = document.getElementById('distancia');
    let concedido = false;
    try { concedido = localStorage.getItem('sevi-ubicacion-ok') === '1'; } catch (_) {}
    try {
      if (!concedido && navigator.permissions && navigator.permissions.query) {
        concedido = (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted';
      }
    } catch (_) {}
    if (!concedido || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      const m = window.sevitimeLugares.metros({ lat: pos.coords.latitude, lon: pos.coords.longitude },
        { lat: p.lat, lon: p.lon });
      const km = m / 1000;
      // Mismos cortes que `Place.tiempoEstimado`: 12 min por km andando y,
      // desde 1,5 km, mejor en vehículo.
      const tiempo = km >= 1.5 ? 'Mejor en vehículo'
        : Math.max(1, Math.round(km * 12)) + ' min andando';
      caja.textContent = (km >= 1.5 ? '🚗 ' : '🚶 ') + window.sevitimeLugares.formatDist(m) + ' · ' + tiempo;
      caja.hidden = false;
    }, function () {}, { timeout: 8000, maximumAge: 300000 });
  }

  // Lo que hay programado en este sitio, de hoy en adelante.
  //
  // Mismo criterio que la app: radio corto (80 m) y la distancia de verdad
  // medida aquí, porque al servidor se le pide una CAJA de coordenadas y una
  // caja es un cuadrado. Con un radio generoso, en el centro saldría el
  // concierto de la sala de al lado en la ficha de un bar.
  //
  // La web no tiene página por evento todavía, así que el enlace lleva a
  // /eventos/, como hace «Qué pasa».
  function pintarEventos(p) {
    const seccion = document.getElementById('eventos-sitio');
    const lista = document.getElementById('eventos-sitio-lista');
    const cliente = window.SEVI && window.SEVI.sb;
    if (!seccion || !lista || !window.sevitimeLugares) return;
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
    // Supabase se carga aparte y puede no estar todavía: se espera, como en
    // `perfil/seguir.js`. Sin esto la sección se perdía en la primera visita
    // y aparecía solo al recargar.
    if (!cliente) {
      if (window.SEVI && window.SEVI.conSupabase) {
        window.SEVI.conSupabase(function () { pintarEventos(p); });
      }
      return;
    }

    const RADIO = 80;
    const dLat = RADIO / 111000;
    const dLon = RADIO / (111000 * Math.abs(Math.cos(p.lat * Math.PI / 180)));
    const ahora = new Date();

    // Dos fuentes, y las dos hacen falta. La TABLA trae lo que se añade a
    // mano o por `sync-*`, al minuto. La FOTO diaria —la misma que lee
    // /eventos/— trae todo lo demás, que es casi todo el género: el
    // 11-nov-2026 tenía 152 eventos y 143 con coordenadas, de los cuales 69
    // eran del Teatro de la Maestranza, que no escribe en la tabla. Mirando
    // solo la tabla, la ficha del Maestranza no enseñaba ni una función.
    const dePromesa = (pr) => pr.catch(function () { return []; });

    const tabla = dePromesa(cliente.from('eventos').select()
      .gte('lat', p.lat - dLat).lte('lat', p.lat + dLat)
      .gte('lon', p.lon - dLon).lte('lon', p.lon + dLon)
      .gte('inicio', ahora.toISOString())
      .order('inicio').limit(20)
      .then(function (r) { return (r && r.data) || []; }));

    const foto = dePromesa(fetch(
      'https://kdqiwhvtovafugpcrumf.supabase.co/storage/v1/object/public/snapshots/eventos-sevilla.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.events) || []; }));

    // LA CERCANÍA NO BASTA. Hay eventos cuyo «lugar» es la ciudad entera y su
    // coordenada cae encima de lo que haya: medido el 11-nov-2026, «Toda la
    // ciudad» caía a 22 m de la Catedral y «Centro histórico de Sevilla» a
    // 14 m de una farmacia. Anunciar la Bienal en la ficha de una farmacia es
    // peor que no anunciarla, así que además del radio se pide que el nombre
    // del local sea el del sitio. Misma regla que `_mismoLocal` en la app.
    function limpio(v) {
      return String(v || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function mismoLocal(lugarEvento, nombreSitio) {
      const a = limpio(lugarEvento);
      const b = limpio(nombreSitio);
      if (!a || !b) return false;
      if (a === b) return true;
      const corto = a.length <= b.length ? a : b;
      const largo = a.length <= b.length ? b : a;
      // Ocho letras mínimo: si no, un evento cuyo lugar es «Sevilla» entra en
      // cualquier sitio que lleve «Sevilla» en el nombre.
      return corto.length >= 8 && largo.indexOf(corto) !== -1;
    }

    Promise.all([tabla, foto])
      .then(function (dos) {
        const vistos = {};
        const cerca = [];
        dos[0].concat(dos[1]).forEach(function (f) {
          if (typeof f.lat !== 'number' || typeof f.lon !== 'number') return;
          if (window.sevitimeLugares.metros(
            { lat: p.lat, lon: p.lon }, { lat: f.lat, lon: f.lon }) > RADIO) return;
          if (!mismoLocal(f.lugar, p.nombre)) return;
          const cuando = new Date(f.inicio);
          // La foto es de esta madrugada: puede traer lo de hace unas horas.
          if (!(cuando > ahora)) return;
          // La foto incluye lo de la tabla, así que se cuenta una vez. Al
          // minuto, que es lo que las dos vías tienen en común.
          const clave = String(f.nombre || '').trim().toLowerCase()
            + '@' + cuando.toISOString().slice(0, 16);
          if (vistos[clave]) return;
          vistos[clave] = true;
          cerca.push(f);
        });
        cerca.sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
        cerca.splice(3);
        if (!cerca.length) return;

        const dia = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
        cerca.forEach(function (f) {
          const cuando = new Date(f.inicio);
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '/eventos/';

          const icono = document.createElement('span');
          icono.className = 'eventos-sitio-icono';
          icono.textContent = f.icono || '📅';
          icono.setAttribute('aria-hidden', 'true');
          a.appendChild(icono);

          const caja = document.createElement('span');
          const nombre = document.createElement('span');
          nombre.className = 'eventos-sitio-nombre';
          nombre.textContent = f.nombre || 'Evento';
          const linea = document.createElement('span');
          linea.className = 'eventos-sitio-cuando';
          // Sin hora cuando la fuente no la trae: «00:00» en un concierto es
          // peor que no poner nada. Igual que `eventoSinHora` en la app.
          const sinHora = cuando.getHours() === 0 && cuando.getMinutes() === 0;
          linea.textContent = sinHora ? dia.format(cuando)
            : dia.format(cuando) + ' · '
              + String(cuando.getHours()).padStart(2, '0') + ':'
              + String(cuando.getMinutes()).padStart(2, '0');
          caja.append(nombre, linea);
          a.appendChild(caja);

          li.appendChild(a);
          lista.appendChild(li);
        });
        seccion.hidden = false;
      })
      .catch(function () { /* la ficha no pierde nada: no se pinta */ });
  }

  function pintarHistorial(p) {
    const seccion = document.getElementById('historial-sitio');
    const lista = document.getElementById('historial-lista');
    const C = window.SeviCrono;
    if (!seccion || !lista || !C || !window.sevitimeLugares) return;

    window.sevitimeLugares.cambiosDeSitio(p).then(function (filas) {
      if (!filas || !filas.length) return;
      const fecha = new Intl.DateTimeFormat('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      filas.forEach(function (f) {
        const item = {
          tipo: f.tipo, texto: f.texto, valor: f.valor, sitio: p.nombre,
        };
        const li = document.createElement('li');

        const cuando = document.createElement('time');
        cuando.className = 'historial-fecha';
        cuando.dateTime = f.cuando;
        // «6 nov 2026»: en es-ES el mes corto sale «nov.» y sobra el punto.
        cuando.textContent =
          fecha.format(new Date(f.cuando)).replace(/\./g, '');
        li.appendChild(cuando);

        const que = document.createElement('span');
        que.className = 'historial-que';
        let phrase = C.frase(item);
        // En la ficha no va el nombre del sitio detrás, así que el «:» sobra.
        if (phrase.endsWith(':')) phrase = phrase.slice(0, -1);
        que.textContent = phrase;
        li.appendChild(que);

        // El nombre nuevo o la dirección nueva, debajo y sin comillas: no lo
        // dijo nadie, es un dato. Igual que en la app.
        if (f.tipo === 'lugar_renombrado' || f.tipo === 'lugar_datos') {
          const detalle = C.detalle(item);
          if (detalle) {
            const d = document.createElement('span');
            d.className = 'historial-detalle';
            d.textContent = detalle;
            li.appendChild(d);
          }
        }
        lista.appendChild(li);
      });
      seccion.hidden = false;
    }).catch(function () {});
  }

  function pintar(p) {
    pintarDistancia(p);
    const nombre = document.getElementById('nombre');
    nombre.textContent = p.nombre;
    pintarFotoSitio(p);
    nombre.classList.remove('cargando');
    // Una página generada ya trae su título, más completo que este.
    if (!claveFija) document.title = p.nombre + ' — SeviTime';
    paraBuscadores(p);

    // «Ver más reseñas» se conecta una sola vez, no en cada recarga de la
    // sección: si no, un clic pediría tres tandas a la vez.
    document.getElementById('resenas-mas').addEventListener('click', function () {
      cargarResenas().catch(function () {
        document.getElementById('resenas-mas').disabled = false;
      });
    });

    // La sección se puede repintar entera: la usa `lugar/resena.js` cuando
    // alguien entra, deja su reseña o la borra, y hace falta volver a
    // preguntar con su token para saber qué es suyo.
    window.SeviFicha = {
      recargarOpiniones: function () {
        return leerToken().then(function (t) {
          tokenActual = t;
          return pintarOpiniones();
        });
      },
    };

    pintarOpiniones();
    pintarExtras(p);
    pintarEventos(p);
    pintarHistorial(p);

    // Valorar y reseñar. Va justo debajo de lo que dice la gente y encima de
    // los botones del final: primero se lee y después se opina.
    if (window.SeviResena) {
      window.SeviResena.iniciar({
        clave: clave,
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
        tipo: p.tipo,
        label: p.label,
        osmType: p.osmType,
        osmId: p.osmId,
      }, document.getElementById('hueco-tu-resena'));
    }

    // «¿Está abierto?»: lo mismo que la app, en la misma tabla.
    if (window.SeviAbierto) {
      window.SeviAbierto.iniciar({
        clave: clave,
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
        tipo: p.tipo,
      }, document.getElementById('hueco-abierto'));
    }

    // Guardar: las mismas tres cosas que la app, y en las mismas tablas.
    if (window.SeviGuardar) {
      window.SeviGuardar.iniciar({
        clave: clave,
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
        tipo: p.tipo,
        telefono: p.telefono,
        web: p.web,
        horario: p.horario,
        direccion: p.direccion,
        osmType: p.osmType,
        osmId: p.osmId,
      }, document.getElementById('hueco-guardar'));
    }

    // «Quedar aquí»: manda un enlace con ESTE sitio, no con tu ubicación.
    if (window.SeviQuedar) {
      window.SeviQuedar.iniciar({
        clave: clave,
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
      }, document.getElementById('hueco-quedar'));
    }

    // El Pasaporte: si este sitio da un sello, el botón para conseguirlo.
    if (window.SeviSellar) {
      window.SeviSellar.iniciar({
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
        tipo: p.tipo,
      }, document.getElementById('hueco-sellar'));
    }
    document.getElementById('emoji').textContent = p.emoji || '📍';
    document.getElementById('tipo').textContent = p.label || '';

    const datos = document.getElementById('datos');
    // Las páginas generadas traen estas filas ya escritas: se rehacen aquí
    // con los enlaces y con lo que haya cambiado desde que se generaron.
    datos.textContent = '';
    // La dirección, como en la ficha de la app: calle y número según
    // OpenStreetMap. Sin calle no se pone nada (ver `direccionDe`).
    if (p.direccion) datos.appendChild(fila('Dirección', p.direccion));
    if (p.telefono) datos.appendChild(fila('Teléfono', p.telefono, 'tel:' + p.telefono));
    if (p.web) datos.appendChild(fila('Web', p.web, p.web));
    // El horario se enseña como lo que es: lo que dice OpenStreetMap, no lo
    // que pasa en la puerta. Es la misma cautela que la app.
    if (p.horario) datos.appendChild(fila('Horario', window.sevitimeLugares.horarioLegible(p.horario) +
      (p.horarioPropio ? ' (aportado a SeviTime)' : ' (según OpenStreetMap)')));
    if (p.osm) datos.appendChild(fila('En OpenStreetMap', 'Ver el elemento', p.osm));

    // El botón intenta abrir la app y, si no pasa nada, se va a Play.
    //
    // El formato es el que la app YA entiende: `sevitime://place/<nombre>`
    // (`EnlaceEntrante._desdeEsquema`). Decía `lugar/` desde el 29-sep-2026
    // y la app NO lo reconoce: abría la portada en vez del sitio. Salió el
    // 18-oct-2026 probando el punto de encuentro en el móvil.
    // Por eso esto funciona con la 1.0.20
    // que la gente tiene instalada, sin esperar a una versión nueva.
    //
    // Busca por nombre, que es su punto débil: en el centro hay 45
    // «Caixabank» y la app abrirá el primero que encuentre. Para un enlace
    // compartido de un bar con nombre propio acierta; lo que lo arreglaría
    // del todo es que la app acepte también la clave de coordenadas, y eso
    // sí pide versión nueva.
    const app = 'sevitime://place/' + encodeURIComponent(p.nombre);
    const cta = document.getElementById('cta');
    cta.href = app;
    cta.addEventListener('click', function (e) {
      e.preventDefault();
      // Si la app abre, el navegador pasa a segundo plano y el temporizador
      // no llega a disparar: `document.hidden` es la señal.
      const empezo = Date.now();
      const aPlay = setTimeout(function () {
        if (document.hidden || Date.now() - empezo > 2500) return;
        location.href = PLAY;
      }, 1200);
      window.addEventListener('pagehide', function () { clearTimeout(aPlay); },
        { once: true });
      location.href = app;
    });
    document.getElementById('cta-pie').textContent =
      '¿No la tienes? Se descarga gratis en Google Play.';

    const corregir = document.getElementById('corregir');
    corregir.href = '/mapa/?modo=corregir&k=' + encodeURIComponent(clave);
    corregir.hidden = false;
  }

  window.addEventListener('load', function () {
    pintarMapa();
    if (!window.sevitimeLugares) { noEncontrado(); return; }
    window.sevitimeLugares.cargar().then(function (lugares) {
      const p = lugares.find(function (x) {
        return window.sevitimeLugares.claveDe(x.lat, x.lon) === clave;
      });
      if (p) { pintar(p); return; }
      // La foto es de la madrugada: un sitio que acaba de aparecer en OSM
      // puede no estar. Se pregunta a Overpass una vez antes de dar el enlace
      // por roto, igual que hace la app.
      return window.sevitimeLugares.buscarPorClave(clave).then(function (nuevo) {
        if (nuevo) pintar(nuevo); else noEncontrado();
      });
    }).catch(noEncontrado);
  });
})();
