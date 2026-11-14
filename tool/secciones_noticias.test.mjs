// Pruebas de noticias/secciones.js. Son los MISMOS casos que
// test/utils/secciones_noticias_test.dart en la app: si cambias uno, cambia
// el otro.
//
//   node --test tool/secciones_noticias.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../noticias/secciones.js');
const { seccionar, temasCon, TEMAS } = globalThis.SeviNoticias;

// Sábado 14-nov-2026, 10:00 en Sevilla (09:00 UTC).
const ahora = new Date('2026-11-14T09:00:00Z');
const n = (titulo, fecha, tema = 'ciudad') => ({ titulo, fecha, tema });
const resumen = (ss) => ss.map((s) => `${s.titulo}: ${s.noticias.map((x) => x.titulo).join(',')}`);

test('hoy, ayer y esta semana, por día de Sevilla y lo último primero', () => {
  const ss = seccionar([
    n('a', '2026-11-14T06:00:00Z'),
    n('b', '2026-11-14T08:00:00Z'),
    // Las 23:50 de ayer en Sevilla son las 22:50 UTC: ayer.
    n('c', '2026-11-13T22:50:00Z'),
    n('d', '2026-11-11T11:00:00Z'),
  ], ahora);
  assert.deepEqual(resumen(ss), ['Hoy: b,a', 'Ayer: c', 'Esta semana: d']);
});

test('pasada la medianoche de Sevilla ya es hoy, aunque en UTC sea ayer', () => {
  const ss = seccionar([n('madrugada', '2026-11-13T23:30:00Z')], ahora);
  assert.deepEqual(resumen(ss), ['Hoy: madrugada']);
});

test('lo de hace más de siete días no sale', () => {
  const ss = seccionar([n('vieja', '2026-11-06T11:00:00Z'), n('hoy', '2026-11-14T07:00:00Z')], ahora);
  assert.deepEqual(resumen(ss), ['Hoy: hoy']);
});

test('una sección sin noticias no sale', () => {
  assert.deepEqual(resumen(seccionar([n('d', '2026-11-12T11:00:00Z')], ahora)), ['Esta semana: d']);
});

test('con un tema elegido, solo ese', () => {
  const ss = seccionar([
    n('juicio', '2026-11-14T07:00:00Z', 'sucesos'),
    n('obra', '2026-11-14T08:00:00Z'),
  ], ahora, 'sucesos');
  assert.deepEqual(resumen(ss), ['Hoy: juicio']);
});

test('sin tema, o con uno que no se conoce, es Ciudad', () => {
  const ss = seccionar([n('x', '2026-11-14T07:00:00Z', null), n('y', '2026-11-14T08:00:00Z', 'deportes')], ahora, 'ciudad');
  assert.deepEqual(resumen(ss), ['Hoy: y,x']);
});

test('los temas que tienen algo esta semana, en el orden de los chips', () => {
  assert.deepEqual(temasCon([
    n('x', '2026-11-14T07:00:00Z', 'provincia'),
    n('y', '2026-11-13T07:00:00Z', 'sucesos'),
    n('vieja', '2026-11-01T07:00:00Z', 'planes'),
  ], ahora), ['sucesos', 'provincia']);
});

test('cada tema tiene su nombre para el chip', () => {
  assert.deepEqual(TEMAS.map((t) => t.etiqueta), ['Ciudad', 'Sucesos y tribunales', 'Planes', 'Provincia']);
});

test('el lunes del cambio de hora, pasada la medianoche, lo del domingo es «Ayer»', () => {
  // Lunes 29-mar-2027 a las 00:30 en Sevilla (28-mar 22:30 UTC). Restando
  // 24 h caía el sábado, porque el domingo tuvo 23 horas.
  const ss = seccionar([n('domingo', '2027-03-28T10:00:00Z')], new Date('2027-03-28T22:30:00Z'));
  assert.deepEqual(resumen(ss), ['Ayer: domingo']);
});
