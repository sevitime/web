// Explorar en la web: los sitios que tienes cerca, como en la app.
//
// Hasta el 1-nov-2026 `/explorar/` era una redirección a `/mapa/`, que es un
// editor del mapa, no una lista. Quien entra desde un iPhone —donde no hay
// app— no tenía la pantalla principal de SeviTime en ninguna parte.
//
// Qué hace, y es a propósito el mismo criterio que `HomeScreen` en la app:
//
//   * La ubicación la da el **navegador** (`navigator.geolocation`), solo
//     cuando se pulsa. Nunca se envía a ningún sitio: se usa aquí para medir
//     distancias y ordenar.
//   * Sin ubicación NO se dice «cerca de ti»: se dice que la lista sale del
//     centro de Sevilla y se ordena por valoración, igual que hace la app en
//     escritorio (ver `CercaDeTiHeader`). Llamarlo «cerca» sería mentir.
//   * Los sitios salen de la **foto diaria** (`lugares.js`, la misma que lee
//     la app) con las altas manuales, los ocultos y las fusiones ya
//     aplicadas. No se habla con Overpass.
//   * «Todo» no enseña cajeros ni farmacias (`TIPOS_DE_TODO`), y los filtros
//     son los que se generan desde la app.
//
// Lo que esta página NO hace: mapa (está en `/mapa/`, y cargarlo aquí son
// 600 KB más en datos móviles), «¿está abierto?», guardar ni modo
// explorador. Ver `docs/paridad_app_web.md` en el repo de la app.
(function () {
  'use strict';

  const L = window.sevitimeLugares;

  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  // De cuántos en cuántos crece la lista. La app amplía sola al acercarse al
  // final en vez de obligar a pulsar, y aquí igual.
  const POR_TANDA = 20;

  // Los mismos radios que los chips de la app (`filtros_sheet_content.dart`).
  const RADIOS = [500, 1000, 3000, 5000, 6000];
  const RADIO_POR_DEFECTO = 3000;

  // Hasta dónde se considera que alguien está «en Sevilla». Más lejos, su
  // posición real no sirve para nada: no hay sitios que enseñar.
  const LEJOS = 60000;

  const estado = {
    origen: { lat: L.SEVILLA.lat, lon: L.SEVILLA.lon },
    ubicacionReal: false,
    filtro: 'todo',
    orden: 'valoracion',
    radio: RADIO_POR_DEFECTO,
    texto: '',
    visibles: POR_TANDA,
    sitios: null,
    notas: new Map(),
  };

  const $ = (id) => document.getElementById(id);
  const lista = $('lista');
  const resumen = $('resumen');
  const avisoUbicacion = $('aviso-ubicacion');

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // --- Datos ----------------------------------------------------------------

  // La nota de cada sitio. Son menos de cien filas en toda la base, así que
  // se piden de una vez en lugar de trocear por clave como hace la app (allí
  // la URL del `in.(...)` se pasaba de largo).
  function cargarNotas() {
    return fetch(SUPABASE_URL + '/rest/v1/place_ratings' +
      '?select=place_key,average_rating,vote_count,score&limit=1000', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((filas) => {
        const mapa = new Map();
        (filas || []).forEach((f) => {
          if (!f.place_key) return;
          mapa.set(f.place_key, {
            media: Number(f.average_rating) || 0,
            votos: Number(f.vote_count) || 0,
            // `score` es la media bayesiana que calcula el servidor y con la
            // que la app ordena «Valoración». Nunca se enseña como número.
            score: Number(f.score) || 0,
          });
        });
        return mapa;
      })
      .catch(() => new Map());
  }

  // --- Ubicación ------------------------------------------------------------

  function pedirUbicacion() {
    const boton = $('btn-ubicacion');
    if (!navigator.geolocation) {
      avisar('Tu navegador no sabe darnos tu ubicación. La lista sale del centro de Sevilla.');
      return;
    }
    boton.disabled = true;
    boton.textContent = 'Buscando dónde estás…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const aSevilla = L.metros(punto, L.SEVILLA);
        if (aSevilla > LEJOS) {
          // Está fuera de la provincia: su posición es correcta y aun así no
          // sirve. Decirlo es mejor que enseñar una lista de sitios «a 230
          // km».
          volverAlBoton(boton);
          avisar('Estás a ' + L.formatDist(aSevilla) + ' de Sevilla, y SeviTime ' +
            'solo cubre Sevilla y su provincia. La lista sale del centro de la ciudad.');
          return;
        }
        estado.origen = punto;
        estado.ubicacionReal = true;
        estado.orden = 'distancia';
        estado.visibles = POR_TANDA;
        $('orden').value = 'distancia';
        $('ubicacion-caja').hidden = true;
        avisoUbicacion.hidden = true;
        guardarPermiso();
        pintar();
      },
      (err) => {
        volverAlBoton(boton);
        avisar(err && err.code === 1
          ? 'No nos has dado permiso para saber dónde estás. Puedes dárselo ' +
            'desde el candado de la barra de direcciones; en iPhone, además, ' +
            'en Ajustes → Privacidad → Localización → Safari. Mientras, la ' +
            'lista sale del centro de Sevilla.'
          : 'No hemos podido leer tu ubicación. La lista sale del centro de Sevilla.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function volverAlBoton(boton) {
    boton.disabled = false;
    boton.textContent = 'Ver lo que tengo cerca';
  }

  function avisar(texto) {
    avisoUbicacion.textContent = texto;
    avisoUbicacion.hidden = false;
  }

  // Si ya dio permiso una vez, al volver no hace falta pedírselo con un
  // botón: el navegador no vuelve a preguntar y la lista sale ya centrada
  // donde está. Se guarda aquí, no en el servidor.
  function guardarPermiso() {
    try { localStorage.setItem('sevi-ubicacion-ok', '1'); } catch (_) { /* sin almacenamiento */ }
  }

  function yaDioPermiso() {
    try { return localStorage.getItem('sevi-ubicacion-ok') === '1'; }
    catch (_) { return false; }
  }

  // --- Filtrado y orden -----------------------------------------------------

  function tiposDelFiltro(id) {
    if (id === 'todo') return null;
    const f = (L.FILTROS || []).find((x) => x.id === id);
    return f && f.tipos ? f.tipos : null;
  }

  function entraEnElFiltro(p) {
    const tipos = tiposDelFiltro(estado.filtro);
    if (tipos) return tipos.includes(p.tipo);
    return L.TIPOS_DE_TODO.includes(p.tipo);
  }

  function notaDe(p) {
    return estado.notas.get(L.claveDe(p.lat, p.lon)) || null;
  }

  // Sin votos, la media bayesiana del servidor: cinco votos ficticios de 3,6
  // que hay que superar. Lo mismo que `_notaPonderada` en la app, para que
  // los dos ordenen igual.
  function paraOrdenar(p) {
    const n = notaDe(p);
    return n && n.score ? n.score : 3.6;
  }

  function lista_filtrada() {
    const q = L.normalizar(estado.texto);
    let fuera = estado.sitios.filter(entraEnElFiltro);

    if (q) {
      // Buscando por texto el radio no manda: igual que en la app, quien
      // escribe «alcázar» quiere el Alcázar esté a 300 m o a 3 km.
      fuera = fuera.filter((p) =>
        L.normalizar(p.nombre).includes(q) || L.normalizar(p.direccion).includes(q));
    } else {
      fuera = fuera.filter((p) => L.metros(estado.origen, p) <= estado.radio);
    }

    const conDistancia = fuera.map((p) => ({ p, m: L.metros(estado.origen, p) }));
    if (estado.orden === 'nombre') {
      conDistancia.sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'));
    } else if (estado.orden === 'valoracion') {
      conDistancia.sort((a, b) => paraOrdenar(b.p) - paraOrdenar(a.p) || a.m - b.m);
    } else {
      conDistancia.sort((a, b) => a.m - b.m);
    }
    return conDistancia;
  }

  // --- Pintar ---------------------------------------------------------------

  function estrellas(nota) {
    const n = Math.max(0, Math.min(5, Math.round(nota)));
    const s = el('span', 'estrellas');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', n + ' de 5 estrellas');
    s.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    return s;
  }

  function tarjeta(entrada) {
    const p = entrada.p;
    const li = el('li', 'sitio');
    const a = el('a', 'sitio-enlace');
    a.href = '/lugar/?k=' + encodeURIComponent(L.claveDe(p.lat, p.lon));

    const ico = el('span', 'sitio-ico', p.emoji || '📍');
    ico.setAttribute('aria-hidden', 'true');
    ico.style.background = p.color;
    ico.style.color = L.textoSobre(p.color);
    a.appendChild(ico);

    const txt = el('span', 'sitio-txt');
    txt.appendChild(el('span', 'sitio-nombre', p.nombre));

    const meta = el('span', 'sitio-meta');
    meta.appendChild(el('span', null, p.label || 'Sitio'));
    meta.appendChild(el('span', 'punto', '·'));
    meta.appendChild(el('span', null, L.formatDist(entrada.m)));
    txt.appendChild(meta);

    if (p.direccion) txt.appendChild(el('span', 'sitio-dir', p.direccion));
    a.appendChild(txt);

    const n = notaDe(p);
    if (n && n.votos > 0 && n.media > 0) {
      const caja = el('span', 'sitio-nota');
      caja.appendChild(el('b', null,
        n.media.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
      caja.appendChild(estrellas(n.media));
      caja.appendChild(el('small', null, n.votos === 1 ? '1 voto' : n.votos + ' votos'));
      a.appendChild(caja);
    }

    li.appendChild(a);
    return li;
  }

  function textoDelResumen(total) {
    if (estado.texto) {
      return total === 0
        ? 'Ningún sitio se llama así.'
        : (total === 1 ? '1 sitio' : total.toLocaleString('es-ES') + ' sitios') +
          ' con «' + estado.texto.trim() + '»';
    }
    const cuantos = total === 1 ? '1 sitio' : total.toLocaleString('es-ES') + ' sitios';
    const hasta = estado.radio < 1000
      ? estado.radio + ' m'
      : (estado.radio / 1000) + ' km';
    return estado.ubicacionReal
      ? cuantos + ' a menos de ' + hasta + ' de ti'
      : cuantos + ' a menos de ' + hasta + ' del centro de Sevilla';
  }

  function pintar() {
    if (!estado.sitios) return;
    const todas = lista_filtrada();

    $('titulo-lista').textContent = estado.ubicacionReal
      ? 'Cerca de ti'
      : 'En el centro de Sevilla';
    resumen.textContent = textoDelResumen(todas.length);

    lista.textContent = '';
    lista.removeAttribute('aria-busy');
    todas.slice(0, estado.visibles).forEach((e) => lista.appendChild(tarjeta(e)));

    if (!todas.length) {
      const vacio = el('li', 'vacio');
      vacio.appendChild(el('p', null, estado.texto
        ? 'No hay ningún sitio con ese nombre.'
        : 'Aquí no hay sitios de este tipo. Prueba a ampliar la distancia.'));
      const mapa = el('a', 'vacio-enlace', 'Buscar en el mapa');
      mapa.href = '/mapa/';
      vacio.appendChild(mapa);
      lista.appendChild(vacio);
    }

    const mas = $('btn-mas');
    mas.hidden = todas.length <= estado.visibles;
    mas.textContent = 'Ver más sitios (' + (todas.length - estado.visibles) + ')';
  }

  // --- Controles ------------------------------------------------------------

  function pintarChips() {
    const caja = $('chips');
    (L.FILTROS || []).forEach((f) => {
      const b = el('button', 'chip' + (f.id === estado.filtro ? ' seleccionado' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', f.id === estado.filtro ? 'true' : 'false');
      b.appendChild(el('span', null, f.emoji || ''));
      b.appendChild(el('span', null, f.etiqueta));
      b.addEventListener('click', () => {
        estado.filtro = f.id;
        estado.visibles = POR_TANDA;
        caja.querySelectorAll('.chip').forEach((c) => {
          c.classList.remove('seleccionado');
          c.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('seleccionado');
        b.setAttribute('aria-pressed', 'true');
        pintar();
      });
      caja.appendChild(b);
    });
  }

  function pintarRadios() {
    const sel = $('radio');
    RADIOS.forEach((m) => {
      const o = document.createElement('option');
      o.value = String(m);
      o.textContent = m < 1000 ? m + ' m' : (m / 1000) + ' km';
      if (m === estado.radio) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      estado.radio = Number(sel.value) || RADIO_POR_DEFECTO;
      estado.visibles = POR_TANDA;
      pintar();
    });
  }

  function conectarControles() {
    $('orden').value = estado.orden;
    $('orden').addEventListener('change', (e) => {
      estado.orden = e.target.value;
      estado.visibles = POR_TANDA;
      pintar();
    });

    let espera = null;
    $('buscar').addEventListener('input', (e) => {
      const v = e.target.value;
      clearTimeout(espera);
      // Filtrar 8.900 sitios en cada tecla se nota en un móvil modesto.
      espera = setTimeout(() => {
        estado.texto = v;
        estado.visibles = POR_TANDA;
        pintar();
      }, 180);
    });

    $('btn-ubicacion').addEventListener('click', pedirUbicacion);
    $('btn-mas').addEventListener('click', () => {
      estado.visibles += POR_TANDA;
      pintar();
    });

    // Crece sola al acercarse al final, como la lista de la app. El botón se
    // queda para quien navega con teclado o tiene el scroll desactivado.
    if ('IntersectionObserver' in window) {
      const centinela = $('centinela');
      new IntersectionObserver((entradas) => {
        if (!entradas.some((x) => x.isIntersecting)) return;
        if ($('btn-mas').hidden) return;
        estado.visibles += POR_TANDA;
        pintar();
      }, { rootMargin: '600px 0px' }).observe(centinela);
    }
  }

  // --- Arranque -------------------------------------------------------------

  pintarChips();
  pintarRadios();
  conectarControles();

  // Quien ya dio permiso no tiene que volver a pulsar nada.
  if (yaDioPermiso() && navigator.geolocation) {
    $('ubicacion-caja').hidden = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (L.metros(punto, L.SEVILLA) > LEJOS) return;
        estado.origen = punto;
        estado.ubicacionReal = true;
        estado.orden = 'distancia';
        $('orden').value = 'distancia';
        pintar();
      },
      () => { $('ubicacion-caja').hidden = false; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  Promise.all([L.cargar(), cargarNotas()])
    .then(([sitios, notas]) => {
      estado.sitios = sitios;
      estado.notas = notas;
      pintar();
    })
    .catch(() => {
      lista.textContent = '';
      lista.removeAttribute('aria-busy');
      const vacio = el('li', 'vacio');
      vacio.appendChild(el('p', null,
        'No hemos podido cargar los sitios. Comprueba la conexión y vuelve a intentarlo.'));
      const reintentar = el('button', 'vacio-enlace', 'Volver a intentarlo');
      reintentar.type = 'button';
      reintentar.addEventListener('click', () => location.reload());
      vacio.appendChild(reintentar);
      lista.appendChild(vacio);
      resumen.textContent = '';
    });
})();
