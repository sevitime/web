(function () {
  'use strict';

  const PAQUETE = 'com.selu.sevitime';
  const PLAY = 'https://play.google.com/store/apps/details?id=' + PAQUETE;
  const SUPABASE_URL = 'https://kdqiwhvtovafugpcrumf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';
  const nombreSolicitado = (new URLSearchParams(window.location.search).get('n') || '').trim();

  const estado = document.getElementById('estado');
  const datos = document.getElementById('datos');
  const COLOR_PRESET = {
    giralda: '#00897B', catedral: '#5E7A8A', azahar: '#7CB342', ceramica: '#1E88E5',
    rebujito: '#C0A020', barco: '#00838F', flamenco: '#AD1457', abanico: '#6D4C9F',
    farol: '#E65100', sol: '#F9A825', madruga: '#37474F', cafe: '#6D4C41',
  };
  const EMOJI_PRESET = {
    giralda: '🏛️', catedral: '⛪', azahar: '🌸', ceramica: '🔷',
    rebujito: '🍷', barco: '⛵', flamenco: '🎵', abanico: '🎐',
    farol: '💡', sol: '☀️', madruga: '🌙', cafe: '☕',
  };
  const EMOJI_RUTA = {
    monumento: '🏛️', rio: '⛵', parque: '🌳', iglesia: '⛪', tapas: '🍷',
    setas: '🍄', museo: '🖼️', cafe: '☕', mirador: '🌅', compras: '🛍️',
    familia: '👨‍👩‍👧', noche: '🌙',
  };
  const TIPOS_APORTACION = {
    resena: 'Reseñas', resena_foto: 'Fotos', resena_texto: 'Comentarios',
    util_recibido: '«Útil»', reporte: 'Avisos', foto_erronea: 'Fotos corregidas',
    sugerencia: 'Sitios nuevos', sello: 'Sellos', ruta: 'Rutas',
  };

  function iniciales(nombre) {
    const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return partes.length === 1
      ? partes[0].charAt(0).toUpperCase()
      : (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
  }

  function numero(n) { return (n || 0).toLocaleString('es-ES'); }

  function intentPerfil(nombre) {
    return 'intent://perfil/' + encodeURIComponent(nombre) + '#Intent;scheme=sevitime;package=' + PAQUETE +
      ';S.browser_fallback_url=' + encodeURIComponent(PLAY) + ';end';
  }

  function pintarAvatar(guardado, nombre) {
    const avatar = document.getElementById('avatar');
    if (guardado && guardado.startsWith('preset:')) {
      const id = guardado.slice(7);
      avatar.style.background = COLOR_PRESET[id] || '#00897B';
      avatar.textContent = EMOJI_PRESET[id] || '📍';
    } else if (guardado) {
      const img = document.createElement('img');
      img.src = guardado;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      avatar.appendChild(img);
    } else {
      avatar.textContent = iniciales(nombre);
    }
  }

  function anadirStat(valor, etiqueta) {
    const stat = document.createElement('div');
    stat.className = 'perfil-stat';
    const numeroEl = document.createElement('div');
    numeroEl.className = 'perfil-stat-valor';
    numeroEl.textContent = valor;
    const etiquetaEl = document.createElement('div');
    etiquetaEl.className = 'perfil-stat-etiqueta';
    etiquetaEl.textContent = etiqueta;
    stat.append(numeroEl, etiquetaEl);
    document.getElementById('stats').appendChild(stat);
  }

  function pintarPerfil(perfil, rutas) {
    document.title = perfil.nombre_publico + ' — SeviTime';
    document.getElementById('nombre').textContent = perfil.nombre_publico;
    document.getElementById('titulo').textContent = (perfil.titulo || '') + ' · nivel ' + perfil.nivel;
    pintarAvatar(perfil.avatar, perfil.nombre_publico);

    anadirStat(numero(perfil.xp), 'XP');
    anadirStat('#' + perfil.posicion, 'en el ranking');
    if (perfil.seguidores != null) anadirStat(numero(perfil.seguidores), 'seguidores');
    if (perfil.siguiendo != null) anadirStat(numero(perfil.siguiendo), 'siguiendo');

    if (perfil.bio) {
      const bio = document.getElementById('bio');
      bio.textContent = perfil.bio;
      bio.hidden = false;
    }

    const aportaciones = perfil.aportaciones || {};
    Object.keys(aportaciones).filter((tipo) => TIPOS_APORTACION[tipo]).forEach((tipo) => {
      const chip = document.createElement('span');
      chip.className = 'perfil-chip';
      chip.textContent = TIPOS_APORTACION[tipo] + ' · ' + numero(aportaciones[tipo]);
      document.getElementById('aportaciones').appendChild(chip);
    });

    if (rutas.length) {
      const lista = document.getElementById('rutas');
      rutas.forEach((ruta) => {
        const enlace = document.createElement('a');
        enlace.className = 'perfil-ruta';
        // Dentro de la propia web: `/rutas/?id=` abre esa ruta desplegada.
        enlace.href = '/rutas/?id=' + encodeURIComponent(ruta.id);
        const icono = document.createElement('span');
        icono.className = 'perfil-ruta-icono';
        icono.setAttribute('aria-hidden', 'true');
        icono.textContent = EMOJI_RUTA[ruta.icono] || '📍';
        const cuerpo = document.createElement('span');
        cuerpo.className = 'perfil-ruta-cuerpo';
        const nombre = document.createElement('span');
        nombre.className = 'perfil-ruta-nombre';
        nombre.textContent = ruta.nombre;
        const meta = document.createElement('span');
        meta.className = 'perfil-ruta-meta';
        meta.textContent = ruta.paradas + ' paradas · ' + ruta.minutos + ' min';
        cuerpo.append(nombre, meta);
        enlace.append(icono, cuerpo);
        lista.appendChild(enlace);
      });
      document.getElementById('rutas-seccion').hidden = false;
    }

    if (/android/i.test(navigator.userAgent)) {
      const abrir = document.getElementById('abrir-app');
      abrir.href = intentPerfil(perfil.nombre_publico);
      abrir.hidden = false;
    }
    estado.hidden = true;
    datos.hidden = false;
  }

  if (!nombreSolicitado) {
    estado.textContent = 'Este enlace de perfil está incompleto.';
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  Promise.all([
    sb.rpc('fn_perfil_publico', { p_nombre: nombreSolicitado }),
    sb.rpc('fn_rutas_de_usuario', { p_nombre: nombreSolicitado }),
  ]).then(([perfilRes, rutasRes]) => {
    if (perfilRes.error) throw perfilRes.error;
    if (rutasRes.error) throw rutasRes.error;
    const perfil = perfilRes.data && perfilRes.data[0];
    if (!perfil) {
      estado.textContent = 'No encontramos un perfil público con ese nombre.';
      return;
    }
    pintarPerfil(perfil, rutasRes.data || []);
  }).catch(() => {
    estado.textContent = 'No se pudo cargar el perfil. Recarga dentro de un momento.';
  });
}());
