// Noticias por días y temas (14-nov-2026). Es la misma regla que
// lib/utils/secciones_noticias.dart en la app, con los mismos casos de prueba
// (tool/secciones_noticias.test.mjs): la web y la app enseñan lo mismo.
//
// Antes eran las 30 últimas en una lista. El tema lo pone el servidor
// (`sync-noticias`) al guardar cada noticia.
(function (raiz) {
  'use strict';

  const DIAS = 7;

  // En el orden de los chips.
  const TEMAS = [
    { id: 'ciudad', etiqueta: 'Ciudad' },
    { id: 'sucesos', etiqueta: 'Sucesos y tribunales' },
    { id: 'planes', etiqueta: 'Planes' },
    { id: 'provincia', etiqueta: 'Provincia' },
  ];
  const IDS = TEMAS.map((t) => t.id);

  // Sin tema (las puestas a mano) o con uno que no se conoce, es Ciudad.
  function temaDe(n) {
    return IDS.indexOf(n.tema) >= 0 ? n.tema : 'ciudad';
  }

  // El día en Sevilla, no en el reloj de quien mira: «hoy» es hoy aquí.
  function diaEnSevilla(fecha) {
    return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
  }

  function enLaSemana(n, ahora) {
    return new Date(n.fecha).getTime() >= ahora.getTime() - DIAS * 864e5;
  }

  function seccionar(noticias, ahora, tema) {
    const hoy = diaEnSevilla(ahora);
    const ayer = diaEnSevilla(new Date(ahora.getTime() - 864e5));
    const grupos = { 'Hoy': [], 'Ayer': [], 'Esta semana': [] };
    noticias
      .slice()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .forEach((n) => {
        if (!enLaSemana(n, ahora)) return;
        if (tema && temaDe(n) !== tema) return;
        const d = diaEnSevilla(n.fecha);
        grupos[d >= hoy ? 'Hoy' : d === ayer ? 'Ayer' : 'Esta semana'].push(n);
      });
    return Object.keys(grupos)
      .filter((k) => grupos[k].length > 0)
      .map((k) => ({ titulo: k, noticias: grupos[k] }));
  }

  // Los temas con alguna noticia de la semana: un chip que lleva a una lista
  // vacía no se enseña.
  function temasCon(noticias, ahora) {
    const hay = new Set(noticias.filter((n) => enLaSemana(n, ahora)).map(temaDe));
    return IDS.filter((id) => hay.has(id));
  }

  raiz.SeviNoticias = { seccionar, temasCon, TEMAS, DIAS };
})(typeof window !== 'undefined' ? window : globalThis);
