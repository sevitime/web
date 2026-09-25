// Ficha de un evento (quién va y comentarios) y formulario para proponer
// uno. Lo mismo que hace la app en EventoComunidadSection y
// ProponerEventoScreen, contra las mismas funciones de Supabase
// (docs/sql/eventos_comunidad.sql en el repo de la app).
//
// - Ir es privado por defecto: el apodo solo sale si se activa en ESE evento.
//   Ir a según qué evento dice cosas que el RGPD protege aparte (art. 9).
// - Los comentarios pasan todos por moderación antes de verse; se moderan en
//   el panel de administrador de la app.
// - Todo el texto de usuarios se pinta con textContent, nunca como HTML.
(function () {
  'use strict';

  const { claveEvento, instanteDesdeMadrid } = window.SeviClave;
  const RECORDAR = 'sevi-evento-abierto';

  const sb = () => window.SEVI && window.SEVI.sb;
  let usuario = null;
  let miApodo = null;

  // --- Utilidades -----------------------------------------------------------

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function fechaCorta(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' });
  }

  function fechaLarga(e) {
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' };
    const inicio = new Date(e.inicio);
    let s = inicio.toLocaleDateString('es-ES', opciones);
    const hora = inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    if (hora !== '00:00') s += ' · ' + hora;
    if (e.fin) {
      const fin = new Date(e.fin);
      if (fin.toDateString() !== inicio.toDateString()) s += ' – ' + fin.toLocaleDateString('es-ES', opciones);
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function yaPaso(e) {
    const fin = e.fin ? new Date(e.fin) : new Date(new Date(e.inicio).getTime() + 86400000);
    return Date.now() > fin.getTime();
  }

  // Entra con Google y, al volver, reabre este evento.
  function entrar(clave) {
    try { if (clave) sessionStorage.setItem(RECORDAR, clave); } catch (_) { /* sin almacenamiento */ }
    sb().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  }

  async function cargarMiApodo() {
    miApodo = null;
    if (!usuario) return;
    try {
      const { data } = await sb().rpc('fn_mi_perfil');
      miApodo = (data && data[0] && data[0].nombre_publico) || null;
    } catch (_) { /* sin apodo */ }
  }

  // --- Ficha del evento -----------------------------------------------------

  const dlg = document.getElementById('ficha');
  const cuerpo = document.getElementById('ficha-cuerpo');
  let abierto = null;

  document.getElementById('ficha-cerrar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { abierto = null; });

  function abrir(e) {
    abierto = e;
    pintarFicha(e);
    if (!dlg.open) dlg.showModal();
  }

  function pintarFicha(e) {
    cuerpo.textContent = '';

    const img = e.imagenCard || e.imagen;
    if (img) {
      const im = el('img', 'ficha-img');
      im.src = img;
      im.alt = '';
      im.addEventListener('error', () => im.remove());
      cuerpo.appendChild(im);
    }

    const cab = el('div', 'ficha-cab');
    cab.appendChild(el('div', 'evento-fecha', fechaLarga(e)));
    const h = el('h2', 'ficha-titulo', e.nombre);
    h.id = 'ficha-titulo';
    cab.appendChild(h);
    cab.appendChild(el('p', 'evento-lugar', e.lugar || 'Sevilla'));
    if (e.descripcion) cab.appendChild(el('p', 'ficha-desc', e.descripcion));
    if (e.url) {
      const a = el('a', 'boton-primario', ['Concierto', 'Festival', 'Espectáculo', 'Música'].includes(e.categoria) ? 'Entradas' : 'Más información');
      a.href = e.url;
      a.target = '_blank';
      a.rel = 'noopener';
      cab.appendChild(a);
    }
    cuerpo.appendChild(cab);

    const asis = el('section', 'ficha-seccion');
    asis.appendChild(el('h3', null, '¿Quién va?'));
    const asisCuerpo = el('div', null, 'Cargando…');
    asis.appendChild(asisCuerpo);
    cuerpo.appendChild(asis);

    const com = el('section', 'ficha-seccion');
    com.appendChild(el('h3', null, 'Comentarios'));
    const comLista = el('div', null, 'Cargando…');
    com.appendChild(comLista);
    const comForm = el('div');
    com.appendChild(comForm);
    cuerpo.appendChild(com);

    cargarAsistencia(e, asisCuerpo);
    cargarComentarios(e, comLista);
    pintarFormComentario(e, comForm, comLista);
  }

  async function cargarAsistencia(e, caja) {
    const clave = claveEvento(e);
    let a = { total: 0, voy: false, publico_mio: false, visibles: [] };
    try {
      const { data, error } = await sb().rpc('fn_evento_asistencia', { p_clave: clave });
      if (!error && data) a = data;
    } catch (_) { /* se queda en cero */ }
    if (abierto !== e) return;
    caja.textContent = '';

    const pasado = yaPaso(e);
    const n = a.total || 0;
    const resumen = n === 0
      ? (pasado ? 'Nadie dijo que iba.' : 'Aún no se ha apuntado nadie.')
      : pasado
        ? (n === 1 ? 'Fue 1 persona.' : 'Fueron ' + n + ' personas.')
        : (n === 1 ? 'Va 1 persona.' : 'Van ' + n + ' personas.');
    caja.appendChild(el('p', 'ficha-apagado', resumen));

    const visibles = a.visibles || [];
    if (visibles.length) {
      const fila = el('div', 'personas');
      visibles.forEach((v) => {
        const p = el('span', 'persona');
        const av = el('span', 'persona-avatar');
        if (v.avatar) {
          const im = el('img');
          im.src = v.avatar;
          im.alt = '';
          av.appendChild(im);
        } else {
          av.textContent = (v.nombre_publico || '?').charAt(0).toUpperCase();
        }
        p.appendChild(av);
        p.appendChild(el('span', null, v.nombre_publico));
        fila.appendChild(p);
      });
      const resto = n - visibles.length;
      if (resto > 0) fila.appendChild(el('span', 'persona persona-mas', '+' + resto + ' más'));
      caja.appendChild(fila);
    }

    if (pasado) return;

    const boton = el('button', a.voy ? 'boton-secundario' : 'boton-primario', a.voy ? '✓ Voy · Desapuntarme' : 'Voy');
    boton.type = 'button';
    boton.addEventListener('click', async () => {
      if (!usuario) { entrar(clave); return; }
      boton.disabled = true;
      await asistir(e, !a.voy, false);
      cargarAsistencia(e, caja);
    });
    caja.appendChild(boton);

    if (a.voy) {
      const et = el('label', 'interruptor');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = !!a.publico_mio;
      cb.addEventListener('change', async () => {
        cb.disabled = true;
        await asistir(e, true, cb.checked);
        cargarAsistencia(e, caja);
      });
      et.appendChild(cb);
      const txt = el('span');
      txt.appendChild(el('strong', null, 'Que se vea mi apodo en este evento'));
      txt.appendChild(el('small', null, miApodo
        ? 'Saldrá como «' + miApodo + '». Si no, solo cuentas en el total y nadie sabe que eres tú.'
        : 'Aún no tienes apodo: elígelo en la app de SeviTime para poder aparecer.'));
      et.appendChild(txt);
      caja.appendChild(et);
    }
  }

  async function asistir(e, voy, publico) {
    try {
      const { error } = await sb().rpc('fn_evento_asistir', {
        p_clave: claveEvento(e), p_nombre: e.nombre, p_lugar: e.lugar || null,
        p_inicio: new Date(e.inicio).toISOString(), p_voy: voy, p_publico: publico,
      });
      if (error) throw error;
    } catch (_) {
      alertaSuave('No se ha podido guardar. Inténtalo de nuevo.');
    }
  }

  async function cargarComentarios(e, caja) {
    let filas = [];
    try {
      const { data, error } = await sb().rpc('fn_evento_comentarios', { p_clave: claveEvento(e) });
      if (!error && data) filas = data;
    } catch (_) { /* sin comentarios */ }
    if (abierto !== e) return;
    caja.textContent = '';
    if (!filas.length) {
      caja.appendChild(el('p', 'ficha-apagado', 'Todavía no hay comentarios.'));
      return;
    }
    filas.forEach((c) => {
      const art = el('article', 'comentario');
      const meta = el('div', 'comentario-meta', (c.nombre_publico || 'Usuario de SeviTime') + ' · ' + fechaCorta(c.created_at));
      art.appendChild(meta);
      art.appendChild(el('p', null, c.texto));
      if (c.es_mio) {
        const borrar = el('button', 'enlace-discreto', 'Borrar');
        borrar.type = 'button';
        borrar.addEventListener('click', async () => {
          if (!window.confirm('¿Borrar tu comentario? No se puede recuperar.')) return;
          const { error } = await sb().from('evento_comentarios').delete().eq('id', c.id);
          if (error) alertaSuave('No se ha podido borrar.');
          else art.remove();
        });
        art.appendChild(borrar);
      }
      caja.appendChild(art);
    });
  }

  async function pintarFormComentario(e, caja, lista) {
    caja.textContent = '';
    if (!usuario) {
      const b = el('button', 'boton-secundario', 'Inicia sesión para comentar o decir que vas');
      b.type = 'button';
      b.addEventListener('click', () => entrar(claveEvento(e)));
      caja.appendChild(b);
      return;
    }

    const aviso = el('p', 'ficha-apagado');
    try {
      const { data } = await sb().from('evento_comentarios')
        .select('id, evento_ref!inner(clave)')
        .eq('user_id', usuario.id).eq('estado', 'pendiente')
        .eq('evento_ref.clave', claveEvento(e));
      const n = (data || []).length;
      if (n) aviso.textContent = n === 1 ? '⏳ Tienes 1 comentario esperando revisión.' : '⏳ Tienes ' + n + ' comentarios esperando revisión.';
    } catch (_) { /* nada que avisar */ }

    const area = el('textarea');
    area.maxLength = 1000;
    area.rows = 3;
    area.placeholder = '¿Vas? ¿Qué tal la última vez? Cuéntalo';
    area.setAttribute('aria-label', 'Escribe un comentario');
    const enviar = el('button', 'boton-primario', 'Enviar');
    enviar.type = 'button';
    enviar.addEventListener('click', async () => {
      const texto = area.value.trim();
      if (!texto) return;
      enviar.disabled = true;
      let msg = 'Enviado. Se publicará cuando lo revisemos.';
      try {
        const { data, error } = await sb().rpc('fn_evento_comentar', {
          p_clave: claveEvento(e), p_nombre: e.nombre, p_lugar: e.lugar || null,
          p_inicio: new Date(e.inicio).toISOString(), p_texto: texto,
        });
        if (error) throw error;
        if (data && data.error === 'tope diario') msg = 'Has llegado al máximo de comentarios de hoy. Vuelve mañana.';
        else area.value = '';
      } catch (_) {
        msg = 'No se ha podido enviar. Inténtalo de nuevo.';
      }
      enviar.disabled = false;
      alertaSuave(msg);
      pintarFormComentario(e, caja, lista);
    });

    if (aviso.textContent) caja.appendChild(aviso);
    caja.appendChild(area);
    caja.appendChild(enviar);
    caja.appendChild(el('p', 'ficha-nota', 'Los comentarios se revisan antes de publicarse.'));
  }

  // Aviso breve dentro del diálogo abierto (o de la página), sin alert().
  function alertaSuave(texto) {
    const dentro = document.querySelector('dialog[open]');
    const t = el('div', 'tostada', texto);
    t.setAttribute('role', 'status');
    (dentro || document.body).appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // --- Proponer un evento ---------------------------------------------------

  const dlgProp = document.getElementById('proponer');
  const formProp = document.getElementById('proponer-form');
  const msgProp = document.getElementById('proponer-msg');

  document.getElementById('boton-proponer').addEventListener('click', () => {
    if (!usuario) { entrar('proponer'); return; }
    msgProp.textContent = '';
    dlgProp.showModal();
  });
  document.getElementById('proponer-cerrar').addEventListener('click', () => dlgProp.close());
  dlgProp.addEventListener('click', (ev) => { if (ev.target === dlgProp) dlgProp.close(); });

  formProp.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(formProp);
    const dia = String(f.get('dia') || '');
    const hora = String(f.get('hora') || '');
    const horaFin = String(f.get('hora_fin') || '');
    if (!dia || !hora) { msgProp.textContent = 'Falta el día y la hora de inicio.'; return; }
    const [y, m, d] = dia.split('-').map(Number);
    const [hh, mm] = hora.split(':').map(Number);
    const inicio = instanteDesdeMadrid(y, m, d, hh, mm);
    if (inicio.getTime() < Date.now()) { msgProp.textContent = 'Ese evento ya ha empezado.'; return; }
    let fin = null;
    if (horaFin) {
      const [fh, fm] = horaFin.split(':').map(Number);
      fin = instanteDesdeMadrid(y, m, d, fh, fm);
      // Un concierto de 22:00 a 02:00 acaba al día siguiente.
      if (fin <= inicio) fin = new Date(fin.getTime() + 86400000);
    }
    const opcional = (k) => { const v = String(f.get(k) || '').trim(); return v || null; };

    const boton = formProp.querySelector('button[type=submit]');
    boton.disabled = true;
    msgProp.textContent = 'Enviando…';
    const { error } = await sb().from('eventos_solicitados').insert({
      user_id: usuario.id,
      nombre: String(f.get('nombre')).trim(),
      lugar: String(f.get('lugar')).trim(),
      inicio: inicio.toISOString(),
      fin: fin ? fin.toISOString() : null,
      categoria: opcional('categoria'),
      descripcion: opcional('descripcion'),
      url: opcional('url'),
      notas: opcional('notas'),
    });
    boton.disabled = false;
    if (error) {
      const m2 = error.message || '';
      msgProp.textContent = m2.includes('demasiadas solicitudes')
        ? 'Ya tienes 5 propuestas esperando revisión. Espera a que las veamos.'
        : m2.includes('ya ha empezado') ? 'Ese evento ya ha empezado.'
          : 'No se ha podido enviar. Revisa los datos e inténtalo de nuevo.';
      return;
    }
    formProp.reset();
    dlgProp.close();
    alertaSuave('Recibido. Lo revisamos y te avisamos en el buzón de la app.');
  });

  // --- Sesión ---------------------------------------------------------------

  let eventos = [];

  // eventos.js avisa cuando ya tiene la lista, para poder reabrir lo que
  // estaba abierto antes de ir a Google.
  function reabrirTrasLogin() {
    let clave = null;
    try { clave = sessionStorage.getItem(RECORDAR); } catch (_) { /* nada */ }
    if (!clave || !usuario) return;
    try { sessionStorage.removeItem(RECORDAR); } catch (_) { /* nada */ }
    if (clave === 'proponer') { dlgProp.showModal(); return; }
    const e = eventos.find((x) => claveEvento(x) === clave);
    if (e) abrir(e);
  }

  async function alCambiarSesion(user) {
    const cambio = (user && user.id) !== (usuario && usuario.id);
    usuario = user;
    if (!cambio) return;
    await cargarMiApodo();
    if (abierto) pintarFicha(abierto);
    reabrirTrasLogin();
  }

  window.SEVI.onAuth.push(alCambiarSesion);
  // auth.js puede haber resuelto la sesión antes de que este script se
  // apuntara a onAuth: se pregunta también ahora.
  if (sb()) {
    sb().auth.getSession().then((r) => {
      const s = r.data && r.data.session;
      alCambiarSesion(s ? s.user : null);
    });
  }

  window.SeviComunidad = {
    abrir,
    conEventos(lista) { eventos = lista; reabrirTrasLogin(); },
  };
})();
