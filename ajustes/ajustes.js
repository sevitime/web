// Ajustes: el bloque de la cuenta.
//
// Los avisos los pinta `avisos.js` en `#hueco-avisos`, igual que hacía en
// Guardados; aquí solo se mueve de sitio. Lo que es propio de esta página es
// decir con qué cuenta has entrado y dejarte salir, que en la app vive en
// `CuentaSection` dentro de Ajustes.
//
// Sin sesión no se esconde: se explica para qué sirve entrar. Es la misma
// regla de toda la web —ver es libre, participar pide cuenta— y aquí además
// evita la pantalla en blanco.
(function () {
  'use strict';

  const hueco = document.getElementById('aj-cuenta');
  if (!hueco) return;

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function nombreDe(user) {
    const m = user.user_metadata || {};
    return m.full_name || m.name ||
      (user.email ? user.email.split('@')[0] : 'Tu cuenta');
  }

  function pintar(user) {
    hueco.textContent = '';

    if (!user) {
      hueco.appendChild(el('p', 'aj-nota',
        'No has entrado. Con tu cuenta de Google se sincronizan tus ' +
        'guardados y tus reseñas entre el móvil y el ordenador, y puedes ' +
        'recibir avisos.'));
      const b = el('button', 'aj-boton', 'Entrar con Google');
      b.type = 'button';
      b.addEventListener('click', function () {
        const entrar = document.querySelector('.auth-entrar');
        if (entrar) entrar.click();
      });
      hueco.appendChild(b);
      return;
    }

    const ficha = el('div', 'aj-cuenta-ficha');
    const foto = (user.user_metadata || {}).avatar_url ||
      (user.user_metadata || {}).picture;
    if (foto) {
      const img = document.createElement('img');
      img.src = foto;
      img.alt = '';
      img.width = 44;
      img.height = 44;
      img.className = 'aj-avatar';
      ficha.appendChild(img);
    }
    const textos = el('div');
    textos.appendChild(el('strong', null, nombreDe(user)));
    if (user.email) textos.appendChild(el('span', 'aj-nota', user.email));
    ficha.appendChild(textos);
    hueco.appendChild(ficha);

    const perfil = el('a', 'aj-enlace', 'Ver tu perfil público');
    perfil.href = '/perfil/';
    hueco.appendChild(perfil);

    const salir = el('button', 'aj-boton aj-boton-suave', 'Cerrar sesión');
    salir.type = 'button';
    salir.addEventListener('click', function () {
      const sb = window.SEVI && window.SEVI.sb;
      if (sb) sb.auth.signOut();
    });
    hueco.appendChild(salir);
  }

  // `auth.js` avisa cuando sabe quién eres; mientras, se queda lo que ya
  // está puesto en el HTML.
  if (window.SEVI && window.SEVI.onAuth) window.SEVI.onAuth.push(pintar);
  const cliente = window.SEVI && window.SEVI.sb;
  if (cliente) {
    cliente.auth.getSession()
      .then(function (r) {
        pintar(r && r.data && r.data.session ? r.data.session.user : null);
      })
      .catch(function () { pintar(null); });
  } else if (window.SEVI && window.SEVI.conSupabase) {
    // Sin librería cargada todavía: si no hay sesión guardada, no se fuerza
    // su descarga solo para decir «no has entrado».
    let haySesion = false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) {
          haySesion = true;
          break;
        }
      }
    } catch (e) {}
    if (!haySesion) pintar(null);
  }
}());
