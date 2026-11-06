// «Qué pasa»: las últimas tres cosas, en la portada de Explorar.
//
// VA LA PRIMERA, como la tarjeta de la app (3-nov-2026). Una sola entrada
// parecía que no había nada más y no invitaba a entrar; tres filas y el «Ver
// todo» dicen que esto se mueve sin inventar actividad.
//
// Si ha salido algo desde la última visita lleva un contador al lado del
// título. Es local (localStorage) y se apaga al abrir `/cronologia/`, sin
// pedir permiso de notificaciones.
//
// POR QUÉ UNA TIRA Y NO LA CRONOLOGÍA ENTERA. Medido el mismo día: siete
// entradas en catorce días, con nueve días a cero. Una pantalla de novedades
// que enseña lo mismo tres días seguidos no dice «esto está vivo», dice «aquí
// no hay nadie», y eso es peor que no tenerla. Tres líneas con su «hace 3
// días» envejecen bien; una pantalla entera vacía, no.
//
// La pantalla entera sigue teniendo sentido cuando haya cinco o más entradas
// al día de forma sostenida; hoy la media es 0,5.
//
// Lleva al lado el acceso al cuadro de honor: la gente que busca «quiénes
// son los demás» lo buscaba en Tu perfil, donde estaba escondido.
(function () {
  'use strict';

  const hueco = document.getElementById('hueco-crono');
  if (!hueco || !window.SeviCrono) return;
  const C = window.SeviCrono;

  C.pedir(40).then(function (filas) {
    if (!Array.isArray(filas) || !filas.length) return;

    C.inicializarVisto(filas);
    const pendientes = C.nuevas(filas);

    const sec = C.el('section', 'tira-crono');

    const cabecera = C.el('div', 'tira-crono-cabecera');
    const titulo = C.el('div', 'tira-crono-titulo');
    titulo.appendChild(C.el('h2', null, 'Qué pasa'));
    let contador = null;
    if (pendientes > 0) {
      contador = C.el('span', 'tira-crono-nuevas',
        pendientes + (pendientes === 1 ? ' nueva' : ' nuevas'));
      titulo.appendChild(contador);
    }
    cabecera.appendChild(titulo);
    const todo = C.el('a', 'tira-crono-todo', 'Ver todo');
    todo.href = '/cronologia/';
    cabecera.appendChild(todo);
    sec.appendChild(cabecera);

    const lista = C.el('ul', 'tira-crono-lista');
    filas.slice(0, 3).forEach(function (item) {
      const li = C.el('li', 'tira-crono-item');
      li.appendChild(C.avatar(item));
      const txt = C.el('div', 'tira-crono-texto');
      txt.appendChild(C.linea(item, 'tira-crono-linea'));
      txt.appendChild(C.el('span', 'crono-cuando', C.haceCuanto(item.cuando)));
      li.appendChild(txt);
      lista.appendChild(li);
    });
    sec.appendChild(lista);

    const honor = C.el('a', 'tira-crono-honor', 'Ver el cuadro de honor');
    honor.href = '/ranking/';
    sec.appendChild(honor);

    hueco.appendChild(sec);

    // Al volver con el botón atrás, el navegador puede restaurar esta página
    // tal cual (bfcache). Si mientras tanto se abrió la cronología, el
    // contador ya está visto y sobra.
    window.addEventListener('pageshow', function () {
      if (contador && C.nuevas(filas) === 0) {
        contador.remove();
        contador = null;
      }
    });
  // Sin red, la tira no sale: como cuando no hay nada, pero sin decirlo.
  }).catch(function () {});
}());
