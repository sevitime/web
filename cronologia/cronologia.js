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
  // La última visita de ANTES de entrar: entrar ya lo marca todo como visto.
  const vistoAlEntrar = C.leerVisto();

  function fila(item) {
    const el = C.el;
    const li = el('li', 'crono-item');

    const cabecera = C.el('div', 'crono-cabecera');
    cabecera.appendChild(C.avatar(item));
    const quien = C.el('div', 'crono-quien');
    quien.appendChild(C.linea(item));
    // «hace 2 días · Guillena»: el municipio, de un vistazo. Lo resuelve el
    // servidor por coordenadas, así que lo traen todas las entradas del mapa
    // aunque OSM no tenga `addr:city`.
    const cuando = C.el('span', 'crono-cuando',
      C.haceCuanto(item.cuando) +
      (item.municipio ? ' · ' + item.municipio : ''));
    // `municipio` llega resuelto del servidor (`fn_cronologia`), no de
    // `addr:city`: así lo llevan también los pueblos que no lo etiquetan. La
    // app lo pinta igual, en la misma línea de la hora.
    // Publicada desde la última visita: con la lista por la hora real, lo
    // aprobado tarde cae más abajo, y la marca es lo que lo hace encontrable.
    if (C.esNueva(item, vistoAlEntrar)) {
      cuando.appendChild(C.el('span', 'crono-nueva', 'Nueva'));
    }
    quien.appendChild(cuando);
    cabecera.appendChild(quien);
    li.appendChild(cabecera);

    if (item.rating != null) {
      li.appendChild(el('p', 'crono-estrellas', C.estrellas(item.rating)));
    }
    const dicho = C.cita(item);
    if (dicho) li.appendChild(el('p', 'crono-texto', '«' + dicho + '»'));
    // El nombre nuevo de un sitio renombrado va sin comillas: no lo dijo
    // nadie, es un dato.
    const dato = C.detalle(item);
    if (dato) li.appendChild(el('p', 'crono-detalle', dato));
    if (item.foto_url) {
      // La foto se abre sola, como en la ficha del sitio; el enlace al sitio
      // ya está en el nombre. Antes tocarla no hacía nada.
      const enlace = document.createElement('a');
      enlace.className = 'crono-foto-enlace';
      enlace.href = item.foto_url;
      enlace.target = '_blank';
      enlace.rel = 'noopener';
      enlace.setAttribute('aria-label',
        'Ver la foto que puso ' + (item.apodo || 'alguien') + ' en ' + item.sitio);
      const img = document.createElement('img');
      img.className = 'crono-foto';
      img.src = item.foto_url;
      img.alt = '';
      img.loading = 'lazy';
      enlace.appendChild(img);
      li.appendChild(enlace);
    }
    return li;
  }

  // De 40 en 40, con botón, como la lista de Explorar. La app hace lo mismo
  // cargando al llegar al final, que es su costumbre; aquí el botón es la de
  // la web.
  const PAGINA = 40;
  const mas = document.getElementById('btn-mas');
  let cargadas = 0;
  let pidiendo = false;

  function pintar(filas) {
    filas.forEach(function (f) { lista.appendChild(fila(f)); });
    cargadas += filas.length;
    // Una página incompleta es el final de la lista.
    if (mas) mas.hidden = filas.length < PAGINA;
  }

  function siguiente() {
    if (pidiendo) return;
    pidiendo = true;
    if (mas) mas.textContent = 'Cargando…';
    C.pedir(PAGINA, cargadas)
      .then(function (filas) {
        pintar(Array.isArray(filas) ? filas : []);
      })
      // Sin red no es el final de la lista: el botón se queda para volver a
      // intentarlo.
      .catch(function () {})
      .finally(function () {
        pidiendo = false;
        if (mas) mas.textContent = 'Ver más';
      });
  }

  if (mas) mas.addEventListener('click', siguiente);

  C.pedir(PAGINA, 0)
    .then(function (filas) {
      if (!Array.isArray(filas) || !filas.length) {
        estado.textContent = 'Todavía no hay nada que contar. En cuanto alguien ' +
          'reseñe un sitio, añada uno nuevo o corrija algo, saldrá aquí.';
        return;
      }
      // Entrar aquí es haber visto la cronología: al volver a Explorar, el
      // contador de novedades de la tira se apaga.
      C.marcarVisto(C.ultimaPublicacion(filas));
      estado.hidden = true;
      pintar(filas);
    })
    .catch(function () {
      estado.textContent = 'No hemos podido cargarlo. Inténtalo en un momento.';
    });
}());
