// Buscar un sitio por lo que es: «heladerías cerca» encuentra Rayas aunque
// no diga «heladería» en el nombre. Los mismos casos que
// `test/utils/que_es_test.dart` en la app, con la misma tabla (`queEs` en el
// bloque CATEGORIAS_LUGARES, generado desde la app).
//
//   node --test tool/que_es.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ctx = { console, window: {}, localStorage: { getItem: () => null, setItem() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
const { queEsDe, casaConBusqueda, aLugar } = ctx.window.sevitimeLugares;

const sitio = (nombre, tipo, cocinas = []) =>
  ({ nombre, tipo, cocinas, direccion: '', lat: 37.39, lon: -5.99 });

test('una pregunta por un tipo se entiende como ese tipo', () => {
  for (const [q, palabra] of [
    ['heladerías', 'heladeria'], ['Helado cerca', 'heladeria'],
    ['una farmacia abierta', 'farmacia'], ['museos de sevilla', 'museo'],
    ['dónde comer', 'restaurante'], ['bares', 'bar'],
  ]) {
    assert.equal(queEsDe(q)?.palabras[0], palabra, q);
  }
});

test('un nombre, dos tipos o solo relleno no son una pregunta por un tipo', () => {
  for (const q of ['Museo de Bellas Artes', 'bar metropolis', 'Heladería Rayas',
    'catedral', 'bar restaurante', 'de la']) {
    assert.equal(queEsDe(q), null, q);
  }
});

test('«heladerías cerca» encuentra la que no lo dice en el nombre', () => {
  assert.equal(casaConBusqueda(sitio('Rayas', 'ice_cream'), 'heladerías cerca'), true);
  assert.equal(casaConBusqueda(sitio('Bar Helado', 'bar'), 'heladerías cerca'), false);
});

test('la cocina también cuenta', () => {
  assert.equal(casaConBusqueda(sitio('Da Vinci', 'restaurant', ['pizza']), 'pizza'), true);
  assert.equal(casaConBusqueda(sitio('Kiyomi', 'restaurant', ['japanese']), 'sushi'), true);
});

test('el nombre y la calle se siguen buscando como antes', () => {
  assert.equal(casaConBusqueda(sitio('Museo de Bellas Artes', 'museum'), 'bellas'), true);
  assert.equal(casaConBusqueda({ ...sitio('Bar X', 'bar'), direccion: 'Calle Feria, 3' }, 'feria'), true);
  assert.equal(casaConBusqueda(sitio('Bar X', 'bar'), 'catedral'), false);
});

test('aLugar guarda la cocina de OSM', () => {
  const p = aLugar({ type: 'node', id: 1, lat: 37.39, lon: -5.99,
    tags: { amenity: 'restaurant', name: 'Da Vinci', cuisine: 'pizza;italian' } });
  assert.deepEqual([...p.cocinas], ['pizza', 'italian']);
});
