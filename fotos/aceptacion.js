// Aceptación única del aviso de fotos con otras personas.
//
// El modelo es el de las redes sociales: quien sube la foto declara que tiene
// permiso de las personas identificables, y SeviTime la retira si alguna lo
// pide. No se verifica el permiso. Se pide una vez por cuenta y versión, y se
// recuerda también en el dispositivo para no repetir el aviso en cada foto.
(function () {
  'use strict';

  // Tiene que coincidir con `AceptacionFotosService.version` en la app.
  const VERSION = 'fotos-2026-11-03';
  const CLAVE = 'sevi-fotos-aceptacion';

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function yaAceptada() {
    try { return localStorage.getItem(CLAVE) === VERSION; } catch (_) { return false; }
  }

  function guardarLocal() {
    try { localStorage.setItem(CLAVE, VERSION); } catch (_) { /* sin storage */ }
  }

  function cliente() {
    return window.SEVI && window.SEVI.sb ? window.SEVI.sb : null;
  }

  async function usuario() {
    const sb = cliente();
    if (!sb) return null;
    try {
      const r = await sb.auth.getSession();
      return r && r.data && r.data.session ? r.data.session.user : null;
    } catch (_) { return null; }
  }

  async function aceptadaEnCuenta() {
    const sb = cliente();
    if (!sb) return false;
    const u = await usuario();
    if (!u) return false;
    try {
      const { data } = await sb.from('aceptaciones_fotos')
        .select('version')
        .eq('user_id', u.id)
        .eq('version', VERSION)
        .limit(1);
      return Array.isArray(data) && data.length > 0;
    } catch (_) { return false; }
  }

  async function guardarEnCuenta() {
    const sb = cliente();
    if (!sb) return;
    const u = await usuario();
    if (!u) return;
    try {
      await sb.from('aceptaciones_fotos')
        .upsert({ user_id: u.id, version: VERSION },
          { onConflict: 'user_id,version' });
    } catch (_) { /* best-effort: el registro local ya está puesto */ }
  }

  function mostrar() {
    return new Promise(function (resolver) {
      const dlg = el('dialog', 'aceptacion-fotos');
      const titulo = el('h2', null, 'Fotos con otras personas');
      titulo.id = 'aceptacion-fotos-titulo';
      dlg.setAttribute('aria-labelledby', 'aceptacion-fotos-titulo');
      dlg.appendChild(titulo);

      const texto = el('p', null,
        'Si en la foto se reconoce a alguien, necesitas su permiso para ' +
        'publicarla. Al continuar declaras que lo tienes, que no vas a ' +
        'etiquetar a nadie, que aceptas que publiquemos la foto junto a tu ' +
        'contenido y que la retiremos si esa persona lo pide.');
      dlg.appendChild(texto);

      const enlace = el('a', null, 'Leer la política de privacidad');
      enlace.href = '/privacidad/';
      enlace.target = '_blank';
      enlace.rel = 'noopener';
      dlg.appendChild(enlace);

      const acciones = el('div', 'aceptacion-fotos-acciones');
      const cancelar = el('button', 'secundario', 'Cancelar');
      cancelar.type = 'button';
      const aceptar = el('button', 'primario', 'Acepto y continúo');
      aceptar.type = 'button';
      acciones.append(cancelar, aceptar);
      dlg.appendChild(acciones);

      let cerrado = false;
      function cerrar(valor) {
        if (cerrado) return;
        cerrado = true;
        if (dlg.open) dlg.close();
        dlg.remove();
        resolver(valor);
      }

      cancelar.addEventListener('click', function () { cerrar(false); });
      aceptar.addEventListener('click', function () {
        // El registro local se hace ya para no perder la activación del
        // usuario que abre el selector de archivos; el de la cuenta va detrás.
        guardarLocal();
        cerrar(true);
        guardarEnCuenta();
      });
      dlg.addEventListener('cancel', function (ev) {
        ev.preventDefault();
        cerrar(false);
      });

      document.body.appendChild(dlg);
      dlg.showModal();
    });
  }

  async function asegurar() {
    if (yaAceptada()) return true;
    if (await aceptadaEnCuenta()) {
      guardarLocal();
      return true;
    }
    return mostrar();
  }

  window.SeviFotos = { version: VERSION, yaAceptada, asegurar };
}());
