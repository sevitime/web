// Denunciar un perfil desde la web.
//
// La misma función que la app (`fn_denunciar_perfil`) y la misma lista de
// motivos que `MotivoDenuncia` en `denuncias_service.dart`. Si se añade uno,
// va en los tres sitios: aquí, en el enum de la app y en el CHECK de
// `denuncias_perfil`.
//
// Pide cuenta, como seguir: denunciar sin sesión es acoso anónimo sin límite
// real. Sin cuenta queda «Contactar con SeviTime», que acepta denuncias.
//
// Al enviar no se cuenta nunca qué pasa después: ni si ya lo habías
// denunciado, ni qué se decidió. Un botón que contesta «atendida» se
// convierte en un marcador contra otra persona.
(function () {
  'use strict';

  const sb = () => window.SEVI && window.SEVI.sb;

  const MOTIVOS = [
    ['apodo', 'El apodo es ofensivo'],
    ['avatar', 'La foto de perfil es ofensiva'],
    ['bio', 'Lo que dice de sí mismo es ofensivo'],
    ['suplantacion', 'Se hace pasar por otra persona'],
    ['resenas', 'Sus reseñas insultan o faltan al respeto'],
    ['rutas', 'Sus rutas llevan algo que no debería estar'],
    ['spam', 'Publicidad o spam'],
    ['otro', 'Otra cosa'],
  ];

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function abrirDialogo(nombre) {
    const d = el('dialog', 'aceptacion-fotos denuncia-perfil');
    d.appendChild(el('h2', null, 'Denunciar a ' + nombre));
    d.appendChild(el('p', null,
      'Lo revisa una persona de SeviTime. No se le dice a nadie que has '
      + 'denunciado, ni quién.'));

    const form = el('form');
    MOTIVOS.forEach(function (m, i) {
      const fila = el('label', 'denuncia-motivo');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'motivo';
      radio.value = m[0];
      if (i === 0) radio.required = true;
      fila.append(radio, el('span', null, m[1]));
      form.appendChild(fila);
    });

    const notas = document.createElement('textarea');
    notas.maxLength = 500;
    notas.rows = 3;
    notas.placeholder = 'Cuéntalo si hace falta (opcional)';
    notas.className = 'denuncia-notas';
    notas.setAttribute('aria-label', 'Detalles de la denuncia (opcional)');
    form.appendChild(notas);

    const aviso = el('p', 'perfil-seguir-aviso', '');
    aviso.setAttribute('role', 'status');
    form.appendChild(aviso);

    const acciones = el('div', 'aceptacion-fotos-acciones');
    const cancelar = el('button', null, 'Cancelar');
    cancelar.type = 'button';
    const enviar = el('button', 'primario', 'Enviar denuncia');
    enviar.type = 'submit';
    acciones.append(cancelar, enviar);
    form.appendChild(acciones);
    d.appendChild(form);

    cancelar.addEventListener('click', function () { d.close(); });

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      const marcado = form.querySelector('input[name="motivo"]:checked');
      if (!marcado || !sb()) return;
      enviar.disabled = true;
      cancelar.disabled = true;
      aviso.textContent = 'Enviando…';
      let texto;
      try {
        const { data, error } = await sb().rpc('fn_denunciar_perfil', {
          p_apodo: nombre,
          p_motivo: marcado.value,
          p_notas: notas.value.trim() || null,
        });
        if (error) throw error;
        // Lo mismo si entró y si ya había una pendiente: por dentro son
        // distintas, de cara a quien denuncia no.
        if (data && data.ok) texto = 'Gracias. Una persona de SeviTime lo va a revisar.';
        else if (data && data.error === 'limite_dia') texto = 'Has denunciado mucho hoy. Prueba mañana.';
        else if (data && data.error === 'sin_cuenta') texto = 'Hace falta iniciar sesión.';
        else if (data && (data.error === 'eres_tu' || data.error === 'sin_perfil')) texto = 'Este perfil no se puede denunciar.';
        else texto = 'No se ha podido enviar. Inténtalo más tarde.';
      } catch (_) {
        texto = 'No se ha podido enviar. Inténtalo más tarde.';
      }
      d.close();
      const hueco = document.getElementById('hueco-denunciar');
      if (hueco) {
        const nota = hueco.querySelector('.perfil-seguir-aviso');
        if (nota) nota.textContent = texto;
      }
    });

    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  }

  function entrar() {
    const cliente = sb();
    if (!cliente) return;
    cliente.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }

  window.SeviDenunciar = {
    iniciar(datos, donde) {
      if (!donde || !datos || !datos.nombre) return;
      const nombre = datos.nombre;
      donde.textContent = '';

      const b = el('button', 'perfil-denunciar', 'Denunciar este perfil');
      b.type = 'button';
      const aviso = el('p', 'perfil-seguir-aviso', '');
      aviso.setAttribute('role', 'status');
      donde.append(b, aviso);

      let usuario = null;
      b.addEventListener('click', function () {
        if (!usuario) {
          aviso.textContent = 'Entra con Google para denunciar un perfil. '
            + 'Sin cuenta puedes contarlo en Ajustes → Contactar con SeviTime.';
          entrar();
          return;
        }
        abrirDialogo(nombre);
      });

      // El perfil propio no lleva botón: lo decide `fn_mi_perfil`, igual que
      // en `seguir.js`.
      async function cambioDeSesion(user) {
        usuario = user;
        donde.hidden = false;
        if (!user || !sb()) return;
        try {
          const { data } = await sb().rpc('fn_mi_perfil');
          const fila = (data || [])[0];
          if (fila && fila.nombre_publico === nombre) donde.hidden = true;
        } catch (_) { /* solo se pierde esconderlo en tu propio perfil */ }
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
