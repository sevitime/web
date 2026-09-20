// Navegación compartida: en móvil conserva solo marca, acceso y un botón de
// menú; en escritorio los enlaces se muestran siempre desde CSS.
(function () {
  var acciones = document.querySelector('.nav-acciones');
  if (!acciones) return;

  var boton = acciones.querySelector('.nav-menu-toggle');
  if (!boton) return;

  function cerrar() {
    acciones.classList.remove('menu-abierto');
    boton.setAttribute('aria-expanded', 'false');
  }

  boton.addEventListener('click', function () {
    var abierto = acciones.classList.toggle('menu-abierto');
    boton.setAttribute('aria-expanded', String(abierto));
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      cerrar();
      boton.focus();
    }
  });

  document.addEventListener('click', function (event) {
    if (!acciones.contains(event.target)) cerrar();
  });
}());
