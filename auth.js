// Login de Google compartido por la web de SeviTime (sevitime.com).
//
// Deja el cliente de Supabase en `window.SEVI` y pinta en el hueco
// `#auth-seccion` un botón «Entrar» o, si ya hay sesión, el avatar y el
// nombre de quien está dentro con un «Salir».
//
// La sesión vive en localStorage de este dominio: no se comparte con el
// editor (sevitime-editor.pages.dev), que es otro dominio y guarda la suya
// aparte. Entrar aquí no te conecta allí.
//
// `onAuth` es la lista de callbacks a los que se avisa cuando cambia la
// sesión (para que el ranking repinte y marque tu fila, por ejemplo).
(function () {
  var SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.SEVI = { sb: sb, onAuth: [] };

  function nombreDe(user) {
    return user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)
      || (user.email ? user.email.split('@')[0] : 'Usuario');
  }

  function fotoDe(user) {
    return user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture) || '';
  }

  function pintar(user) {
    var seccion = document.getElementById('auth-seccion');
    if (!seccion) return;
    seccion.textContent = '';

    if (user) {
      var info = document.createElement('div');
      info.className = 'auth-info';

      var avatar = document.createElement('div');
      avatar.className = 'auth-avatar';
      var foto = fotoDe(user);
      if (foto) {
        var img = document.createElement('img');
        img.src = foto;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        avatar.appendChild(img);
      } else {
        avatar.textContent = (nombreDe(user).charAt(0) || '?').toUpperCase();
      }
      info.appendChild(avatar);

      var nombre = document.createElement('span');
      nombre.className = 'auth-nombre';
      nombre.textContent = nombreDe(user);
      nombre.title = 'Conectado como ' + (user.email || nombreDe(user));
      info.appendChild(nombre);

      var salir = document.createElement('button');
      salir.className = 'auth-salir';
      salir.type = 'button';
      salir.textContent = 'Salir';
      salir.title = 'Cerrar sesión';
      salir.addEventListener('click', function () {
        sb.auth.signOut();
      });

      seccion.appendChild(info);
      seccion.appendChild(salir);
    } else {
      var boton = document.createElement('button');
      boton.className = 'auth-entrar';
      boton.type = 'button';
      boton.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg><span>Entrar</span>';
      boton.addEventListener('click', function () {
        sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname },
        });
      });
      seccion.appendChild(boton);
    }
  }

  function avisar(user) {
    pintar(user);
    window.SEVI.onAuth.forEach(function (fn) { fn(user); });
  }

  sb.auth.onAuthStateChange(function (_event, session) {
    avisar(session ? session.user : null);
  });

  sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    avisar(session ? session.user : null);
    if (window.location.hash.indexOf('access_token=') !== -1 || window.location.search.indexOf('code=') !== -1) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  });
})();
