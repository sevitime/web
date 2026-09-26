// Login de Google compartido por la web de SeviTime (sevitime.com).
//
// Deja el cliente de Supabase en `window.SEVI` y pinta en el hueco
// `#auth-seccion`:
//   - sin sesión: botón «Entrar con Google» (mismo aire que el del editor).
//   - con sesión: avatar, nombre y un badge con el XP real al lado, más
//     «Salir».
//
// La sesión vive en localStorage de este dominio: no se comparte con el
// editor (sevitime-editor.pages.dev), que es otro dominio y guarda la suya
// aparte. Entrar aquí no te conecta allí.
//
// `onAuth` es la lista de callbacks a los que se avisa cuando cambia la
// sesión (para que el ranking repinte y marque tu fila, por ejemplo).
//
// La librería de Supabase (216 KB) NO se carga si no hace falta. En la
// portada, donde mucha gente no entra nunca, se descarga solo al pulsar
// «Entrar con Google», si hay una sesión guardada o si venimos del login.
// Las páginas que hacen uso directo de Supabase (mapa, rutas, ranking,
// eventos) siguen incluyendo el <script> ellas mismas, y aquí se detecta y
// se usa sin cargarlo dos veces.
(function () {
  var SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';
  var SUPABASE_SRC = '/libs/supabase.min.js';

  var sb = null;
  var cola = null;

  window.SEVI = { sb: null, onAuth: [] };

  function nombreDe(user) {
    return user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)
      || (user.email ? user.email.split('@')[0] : 'Usuario');
  }

  function fotoDe(user) {
    return user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture) || '';
  }

  function svgGoogle() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = [
      ['#4285F4', 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'],
      ['#34A853', 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'],
      ['#FBBC05', 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z'],
      ['#EA4335', 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z']
    ];
    p.forEach(function (par) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', par[0]);
      path.setAttribute('d', par[1]);
      svg.appendChild(path);
    });
    return svg;
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

      var xp = document.createElement('span');
      xp.className = 'auth-xp';
      xp.textContent = '…';
      xp.title = 'Tus puntos en SeviTime';
      info.appendChild(xp);

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

      // «Panel», solo para los administradores, como en la app. Lo decide
      // el servidor (`fn_es_admin`); el panel también lo comprueba al
      // entrar, así que esto es solo el acceso, no la seguridad.
      sb.rpc('fn_es_admin')
        .then(function (res) {
          if (res.data !== true || !salir.isConnected) return;
          var panel = document.createElement('a');
          panel.className = 'auth-panel';
          panel.href = '/admin/';
          panel.textContent = 'Panel';
          panel.title = 'Panel de administrador';
          seccion.insertBefore(panel, salir);
        })
        .catch(function () {});

      // El XP real, con sesión. Sin sesión esto no devolvería nada.
      sb.rpc('fn_mis_puntos')
        .then(function (res) {
          var fila = res.data && res.data[0];
          if (fila && typeof fila.xp === 'number') {
            xp.textContent = fila.xp.toLocaleString('es-ES') + ' XP';
          }
        })
        .catch(function () {
          xp.textContent = '';
        });
    } else {
      var boton = document.createElement('button');
      boton.className = 'auth-entrar';
      boton.type = 'button';
      boton.appendChild(svgGoogle());
      var texto = document.createElement('span');
      texto.textContent = 'Entrar con Google';
      boton.appendChild(texto);
      boton.addEventListener('click', function () {
        conSupabase(function () {
          sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname },
          });
        });
      });
      seccion.appendChild(boton);
    }
  }

  function avisar(user) {
    pintar(user);
    window.SEVI.onAuth.forEach(function (fn) { fn(user); });
  }

  // ¿Hay una sesión de Supabase guardada en este navegador? La clave que usa
  // supabase-js es `sb-<ref>-auth-token` (a veces troceada en `.0`, `.1`…).
  function haySesionGuardada() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var clave = localStorage.key(i);
        if (clave && clave.indexOf('sb-') === 0 && clave.indexOf('-auth-token') !== -1) {
          return true;
        }
      }
    } catch (e) {
      // localStorage bloqueado (modo privado estricto): trátalo como sin sesión.
    }
    return false;
  }

  // Volvemos del login: Supabase tiene que procesar la URL (código o tokens).
  function vieneDelLogin() {
    return window.location.hash.indexOf('access_token=') !== -1 ||
      window.location.search.indexOf('code=') !== -1;
  }

  function iniciar() {
    if (sb) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.SEVI.sb = sb;

    sb.auth.onAuthStateChange(function (_event, session) {
      avisar(session ? session.user : null);
    });

    sb.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      avisar(session ? session.user : null);
      if (vieneDelLogin()) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });
  }

  // Garantiza que Supabase está listo y ejecuta `fn`. Si no está cargado, lo
  // descarga una sola vez y encola las llamadas que lleguen mientras tanto.
  function conSupabase(fn) {
    if (sb) { fn(); return; }
    if (window.supabase) { iniciar(); fn(); return; }
    if (cola) { cola.push(fn); return; }
    cola = [fn];
    var script = document.createElement('script');
    script.src = SUPABASE_SRC;
    script.onload = function () {
      iniciar();
      var pendientes = cola;
      cola = null;
      pendientes.forEach(function (f) { f(); });
    };
    script.onerror = function () {
      cola = null;
    };
    document.head.appendChild(script);
  }

  if (window.supabase) {
    // La página ya trae la librería: no hay nada que diferir.
    iniciar();
  } else if (haySesionGuardada() || vieneDelLogin()) {
    // Hay sesión o venimos del login: necesitamos Supabase ya.
    conSupabase(function () {});
  } else {
    // Visitante anónimo: pinta el botón y no descargues nada todavía.
    pintar(null);
  }
})();
