// «Qué pasa»: las últimas tres cosas, en la portada de Explorar.
//
// POR QUÉ UNA TIRA Y NO LA CRONOLOGÍA ENTERA. Medido el 3-nov-2026: siete
// entradas en catorce días, con nueve días a cero. Una pantalla de novedades
// que enseña lo mismo tres días seguidos no dice «esto está vivo», dice «aquí
// no hay nadie», y eso es peor que no tenerla. Tres líneas con su «hace 3
// días» envejecen bien; una pantalla entera vacía, no.
//
// Cuando haya cinco o más entradas al día de forma sostenida, esto se gana
// el primer puesto o una pestaña propia. Hoy la media es 0,5.
//
// Lleva al lado el acceso al cuadro de honor: la gente que busca «quiénes
// son los demás» lo buscaba en Tu perfil, donde estaba escondido.
(function () {
  'use strict';

  const hueco = document.getElementById('hueco-crono');
  if (!hueco || !window.SeviCrono) return;
  const C = window.SeviCrono;

  C.pedir(3).then(function (filas) {
    if (!Array.isArray(filas) || !filas.length) return;

    const sec = C.el('section', 'tira-crono');

    const cabecera = C.el('div', 'tira-crono-cabecera');
    cabecera.appendChild(C.el('h2', null, 'Qué pasa'));
    const todo = C.el('a', 'tira-crono-todo', 'Ver todo');
    todo.href = '/cronologia/';
    cabecera.appendChild(todo);
    sec.appendChild(cabecera);

    const lista = C.el('ul', 'tira-crono-lista');
    filas.forEach(function (item) {
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
  });
}());
