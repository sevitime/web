// Valorar y reseñar un sitio desde la web, con los mismos pasos y las mismas
// reglas que `write_review_sheet.dart` en la app.
//
// Hasta el 1-nov-2026 la ficha de la web solo leía: la nota, las reseñas y un
// pie que decía «ábrelo en SeviTime». En Android eso es un empujón a la app;
// en un iPhone es un callejón sin salida, porque la app no existe. Desde aquí
// se puede valorar, reseñar, cambiar la reseña, borrarla y dar me gusta a las
// de los demás.
//
// Lo que se respeta porque manda el servidor, no esta página:
//
//   * **Hace falta apodo.** Una reseña sin firma no existe, así que si no lo
//     tiene elegido se le pide aquí (`fn_guardar_nombre_publico`, con la
//     comprobación de `fn_comprobar_nombre_publico`). La regla de formato
//     está en `lib/utils/nombre_publico.dart` y en el SQL; aquí solo se
//     avisa mientras escribe.
//   * **Todo pasa por moderación.** La RLS no deja leer una reseña que no
//     esté aprobada (salvo la propia), y editar lo decide
//     `fn_editar_resena`: solo la puntuación se publica al momento.
//   * **Una reseña por persona y sitio** (constraint `(place_key, user_id)`).
//   * **El voto de estrellas se escribe al enviar la reseña**, no al tocar
//     una estrella, igual que en la app desde la 0.0.57.
//
// Las fotos van al bucket público `sugerencias-fotos`, con la misma ruta que
// la app (`uid/marca_indice.jpg`) y reducidas aquí a 1600 px antes de subir:
// una foto de un móvil actual son 4 MB y la app también la reduce.
//
// Texto de usuarios: siempre con `textContent`, nunca como HTML.
(function () {
  'use strict';

  const MAX_FOTOS = 3;
  const MAX_LADO = 1600;
  const MAX_COMENTARIO = 1000;

  // Espejo de `nombrePublicoMinimo`/`nombrePublicoMaximo` y `_formato` en
  // `lib/utils/nombre_publico.dart`. La que manda es la de la base de datos;
  // esta solo evita una consulta por letra.
  const FORMATO_APODO =
    /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ._-]{1,22}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.]$/;

  const sb = () => window.SEVI && window.SEVI.sb;

  let lugar = null;      // { nombre, lat, lon, tipo, label, osmType, osmId }
  let clave = null;
  let usuario = null;
  let apodo = null;
  let mia = null;        // la reseña propia, si la hay
  let seccion = null;
  let fotosSubidas = [];  // URL ya guardadas
  let fotosNuevas = [];   // File elegidos ahora

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // La librería de Supabase (216 KB) no se descarga por venir a leer la
  // ficha: quien llega de un enlace compartido y no entra nunca no la
  // necesita. `auth.js` la trae al pulsar, o sola si ya había sesión
  // guardada en este navegador.
  function conSupabase(fn) {
    if (sb()) { fn(); return; }
    if (window.SEVI && window.SEVI.conSupabase) { window.SEVI.conSupabase(fn); return; }
  }

  function entrar() {
    // Doble seguro para volver al mismo sitio: la clave va en `redirectTo` y
    // además queda guardada. Si la lista de direcciones permitidas de
    // Supabase no aceptara la que lleva `?k=`, el login devolvería a
    // `/lugar/` pelado y la ficha la recupera de aquí.
    try { sessionStorage.setItem('sevi-lugar-abierto', clave); }
    catch (_) { /* sin almacenamiento */ }
    conSupabase(function () {
      // Al volver del login hay que caer en la misma ficha, no en la portada.
      sb().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname + window.location.search,
        },
      });
    });
  }

  // --- Lo que ya hay en el servidor ----------------------------------------

  async function cargarApodo() {
    apodo = null;
    if (!usuario) return;
    try {
      const { data } = await sb().rpc('fn_mi_perfil');
      apodo = (data && data[0] && data[0].nombre_publico) || null;
    } catch (_) { /* sin apodo */ }
  }

  // La reseña propia de ESTE sitio, en cualquier estado. `epoca_anterior` se
  // excluye igual que en la app: la que escribiste cuando el local era otro
  // negocio no es «tu reseña de este sitio», así que no abre el formulario en
  // modo edición y puedes opinar del de ahora.
  async function cargarMia() {
    mia = null;
    fotosSubidas = [];
    fotosNuevas = [];
    if (!usuario) return;
    try {
      const { data } = await sb()
        .from('resenas')
        .select('id, rating, comentario, foto_url, fotos, estado, motivo_rechazo, ' +
          'resenas_ediciones(rating, comentario, fotos)')
        .eq('user_id', usuario.id)
        .eq('place_key', clave)
        .eq('epoca_anterior', false)
        .limit(1);
      const fila = data && data[0];
      if (!fila) return;
      const ediciones = fila.resenas_ediciones;
      const edicion = Array.isArray(ediciones) ? ediciones[0] : ediciones;
      mia = {
        id: fila.id,
        estado: fila.estado,
        motivo: fila.motivo_rechazo || '',
        // Si hay un cambio esperando revisión, el formulario precarga lo que
        // propuso, no lo publicado: si no, al abrirlo para retocar vería su
        // texto anterior y perdería el cambio sin enterarse.
        rating: (edicion && edicion.rating) || fila.rating,
        comentario: (edicion && edicion.comentario) || fila.comentario || '',
        fotos: leerFotos(edicion || fila),
        edicionPendiente: Boolean(edicion),
      };
      fotosSubidas = mia.fotos.slice();
    } catch (_) { /* si no se puede leer, se ofrece escribir una nueva */ }
  }

  function leerFotos(fila) {
    if (Array.isArray(fila.fotos) && fila.fotos.length) {
      return fila.fotos.filter((u) => typeof u === 'string' && u);
    }
    return fila.foto_url ? [fila.foto_url] : [];
  }

  // --- Fotos ----------------------------------------------------------------

  // Reduce a 1600 px de lado mayor y la pasa a JPEG, como hace la app con
  // `ImagePicker(maxWidth: 1600, imageQuality: 80)`. Si algo falla se sube el
  // fichero tal cual: es mejor una foto grande que ninguna.
  function reducir(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        try {
          const lienzo = document.createElement('canvas');
          lienzo.width = w; lienzo.height = h;
          lienzo.getContext('2d').drawImage(img, 0, 0, w, h);
          lienzo.toBlob((b) => resolve(b || file), 'image/jpeg', 0.8);
        } catch (_) { resolve(file); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // Sube las nuevas y devuelve la lista final. Best-effort por foto: si una
  // falla, la reseña se envía con el resto en vez de perderse entera.
  async function subirFotos() {
    const urls = fotosSubidas.slice();
    if (!fotosNuevas.length) return urls.slice(0, MAX_FOTOS);
    const almacen = sb().storage.from('sugerencias-fotos');
    const marca = Date.now();
    for (let i = 0; i < fotosNuevas.length; i++) {
      try {
        const blob = await reducir(fotosNuevas[i]);
        const ruta = usuario.id + '/' + marca + '_' + i + '.jpg';
        const { error } = await almacen.upload(ruta, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        urls.push(almacen.getPublicUrl(ruta).data.publicUrl);
      } catch (_) { /* esta foto se queda fuera */ }
    }
    return urls.slice(0, MAX_FOTOS);
  }

  // --- Enviar ---------------------------------------------------------------

  async function enviar(rating, comentario, aviso, boton) {
    boton.disabled = true;
    aviso.textContent = 'Enviando…';
    if (fotosNuevas.length && window.SeviFotos) {
      const puede = await window.SeviFotos.asegurar();
      if (!puede) {
        boton.disabled = false;
        aviso.textContent = '';
        return;
      }
    }
    try {
      const fotos = await subirFotos();
      let resultado = null;

      if (mia) {
        // Qué necesita revisión lo decide el servidor, no esta página.
        const { data, error } = await sb().rpc('fn_editar_resena', {
          p_place_key: clave,
          p_rating: rating,
          p_comentario: comentario || null,
          p_fotos: fotos,
        });
        if (error) throw error;
        resultado = data;
      } else {
        const fila = {
          user_id: usuario.id,
          place_name: lugar.nombre,
          place_key: clave,
          rating: rating,
          fotos: fotos,
          place_lat: lugar.lat,
          place_lon: lugar.lon,
        };
        if (comentario) fila.comentario = comentario;
        // `foto_url` se sigue rellenando con la primera: las versiones ya
        // publicadas de la app leen esa columna y no el array.
        if (fotos.length) fila.foto_url = fotos[0];
        if (lugar.tipo) fila.place_tipo = lugar.tipo;
        if (lugar.osmType && lugar.osmId != null) {
          fila.osm_type = lugar.osmType;
          fila.osm_id = lugar.osmId;
        }
        const { error } = await sb().from('resenas').insert(fila);
        // 23505 = ya había dejado una reseña aquí. Para quien mira la
        // pantalla no es un error: su reseña está puesta.
        if (error && error.code !== '23505') throw error;
      }

      // El voto solo se escribe aquí, al enviar o guardar la reseña. Si
      // falla no se le dice nada: el trigger `trg_sync_voto_resena_aprobada`
      // lo vuelve a poner al aprobarla.
      try {
        await sb().from('user_votes').upsert({
          user_id: usuario.id,
          place_name: lugar.nombre,
          place_key: clave,
          rating: rating,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,place_key' });
      } catch (_) { /* lo arregla el servidor al aprobar */ }

      // El mensaje se decide ANTES de recargar: después, `mia` ya existe y
      // una reseña nueva se anunciaría como si fuera un cambio.
      const mensaje = mensajeDeGuardado(resultado);
      await refrescar();
      anunciar(mensaje);
    } catch (_) {
      boton.disabled = false;
      aviso.textContent = 'No se ha podido enviar. Inténtalo más tarde.';
    }
  }

  // Lo mismo que `_mensajeDeGuardado` en la app: importa afinarlo, porque
  // «se revisará» cuando ya está publicado hace dudar de si se guardó.
  function mensajeDeGuardado(resultado) {
    if (!mia) return '¡Gracias! Tu reseña se publicará en cuanto la revisemos.';
    if (resultado === 'aplicada') return 'Puntuación actualizada.';
    if (resultado === 'edicion_en_revision') {
      return 'Guardado. Tu reseña sigue publicada y revisaremos el cambio.';
    }
    return 'Tus cambios se revisarán antes de publicarse.';
  }

  async function borrar(aviso, boton) {
    if (!window.confirm('Se borrará tu reseña y tu valoración de este sitio. No se puede deshacer.')) return;
    boton.disabled = true;
    aviso.textContent = 'Borrando…';
    try {
      const { error } = await sb().from('resenas').delete()
        .eq('user_id', usuario.id).eq('place_key', clave);
      if (error) throw error;
      await sb().from('user_votes').delete()
        .eq('user_id', usuario.id).eq('place_key', clave);
      await refrescar();
      anunciar('Reseña eliminada.');
    } catch (_) {
      boton.disabled = false;
      aviso.textContent = 'No se ha podido borrar. Inténtalo más tarde.';
    }
  }

  // --- Apodo ----------------------------------------------------------------

  function cajaApodo(donde) {
    const caja = el('div', 'resena-apodo');
    caja.appendChild(el('p', 'resena-nota',
      'Las reseñas van firmadas con tu apodo. Elige el tuyo para poder publicar.'));
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.className = 'resena-campo';
    campo.maxLength = 24;
    campo.placeholder = 'Tu apodo';
    campo.setAttribute('aria-label', 'Tu apodo');
    const estado = el('p', 'resena-nota', '');
    estado.setAttribute('role', 'status');
    const guardar = el('button', 'resena-btn primario', 'Guardar apodo');
    guardar.type = 'button';
    guardar.disabled = true;

    let espera = null;
    campo.addEventListener('input', () => {
      const v = campo.value.replace(/\s+/g, ' ').trim();
      clearTimeout(espera);
      if (!FORMATO_APODO.test(v)) {
        guardar.disabled = true;
        estado.textContent = v
          ? 'Entre 3 y 24 caracteres: letras, números, espacio, punto, guion o guion bajo'
          : '';
        return;
      }
      estado.textContent = 'Comprobando…';
      espera = setTimeout(async () => {
        try {
          const { data } = await sb().rpc('fn_comprobar_nombre_publico', { p_nombre: v });
          if (data === 'ok') {
            estado.textContent = 'Disponible';
            guardar.disabled = false;
          } else {
            guardar.disabled = true;
            estado.textContent = data === 'ocupado' ? 'Ya lo está usando otra persona'
              : data === 'reservado' ? 'Ese apodo está reservado, elige otro'
              : data === 'espera' ? 'Ya lo cambiaste hace poco; podrás volver a cambiarlo más adelante'
              : 'Ese apodo no vale, prueba otro';
          }
        } catch (_) {
          // Sin respuesta no se sabe: que mande el guardado, que sí es
          // definitivo.
          estado.textContent = '';
          guardar.disabled = false;
        }
      }, 450);
    });

    guardar.addEventListener('click', async () => {
      const v = campo.value.replace(/\s+/g, ' ').trim();
      guardar.disabled = true;
      estado.textContent = 'Guardando…';
      try {
        const { data, error } = await sb().rpc('fn_guardar_nombre_publico', { p_nombre: v });
        if (error) throw error;
        if (data !== 'ok') {
          estado.textContent = data === 'ocupado' ? 'Ya lo está usando otra persona'
            : data === 'reservado' ? 'Ese apodo está reservado, elige otro'
            : 'No se ha podido guardar ese apodo.';
          guardar.disabled = false;
          return;
        }
        apodo = v;
        pintar();
      } catch (_) {
        estado.textContent = 'No se ha podido guardar. Inténtalo más tarde.';
        guardar.disabled = false;
      }
    });

    caja.append(campo, estado, guardar);
    donde.appendChild(caja);
  }

  // --- Formulario -----------------------------------------------------------

  function selectorEstrellas(valor, alCambiar) {
    const caja = el('div', 'resena-estrellas');
    caja.setAttribute('role', 'radiogroup');
    caja.setAttribute('aria-label', 'Tu puntuación, de 1 a 5 estrellas');
    const botones = [];
    for (let i = 1; i <= 5; i++) {
      const b = el('button', 'resena-estrella', '★');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', i === 1 ? '1 estrella' : i + ' estrellas');
      b.addEventListener('click', () => {
        valor = i;
        pintarEstrellas();
        alCambiar(i);
      });
      botones.push(b);
      caja.appendChild(b);
    }
    function pintarEstrellas() {
      botones.forEach((b, idx) => {
        const puesta = idx < valor;
        b.classList.toggle('puesta', puesta);
        b.setAttribute('aria-checked', idx + 1 === valor ? 'true' : 'false');
      });
    }
    pintarEstrellas();
    return caja;
  }

  function tiraDeFotos(cuerpo, alCambiar) {
    const tira = el('div', 'resena-fotos-elegidas');
    function repintar() {
      tira.textContent = '';
      const todas = fotosSubidas.map((u) => ({ url: u, nueva: false }))
        .concat(fotosNuevas.map((f) => ({ file: f, nueva: true })));
      todas.forEach((f, i) => {
        const marco = el('div', 'resena-foto-marco');
        const img = document.createElement('img');
        img.alt = '';
        img.src = f.nueva ? URL.createObjectURL(f.file) : f.url;
        const quitar = el('button', 'resena-foto-quitar', '×');
        quitar.type = 'button';
        quitar.setAttribute('aria-label', 'Quitar la foto ' + (i + 1));
        quitar.addEventListener('click', () => {
          if (f.nueva) fotosNuevas.splice(i - fotosSubidas.length, 1);
          else fotosSubidas.splice(i, 1);
          repintar();
          alCambiar();
        });
        marco.append(img, quitar);
        tira.appendChild(marco);
      });
      if (fotosSubidas.length + fotosNuevas.length < MAX_FOTOS) {
        const etiqueta = el('label', 'resena-foto-anadir');
        etiqueta.appendChild(el('span', null, '+ Foto'));
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        // El aviso se acepta una vez. Después de aceptar se vuelve a abrir
        // el selector; el segundo clic ya pasa sin diálogo.
        input.addEventListener('click', async (ev) => {
          if (!window.SeviFotos || window.SeviFotos.yaAceptada()) return;
          ev.preventDefault();
          if (await window.SeviFotos.asegurar()) input.click();
        });
        input.addEventListener('change', () => {
          const hueco = MAX_FOTOS - (fotosSubidas.length + fotosNuevas.length);
          Array.from(input.files || []).slice(0, hueco).forEach((f) => fotosNuevas.push(f));
          repintar();
          alCambiar();
        });
        etiqueta.appendChild(input);
        tira.appendChild(etiqueta);
      }
    }
    repintar();
    cuerpo.appendChild(tira);
  }

  function formulario(cuerpo) {
    let rating = mia ? mia.rating : 0;
    const aviso = el('p', 'resena-aviso', '');
    aviso.setAttribute('role', 'status');

    if (mia) {
      const estado = el('p', 'resena-estado');
      if (mia.estado === 'pendiente') {
        estado.textContent = '⏳ Tu reseña está esperando revisión. Se publicará cuando la aprobemos.';
      } else if (mia.estado === 'rechazada') {
        estado.textContent = mia.motivo
          ? '✖ No se ha publicado: ' + mia.motivo
          : '✖ No se ha publicado.';
        estado.classList.add('malo');
      } else if (mia.edicionPendiente) {
        estado.textContent = '⏳ Tu reseña está publicada y tu último cambio espera revisión.';
      } else {
        estado.textContent = '✔ Tu reseña está publicada.';
        estado.classList.add('bueno');
      }
      cuerpo.appendChild(estado);
    }

    const enviarBtn = el('button', 'resena-btn primario', mia ? 'Guardar cambios' : 'Enviar reseña');
    enviarBtn.type = 'button';
    enviarBtn.disabled = rating < 1;

    cuerpo.appendChild(selectorEstrellas(rating, (v) => {
      rating = v;
      enviarBtn.disabled = v < 1;
    }));

    const texto = document.createElement('textarea');
    texto.className = 'resena-campo';
    texto.rows = 4;
    texto.maxLength = MAX_COMENTARIO;
    texto.placeholder = '¿Qué tal está? (opcional)';
    texto.setAttribute('aria-label', 'Tu reseña, opcional');
    if (mia) texto.value = mia.comentario || '';
    cuerpo.appendChild(texto);

    tiraDeFotos(cuerpo, () => { /* nada más que hacer: se suben al enviar */ });

    const acciones = el('div', 'resena-acciones');
    acciones.appendChild(enviarBtn);
    if (mia) {
      const borrarBtn = el('button', 'resena-btn', 'Eliminar');
      borrarBtn.type = 'button';
      borrarBtn.classList.add('peligro');
      borrarBtn.addEventListener('click', () => borrar(aviso, borrarBtn));
      acciones.appendChild(borrarBtn);
    }
    cuerpo.appendChild(acciones);

    enviarBtn.addEventListener('click', () => {
      if (rating < 1) return;
      enviar(rating, texto.value.trim(), aviso, enviarBtn);
    });

    cuerpo.appendChild(aviso);
    cuerpo.appendChild(el('p', 'resena-nota',
      mia && mia.estado === 'aprobada'
        ? 'Cambiar solo la puntuación se publica al momento; si cambias el texto o las fotos, lo revisamos antes y mientras sigue publicada la versión anterior.'
        : 'Las reseñas se revisan antes de publicarse. Hasta 3 fotos.'));
  }

  // --- Pintado de la sección ------------------------------------------------

  function pintar() {
    if (!seccion) return;
    const cuerpo = seccion.querySelector('.tu-resena-cuerpo');
    cuerpo.textContent = '';
    seccion.querySelector('h2').textContent = mia ? 'Tu reseña' : 'Valora este sitio';

    if (!usuario) {
      cuerpo.appendChild(el('p', 'resena-nota',
        'Ver es libre; para valorar y reseñar hace falta entrar con Google, igual que en la app.'));
      const b = el('button', 'resena-btn primario', 'Entrar con Google para valorar');
      b.type = 'button';
      b.addEventListener('click', entrar);
      cuerpo.appendChild(b);
      return;
    }
    if (!apodo) { cajaApodo(cuerpo); return; }
    formulario(cuerpo);
  }

  function anunciar(texto) {
    const aviso = seccion && seccion.querySelector('.resena-aviso');
    if (aviso) aviso.textContent = texto;
  }

  async function refrescar() {
    await cargarMia();
    pintar();
    // La nota media y la lista pública cambian con lo que acaba de pasar.
    if (window.SeviFicha && window.SeviFicha.recargarOpiniones) {
      window.SeviFicha.recargarOpiniones();
    }
  }

  // --- «Me gusta» en las reseñas de los demás ------------------------------

  // La llama la ficha al pintar cada reseña pública. Sin sesión no se ofrece
  // (sin `user_id` no hay forma de impedir diez votos de la misma persona) y
  // en la propia tampoco: la RLS la rechaza.
  function botonUtil(fila) {
    if (!usuario || fila.es_mia) return null;
    let puesto = fila.yo_util === true;
    let cuantos = Number(fila.utiles_count) || 0;
    const b = el('button', 'resena-util-btn');
    b.type = 'button';
    // Corazón en SVG y no un carácter: Inter no trae ♥/♡ y el sistema lo
    // pintaría como emoji o con otra fuente, distinto en cada móvil.
    const NS = 'http://www.w3.org/2000/svg';
    const icono = document.createElementNS(NS, 'svg');
    icono.setAttribute('viewBox', '0 0 24 24');
    icono.setAttribute('width', '14');
    icono.setAttribute('height', '14');
    icono.setAttribute('aria-hidden', 'true');
    const corazon = document.createElementNS(NS, 'path');
    corazon.setAttribute('d',
      'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 ' +
      '4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 ' +
      '16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 ' +
      '11.54L12 21.35z');
    corazon.setAttribute('stroke', 'currentColor');
    corazon.setAttribute('stroke-width', '2');
    corazon.setAttribute('stroke-linejoin', 'round');
    icono.appendChild(corazon);
    const texto = el('span');
    b.append(icono, texto);
    function repintar() {
      texto.textContent =
        'Me gusta' + (cuantos > 0 ? ' · ' + cuantos : '');
      corazon.setAttribute('fill', puesto ? 'currentColor' : 'none');
      b.classList.toggle('marcado', puesto);
      b.setAttribute('aria-pressed', puesto ? 'true' : 'false');
      b.setAttribute('aria-label', cuantos === 1
        ? 'Le gusta a 1 persona' : 'Le gusta a ' + cuantos + ' personas');
    }
    repintar();
    b.addEventListener('click', async () => {
      // Se pinta antes de que el servidor conteste y se deshace si falla:
      // es lo mismo que hace la app.
      const estaba = puesto;
      puesto = !estaba;
      cuantos += estaba ? -1 : 1;
      repintar();
      try {
        if (estaba) {
          const { error } = await sb().from('resenas_utiles').delete()
            .eq('resena_id', fila.id).eq('user_id', usuario.id);
          if (error) throw error;
        } else {
          const { error } = await sb().from('resenas_utiles')
            .insert({ resena_id: fila.id, user_id: usuario.id });
          // 23505 = ya lo había votado: su voto está puesto.
          if (error && error.code !== '23505') throw error;
        }
      } catch (_) {
        puesto = estaba;
        cuantos += estaba ? 1 : -1;
        repintar();
      }
    });
    return b;
  }

  // --- Arranque -------------------------------------------------------------

  function montar(donde) {
    seccion = el('section', 'tu-resena');
    seccion.id = 'tu-resena';
    seccion.appendChild(el('h2', null, 'Valora este sitio'));
    seccion.appendChild(el('div', 'tu-resena-cuerpo'));
    donde.appendChild(seccion);
  }

  window.SeviResena = {
    // La ficha llama a esto cuando ya sabe qué sitio es.
    iniciar(datos, donde) {
      lugar = datos;
      clave = datos.clave;
      montar(donde);
      pintar();

      // Quién era la última vez. Empieza en `false` —no en `null`— para que
      // el primer aviso «no hay sesión» no se confunda con un repetido.
      let ultimoId = false;
      async function cambioDeSesion(user) {
        const id = user ? user.id : null;
        if (id === ultimoId) return;  // la misma noticia dos veces
        const primeraVez = ultimoId === false;
        ultimoId = id;
        usuario = user;
        await cargarApodo();
        await cargarMia();
        pintar();
        // Con sesión, la lista pública se pide otra vez: solo entonces el
        // servidor puede decir cuáles son tuyas y a cuáles ya diste «me gusta».
        // Si lo primero que se sabe es que NO hay sesión, no hay nada que
        // volver a pedir: la ficha ya la está cargando con la clave pública.
        if (primeraVez && !user) return;
        if (window.SeviFicha && window.SeviFicha.recargarOpiniones) {
          window.SeviFicha.recargarOpiniones();
        }
      }

      window.SEVI.onAuth.push(cambioDeSesion);
      // Y además se pregunta: `auth.js` puede haber resuelto la sesión antes
      // de que esta ficha supiera qué sitio es, y entonces el aviso de
      // arriba ya habría pasado. `cambioDeSesion` ignora el repetido.
      const cliente = sb();
      if (cliente) {
        cliente.auth.getSession()
          .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
          .catch(() => {});
      }
    },
    botonUtil,
    get haySesion() { return Boolean(usuario); },
  };
})();
