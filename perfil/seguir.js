// Seguir a alguien desde la web.
//
// Lo mismo que la app hace en el perfil de otra persona
// (`perfil_publico_service.dart`) y con las mismas funciones: `fn_seguir`,
// `fn_dejar_de_seguir` y `fn_a_quien_sigo`. No hay tabla nueva ni SQL nuevo.
//
// Sirve para algo más que el contador: cuando alguien a quien sigues publica
// una ruta, el servidor manda un aviso, y desde hoy esos avisos llegan
// también a la web instalada (ver `avisos.js`).
//
// Pide cuenta, como en la app: seguir a alguien sin ser nadie no significa
// nada. Y no se puede seguir a uno mismo —eso lo decide el servidor, que
// devuelve `false`— ni a quien se salió del cuadro de honor, que no tiene
// perfil público.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;

  let nombre = null;
  let usuario = null;
  let caja = null;
  let sigo = false;
  let trabajando = false;

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function entrar() {
    const cliente = sb();
    if (!cliente) {
      if (window.SEVI && window.SEVI.conSupabase) {
        window.SEVI.conSupabase(entrar);
      }
      return;
    }
    cliente.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }

  // El perfil propio no lleva botón. El nombre con el que firmo sale de
  // `fn_mi_perfil`, el mismo que usa la app: no está en el usuario de
  // Supabase, está en la tabla de perfiles.
  let miNombre = null;
  function esMiPerfil() {
    return Boolean(usuario && miNombre && miNombre === nombre);
  }

  async function cargar() {
    sigo = false;
    miNombre = null;
    if (!usuario || !sb()) return;
    try {
      const { data } = await sb().rpc('fn_mi_perfil');
      const fila = (data || [])[0];
      if (fila) miNombre = fila.nombre_publico || null;
    } catch (_) { /* sin esto solo se pierde esconder el botón en tu perfil */ }
    try {
      const { data } = await sb().rpc('fn_a_quien_sigo');
      sigo = (data || []).some(function (f) { return f.nombre_publico === nombre; });
    } catch (_) { /* si no se sabe, se enseña «Seguir»: no se miente al revés */ }
  }

  async function alternar(aviso) {
    if (trabajando || !sb()) return;
    trabajando = true;
    const antes = sigo;
    // Se pinta antes de que conteste el servidor y se deshace si falla, como
    // el corazón de la app.
    sigo = !antes;
    pintar();
    try {
      const { data, error } = await sb()
        .rpc(antes ? 'fn_dejar_de_seguir' : 'fn_seguir', { p_nombre: nombre });
      if (error || data !== true) throw error || new Error('no se pudo');
      ajustarContador(antes ? -1 : 1);
    } catch (e) {
      sigo = antes;
      pintar();
      const nuevo = caja.querySelector('.perfil-seguir-aviso');
      if (nuevo) {
        // El servidor devuelve `false` —y no un error— cuando no hay a quién
        // seguir: un nombre que ya no existe, uno mismo, o alguien que se
        // salió del cuadro de honor y por tanto no tiene perfil público. Eso
        // no es un fallo de red y no se cuenta como tal.
        nuevo.textContent = e && e.message === 'no se pudo'
          ? 'No se puede seguir a este perfil.'
          : 'No se ha podido guardar. Inténtalo más tarde.';
      }
      trabajando = false;
      return;
    }
    trabajando = false;
    pintar();
    if (aviso) aviso.textContent = '';
  }

  // El número de seguidores está pintado en las estadísticas de arriba, y
  // dejarlo quieto después de pulsar «Seguir» parece que no ha pasado nada.
  function ajustarContador(delta) {
    const stats = document.querySelectorAll('#stats .perfil-stat');
    for (let i = 0; i < stats.length; i++) {
      const etiqueta = stats[i].querySelector('.perfil-stat-etiqueta');
      if (!etiqueta || etiqueta.textContent !== 'seguidores') continue;
      const valor = stats[i].querySelector('.perfil-stat-valor');
      const n = parseInt((valor.textContent || '0').replace(/\D/g, ''), 10);
      if (!isNaN(n)) valor.textContent = Math.max(0, n + delta).toLocaleString('es-ES');
    }
  }

  function pintar() {
    if (!caja) return;
    caja.textContent = '';
    if (esMiPerfil()) return;

    if (!usuario) {
      const b = el('button', 'perfil-seguir', 'Seguir');
      b.type = 'button';
      b.addEventListener('click', entrar);
      caja.appendChild(b);
      caja.appendChild(el('p', 'perfil-seguir-nota',
        'Entra con Google para seguir a alguien y que te avisemos de sus rutas nuevas.'));
      return;
    }

    const aviso = el('p', 'perfil-seguir-aviso', '');
    aviso.setAttribute('role', 'status');
    const b = el('button', 'perfil-seguir' + (sigo ? ' siguiendo' : ''),
      sigo ? 'Siguiendo' : 'Seguir');
    b.type = 'button';
    b.setAttribute('aria-pressed', sigo ? 'true' : 'false');
    b.addEventListener('click', function () { alternar(aviso); });
    caja.append(b, aviso);
  }

  window.SeviSeguir = {
    iniciar(datos, donde) {
      if (!donde || !datos || !datos.nombre) return;
      nombre = datos.nombre;
      caja = donde;
      pintar();

      let ultimoId = false;
      async function cambioDeSesion(user) {
        const id = user ? user.id : null;
        if (id === ultimoId) return;
        ultimoId = id;
        usuario = user;
        await cargar();
        pintar();
      }
      if (window.SEVI) {
        window.SEVI.onAuth.push(cambioDeSesion);
        const cliente = sb();
        if (cliente) {
          cliente.auth.getSession()
            .then((r) => cambioDeSesion(r && r.data && r.data.session ? r.data.session.user : null))
            .catch(() => {});
        }
      }
    },
  };
})();
