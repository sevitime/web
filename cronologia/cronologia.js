// La cronología: lo que va pasando en SeviTime, con nombre y apellidos.
//
// Las reseñas de la gente, sus fotos y los sitios que añaden, en orden. Es
// lo mismo que ya se ve repartido por las fichas de cada sitio, junto y por
// fecha: la idea es que al abrirlo se note que esto lo mueve gente.
//
// Lo que decide qué sale está en el servidor (`fn_cronologia`), no aquí:
// solo lo aprobado, solo quien tiene apodo y solo quien no ha pedido salirse
// de las listas públicas. Ver `docs/sql/cronologia.sql` en el repo de la app.
//
// No se puede etiquetar a nadie, y es a propósito: que una persona publique
// dónde estuvo otra es dato de un tercero.
(function () {
  'use strict';

  const lista = document.getElementById('lista');
  const estado = document.getElementById('estado');
  if (!lista) return;

  const C = window.SeviCrono;

  function fila(item) {
    const el = C.el;
    const li = el('li', 'crono-item');

    const cabecera = C.el('div', 'crono-cabecera');
    cabecera.appendChild(C.avatar(item));
    const quien = C.el('div', 'crono-quien');
    quien.appendChild(C.linea(item));
    quien.appendChild(C.el('span', 'crono-cuando', C.haceCuanto(item.cuando)));
    cabecera.appendChild(quien);
    li.appendChild(cabecera);

    if (item.rating != null) {
      li.appendChild(el('p', 'crono-estrellas', C.estrellas(item.rating)));
    }
    if (item.texto) li.appendChild(el('p', 'crono-texto', '«' + item.texto + '»'));
    if (item.foto_url) {
      const img = document.createElement('img');
      img.className = 'crono-foto';
      img.src = item.foto_url;
      img.alt = 'Foto de ' + item.sitio + ', por ' + item.apodo;
      img.loading = 'lazy';
      li.appendChild(img);
    }
    return li;
  }

  C.pedir(40)
    .then(function (filas) {
      if (!Array.isArray(filas) || !filas.length) {
        estado.textContent = 'Todavía no hay nada que contar. En cuanto alguien ' +
          'reseñe un sitio o añada uno nuevo, saldrá aquí.';
        return;
      }
      estado.hidden = true;
      filas.forEach(function (f) { lista.appendChild(fila(f)); });
    })
    .catch(function () {
      estado.textContent = 'No hemos podido cargarlo. Inténtalo en un momento.';
    });
}());
