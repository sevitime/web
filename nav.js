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

// La llegada de una lista: la primera vez que se pinta, sus tarjetas entran
// escalonadas (estilo.css, `.llega`). Solo la primera: Rutas y el cuadro de
// honor repintan la lista entera al filtrar, al elegir una ruta o al entrar
// con Google, y que todo volviera a aparecer en cada toque sería un mareo.
window.SeviLlegada = function (contenedor) {
  if (!contenedor || contenedor.dataset.llego) return;
  contenedor.dataset.llego = '1';
  contenedor.removeAttribute('aria-busy');
  contenedor.classList.add('llega');
  setTimeout(function () { contenedor.classList.remove('llega'); }, 1500);
};
