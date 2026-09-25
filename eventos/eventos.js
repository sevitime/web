// Agenda de eventos de Sevilla en el navegador.
//
// Los eventos NO se piden a cada fuente: se leen de la «foto diaria» que
// prepara tool/snapshot_eventos.mjs en el repositorio de la app y guarda en
// Storage. El navegador no puede llamar a sevilla.org ni a los RSS por CORS,
// así que esa agregación se hace en el servidor una vez al día.
(function () {
  'use strict';

  const SNAPSHOT_URL =
    'https://kdqiwhvtovafugpcrumf.supabase.co/storage/v1/object/public/snapshots/eventos-sevilla.json';

  const CUANDO = [
    { id: 'todo', etiqueta: 'Todo' },
    { id: '7', etiqueta: 'Próximos 7 días' },
    { id: '30', etiqueta: 'Este mes' },
    { id: '90', etiqueta: 'Próximos 3 meses' },
  ];

  const estado = { eventos: [], cuando: 'todo', categoria: 'todas' };

  const chipsCuando = document.getElementById('chips-cuando');
  const chipsCat = document.getElementById('chips-cat');
  const cuenta = document.getElementById('cuenta');
  const lista = document.getElementById('lista');

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function mismoDia(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // "12 oct" o "12–15 oct" o "28 oct – 3 nov", con la hora si el evento es de
  // un solo día con hora.
  function rango(e) {
    const inicio = new Date(e.inicio);
    const fin = e.fin ? new Date(e.fin) : null;
    const hora = inicio.getHours() || inicio.getMinutes()
      ? inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : '';
    if (!fin || mismoDia(inicio, fin)) {
      return inicio.getDate() + ' ' + MESES_CORTOS[inicio.getMonth()] + (hora ? ' · ' + hora : '');
    }
    if (inicio.getMonth() === fin.getMonth()) {
      return inicio.getDate() + '–' + fin.getDate() + ' ' + MESES_CORTOS[inicio.getMonth()];
    }
    return inicio.getDate() + ' ' + MESES_CORTOS[inicio.getMonth()] + ' – ' + fin.getDate() + ' ' + MESES_CORTOS[fin.getMonth()];
  }

  function claveMes(e) {
    const d = new Date(e.inicio);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function tituloMes(clave) {
    const [anio, mes] = clave.split('-').map(Number);
    const nombre = MESES[mes - 1];
    return nombre.charAt(0).toUpperCase() + nombre.slice(1) + ' ' + anio;
  }

  function enRango(e, dias) {
    const inicio = new Date(e.inicio);
    const limite = new Date();
    limite.setHours(23, 59, 59, 999);
    limite.setDate(limite.getDate() + dias);
    return inicio <= limite;
  }

  function filtrar() {
    let r = estado.eventos;
    if (estado.cuando !== 'todo') r = r.filter((e) => enRango(e, Number(estado.cuando)));
    if (estado.categoria !== 'todas') r = r.filter((e) => (e.categoria || 'Otros') === estado.categoria);
    return r;
  }

  function pintar() {
    const r = filtrar();
    cuenta.textContent = r.length === 0
      ? 'No hay eventos con esos filtros.'
      : r.length.toLocaleString('es-ES') + (r.length === 1 ? ' evento' : ' eventos');

    lista.textContent = '';
    if (!r.length) {
      const vacio = document.createElement('p');
      vacio.className = 'vacio';
      vacio.textContent = 'Prueba con otro filtro.';
      lista.appendChild(vacio);
      return;
    }

    let mesActual = null;
    let rejilla = null;
    for (const e of r) {
      const clave = claveMes(e);
      if (clave !== mesActual) {
        mesActual = clave;
        const h = document.createElement('h2');
        h.className = 'mes';
        h.textContent = tituloMes(clave);
        lista.appendChild(h);
        rejilla = document.createElement('div');
        rejilla.className = 'rejilla';
        lista.appendChild(rejilla);
      }
      rejilla.appendChild(ficha(e));
    }
  }

  function ficha(e) {
    const art = document.createElement('article');
    art.className = 'evento';

    // Abre la ficha (quién va, comentarios y el enlace de entradas), no la
    // web de la fuente: el enlace externo está dentro. Ver comunidad.js.
    const enlace = document.createElement('button');
    enlace.type = 'button';
    enlace.className = 'evento-enlace';
    enlace.setAttribute('aria-haspopup', 'dialog');
    enlace.addEventListener('click', () => window.SeviComunidad.abrir(e));

    const img = e.imagenCard || e.imagen;
    if (img) {
      const im = document.createElement('img');
      im.className = 'evento-img';
      im.loading = 'lazy';
      im.src = img;
      im.alt = '';
      im.addEventListener('error', () => {
        const caja = document.createElement('div');
        caja.className = 'evento-img-vacia';
        caja.textContent = e.icono || '🎭';
        im.replaceWith(caja);
      });
      enlace.appendChild(im);
    } else {
      const caja = document.createElement('div');
      caja.className = 'evento-img-vacia';
      caja.textContent = e.icono || '🎭';
      enlace.appendChild(caja);
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'evento-cuerpo';

    const fecha = document.createElement('div');
    fecha.className = 'evento-fecha';
    fecha.textContent = rango(e);

    const nombre = document.createElement('h3');
    nombre.className = 'evento-nombre';
    nombre.textContent = e.nombre;

    const lugar = document.createElement('p');
    lugar.className = 'evento-lugar';
    lugar.textContent = e.lugar || 'Sevilla';

    const desc = document.createElement('p');
    desc.className = 'evento-desc';
    desc.textContent = e.descripcion || '';

    const cat = document.createElement('span');
    cat.className = 'evento-cat';
    cat.textContent = (e.icono ? e.icono + ' ' : '') + (e.categoria || 'Otros');

    cuerpo.append(fecha, nombre, lugar);
    if (e.descripcion) cuerpo.appendChild(desc);
    cuerpo.appendChild(cat);
    enlace.appendChild(cuerpo);
    art.appendChild(enlace);
    return art;
  }

  function pintarChips(contenedor, opciones, valorActual, alElegir) {
    contenedor.textContent = '';
    opciones.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (o.id === valorActual ? ' seleccionado' : '');
      b.dataset.id = o.id;
      b.textContent = o.etiqueta;
      b.addEventListener('click', () => {
        contenedor.querySelectorAll('.chip').forEach((c) => c.classList.toggle('seleccionado', c.dataset.id === o.id));
        alElegir(o.id);
      });
      contenedor.appendChild(b);
    });
  }

  function categorias() {
    const cuenta = new Map();
    for (const e of estado.eventos) {
      const c = e.categoria || 'Otros';
      cuenta.set(c, (cuenta.get(c) || 0) + 1);
    }
    return [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => ({ id: c, etiqueta: c }));
  }

  function montarFiltros() {
    pintarChips(chipsCuando, CUANDO, estado.cuando, (id) => { estado.cuando = id; pintar(); });
    const cats = [{ id: 'todas', etiqueta: 'Todas' }, ...categorias()];
    pintarChips(chipsCat, cats, estado.categoria, (id) => { estado.categoria = id; pintar(); });
  }

  fetch(SNAPSHOT_URL)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !Array.isArray(d.events)) {
        cuenta.textContent = 'La agenda se actualiza cada madrugada. Vuelve en un rato.';
        return;
      }
      const ahora = Date.now();
      estado.eventos = d.events
        .filter((e) => e.inicio && new Date(e.inicio).getTime() > ahora - 3600 * 1000)
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
      montarFiltros();
      pintar();
      window.SeviComunidad.conEventos(estado.eventos);
    })
    .catch(() => {
      cuenta.textContent = 'No se pudieron cargar los eventos. Recarga en un momento.';
    });
})();
