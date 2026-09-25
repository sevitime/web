// Ficha de un evento (quién va y comentarios) y formulario para proponer
// uno. Lo mismo que hace la app en EventoAccionesPrincipales,
// EventoComentariosSection y ProponerEventoScreen, contra las mismas funciones de Supabase
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
  //
  // Orden (revisado el 25-sep-2026, igual que la app): qué es, cuándo y
  // dónde; justo debajo la decisión —quién va, «Voy» y entradas—; luego la
  // descripción, y al final los comentarios, que es lo único que crece sin
  // límite. Solo «Entradas» va relleno: una acción principal por pantalla.

  // Gemela de urlEsDeEntradas (lib/utils/evento_url.dart en la app): el
  // botón dice «Entradas» solo si el enlace es de una taquilla. Si cambia la
  // lista allí, cámbiala aquí.
  const DOMINIOS_ENTRADAS = ['ticketmaster', 'ticket', 'entrada', 'taquilla', 'eventbrite',
    'wegow', 'giglon', 'feverup', 'dice.fm', 'atrapalo', 'elcorteingles'];
  function urlEsDeEntradas(url) {
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch (_) { return false; }
    return DOMINIOS_ENTRADAS.some((d) => host.includes(d));
  }

  const EN_LA_FICHA = 3;

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

    const accion = el('div', 'accion');
    cab.appendChild(accion);
    cuerpo.appendChild(cab);
    pintarAccion(e, accion, null);
    cargarAsistencia(e, accion);

    if (e.descripcion) {
      const sobre = el('section', 'ficha-seccion');
      sobre.appendChild(el('h3', null, 'Sobre el evento'));
      sobre.appendChild(el('p', 'ficha-desc', e.descripcion));
      cuerpo.appendChild(sobre);
    }

    const com = el('section', 'ficha-seccion');
    const tit = el('h3', null, 'Comentarios');
    com.appendChild(tit);
    const lista = el('div');
    com.appendChild(lista);
    const form = el('div');
    com.appendChild(form);
    cuerpo.appendChild(com);
    cargarComentarios(e, tit, lista);
    pintarFormComentario(e, form);
  }

  function resumenAsistencia(e, a) {
    const n = a.total || 0;
    if (yaPaso(e)) return n === 0 ? 'Nadie dijo que iba' : n === 1 ? 'Fue 1 persona' : 'Fueron ' + n + ' personas';
    if (n === 0) return 'Sé la primera persona en apuntarte';
    if (a.voy) return n === 1 ? 'Vas tú' : n === 2 ? 'Vas tú y 1 persona más' : 'Vas tú y ' + (n - 1) + ' personas más';
    return n === 1 ? 'Va 1 persona' : 'Van ' + n + ' personas';
  }

  function avatar(v) {
    const av = el('span', 'persona-avatar');
    if (v.avatar) {
      const im = el('img');
      im.src = v.avatar;
      im.alt = '';
      av.appendChild(im);
    } else {
      av.textContent = (v.nombre_publico || '?').charAt(0).toUpperCase();
    }
    return av;
  }

  // La tarjeta de acción. `a` es null mientras carga.
  function pintarAccion(e, caja, a) {
    caja.textContent = '';
    const clave = claveEvento(e);
    const puedeIr = !yaPaso(e);
    const hayUrl = !!e.url;
    const est = a || { total: 0, voy: false, publico_mio: false, visibles: [] };
    const visibles = est.visibles || [];

    // Quién va
    const fila = el(visibles.length ? 'button' : 'div', 'accion-quien');
    if (visibles.length) {
      fila.type = 'button';
      fila.setAttribute('aria-expanded', 'false');
      const pila = el('span', 'avatares');
      visibles.slice(0, 4).forEach((v) => pila.appendChild(avatar(v)));
      fila.appendChild(pila);
    } else {
      fila.appendChild(el('span', 'accion-icono', '👥'));
    }
    fila.appendChild(el('span', 'accion-resumen', a ? resumenAsistencia(e, est) : ' '));
    caja.appendChild(fila);

    if (visibles.length) {
      const nombres = el('div', 'personas');
      nombres.hidden = true;
      visibles.forEach((v) => {
        const p = el('span', 'persona');
        p.appendChild(avatar(v));
        p.appendChild(el('span', null, v.nombre_publico));
        nombres.appendChild(p);
      });
      nombres.appendChild(el('small', 'ficha-nota', 'Solo salen quienes han elegido que se vea su apodo en este evento.'));
      fila.addEventListener('click', () => {
        nombres.hidden = !nombres.hidden;
        fila.setAttribute('aria-expanded', String(!nombres.hidden));
      });
      caja.appendChild(nombres);
    }

    // Botones: «Voy» tonal y el enlace relleno. Sin enlace, «Voy» es la
    // única acción y va relleno.
    const botones = el('div', 'accion-botones');
    if (puedeIr) {
      const voy = el('button', hayUrl || est.voy ? 'boton-tonal' : 'boton-primario', (est.voy ? '✓ ' : '') + 'Voy');
      voy.type = 'button';
      voy.setAttribute('aria-pressed', String(!!est.voy));
      if (est.voy) voy.classList.add('marcado');
      voy.disabled = !a;
      voy.addEventListener('click', async () => {
        if (!usuario) { entrar(clave); return; }
        voy.disabled = true;
        await asistir(e, !est.voy, false);
        cargarAsistencia(e, caja);
      });
      botones.appendChild(voy);
    }
    if (hayUrl) {
      const entradas = urlEsDeEntradas(e.url);
      const link = el('a', 'boton-primario',
        entradas ? 'Entradas' : (puedeIr ? 'Más info' : 'Más información'));
      link.href = e.url;
      link.target = '_blank';
      link.rel = 'noopener';
      botones.appendChild(link);
    }
    if (botones.childNodes.length === 1) botones.classList.add('uno');
    if (botones.childNodes.length) caja.appendChild(botones);

    if (puedeIr && est.voy) {
      const et = el('label', 'interruptor');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = !!est.publico_mio;
      cb.addEventListener('change', async () => {
        cb.disabled = true;
        await asistir(e, true, cb.checked);
        cargarAsistencia(e, caja);
      });
      et.appendChild(cb);
      const txt = el('span');
      txt.appendChild(el('strong', null, 'Que se vea mi apodo en este evento'));
      txt.appendChild(el('small', null, miApodo
        ? 'Saldrá como «' + miApodo + '». Si no, solo cuentas en el total.'
        : 'Aún no tienes apodo: elígelo en la app de SeviTime para poder aparecer.'));
      et.appendChild(txt);
      caja.appendChild(et);
    }
  }

  async function cargarAsistencia(e, caja) {
    let a = { total: 0, voy: false, publico_mio: false, visibles: [] };
    try {
      const { data, error } = await sb().rpc('fn_evento_asistencia', { p_clave: claveEvento(e) });
      if (!error && data) a = data;
    } catch (_) { /* se queda en cero */ }
    if (abierto !== e) return;
    pintarAccion(e, caja, a);
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

  function tarjetaComentario(c) {
    const art = el('article', 'comentario');
    art.appendChild(el('div', 'comentario-meta', (c.nombre_publico || 'Usuario de SeviTime') + ' · ' + fechaCorta(c.created_at)));
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
    return art;
  }

  async function cargarComentarios(e, titulo, caja) {
    let filas = [];
    try {
      const { data, error } = await sb().rpc('fn_evento_comentarios', { p_clave: claveEvento(e) });
      if (!error && data) filas = data;
    } catch (_) { /* sin comentarios */ }
    if (abierto !== e) return;
    caja.textContent = '';
    if (filas.length) titulo.appendChild(el('span', 'ficha-cuenta', ' ' + filas.length));
    if (!filas.length) {
      caja.appendChild(el('p', 'ficha-apagado', '¿Vas a ir o ya has estado? Cuenta qué tal.'));
      return;
    }
    // En la ficha, los más recientes primero; «Ver todos» los pone en orden.
    const pintar = (todos) => {
      caja.textContent = '';
      const lista = todos ? filas : filas.slice(-EN_LA_FICHA).reverse();
      lista.forEach((c) => caja.appendChild(tarjetaComentario(c)));
      if (!todos && filas.length > EN_LA_FICHA) {
        const mas = el('button', 'enlace-discreto', 'Ver los ' + filas.length + ' comentarios');
        mas.type = 'button';
        mas.addEventListener('click', () => pintar(true));
        caja.appendChild(mas);
      }
    };
    pintar(false);
  }

  async function pintarFormComentario(e, caja) {
    caja.textContent = '';
    if (!usuario) {
      const b = el('button', 'boton-secundario ancho', 'Inicia sesión para comentar');
      b.type = 'button';
      b.addEventListener('click', () => entrar(claveEvento(e)));
      caja.appendChild(b);
      return;
    }

    try {
      const { data } = await sb().from('evento_comentarios')
        .select('id, evento_ref!inner(clave)')
        .eq('user_id', usuario.id).eq('estado', 'pendiente')
        .eq('evento_ref.clave', claveEvento(e));
      const n = (data || []).length;
      if (n) caja.appendChild(el('p', 'ficha-apagado', n === 1 ? '⏳ Tienes 1 comentario esperando revisión.' : '⏳ Tienes ' + n + ' comentarios esperando revisión.'));
    } catch (_) { /* nada que avisar */ }

    // El campo no se abre hasta que se pide: con él siempre abierto, la
    // ficha parecía un formulario.
    const abrirForm = el('button', 'boton-secundario ancho', 'Escribir un comentario');
    abrirForm.type = 'button';
    const form = el('div', 'comentar');
    form.hidden = true;
    const area = el('textarea');
    area.maxLength = 1000;
    area.rows = 3;
    area.placeholder = 'Escribe tu comentario';
    area.setAttribute('aria-label', 'Escribe un comentario');
    const enviar = el('button', 'boton-primario', 'Enviar');
    enviar.type = 'button';
    form.appendChild(area);
    form.appendChild(enviar);
    form.appendChild(el('p', 'ficha-nota', 'Los comentarios se revisan antes de publicarse.'));
    abrirForm.addEventListener('click', () => {
      abrirForm.hidden = true;
      form.hidden = false;
      area.focus();
    });
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
      } catch (_) {
        msg = 'No se ha podido enviar. Inténtalo de nuevo.';
      }
      enviar.disabled = false;
      alertaSuave(msg);
      pintarFormComentario(e, caja);
    });
    caja.appendChild(abrirForm);
    caja.appendChild(form);
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

    // La foto, si la hay, primero: si no sube, la propuesta va igual (el
    // evento vale sin cartel) pero se dice. Mismo criterio que la app
    // (envio_con_foto.dart).
    const archivo = f.get('foto');
    let rutaFoto = null;
    let fotoUrl = null;
    let fotoFallo = false;
    if (archivo && archivo.size) {
      try {
        const jpeg = await reducirFoto(archivo);
        rutaFoto = usuario.id + '/' + Date.now() + '.jpg';
        const { error: errSubida } = await sb().storage.from('sugerencias-fotos')
          .upload(rutaFoto, jpeg, { contentType: 'image/jpeg' });
        if (errSubida) throw errSubida;
        fotoUrl = sb().storage.from('sugerencias-fotos').getPublicUrl(rutaFoto).data.publicUrl;
      } catch (_) {
        rutaFoto = null;
        fotoFallo = true;
      }
    }

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
      foto_url: fotoUrl,
    });
    boton.disabled = false;
    if (error) {
      // La foto subió pero la propuesta no entró: que no quede suelta.
      if (rutaFoto) sb().storage.from('sugerencias-fotos').remove([rutaFoto]);
      const m2 = error.message || '';
      msgProp.textContent = m2.includes('demasiadas solicitudes')
        ? 'Ya tienes 5 propuestas esperando revisión. Espera a que las veamos.'
        : m2.includes('ya ha empezado') ? 'Ese evento ya ha empezado.'
          : 'No se ha podido enviar. Revisa los datos e inténtalo de nuevo.';
      return;
    }
    formProp.reset();
    dlgProp.close();
    alertaSuave(fotoFallo
      ? 'Recibido, pero la foto no se ha podido subir. Lo revisamos y te avisamos en el buzón de la app.'
      : 'Recibido. Lo revisamos y te avisamos en el buzón de la app.');
  });

  // Como la app (elegirFotoDeAportacion): 1600 px de lado y JPEG al 80 %.
  // El bucket admite 5 MB por archivo y no da para fotos de móvil enteras.
  async function reducirFoto(archivo) {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext('2d').drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();
    return await new Promise((ok, mal) =>
      lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('sin imagen'))), 'image/jpeg', 0.8));
  }

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
