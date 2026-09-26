// Pruebas de sonMismoLugar, juntar y estaOculto en lugares.js. Son los MISMOS
// casos que test/services/duplicate_check_service_test.dart en la app: si
// cambias uno, cambia el otro.
//
//   node --test tool/mismo_lugar.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../lugares.js');
const { sonMismoLugar, juntar, estaOculto } = globalThis.sevitimeLugares;

const aqui = (nombre) => ({ nombre, lat: 37.4224, lon: -5.9855 });
const cerca = (nombre) => ({ nombre, lat: 37.4225, lon: -5.9856 });
const mismo = (a, b) => sonMismoLugar(aqui(a), cerca(b));

test('los casos del 24-sep-2026', () => {
  assert.equal(mismo('C.D Nemo', 'CD Demo'), true);
  assert.equal(mismo('Cafetería Kimera', 'Quimera'), true);
});

test('nombres cortos o distintos no se juntan', () => {
  assert.equal(mismo('Bar Pepe', 'Bar Pepa'), false);
  assert.equal(mismo('Bar Paco', 'Bar Pepe'), false);
  assert.equal(mismo('La Bodeguita', 'El Tremendo'), false);
});

test('lejos, aunque se llamen igual, no', () => {
  assert.equal(
    sonMismoLugar({ nombre: 'CD Demo', lat: 37.42, lon: -5.98 },
      { nombre: 'CD Demo', lat: 37.43, lon: -5.98 }),
    false);
});

test('juntar: una sola tarjeta, la de OSM, completada con el alta', () => {
  const osm = { nombre: 'Burger Up!', lat: 37.3996386, lon: -6.0474193,
    telefono: '+34643006876', web: '', horario: '', osmId: 1 };
  const alta = { nombre: 'Burger Up!', lat: 37.3996622, lon: -6.0474112,
    telefono: '643 00 68 76', web: 'https://ejemplo.es', horario: '' };
  const todos = juntar([osm], [alta]);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].telefono, '+34643006876');
  assert.equal(todos[0].web, 'https://ejemplo.es');
});

test('juntar: un alta que OSM no tiene entra como sitio nuevo', () => {
  const todos = juntar([], [{ nombre: 'Terraza Bonobo', lat: 37.4, lon: -5.99 }]);
  assert.equal(todos.length, 1);
});

test('oculto por nombre y sitio; el vecino que se llama igual, no', () => {
  const fila = { nombre_lugar: 'Bar', lat: 37.1867865, lon: -5.7664972,
    osm_type: 'node', osm_id: 11688104007 };
  assert.equal(estaOculto({ nombre: 'Bar', lat: 37.1867865, lon: -5.7664972 }, [fila]), true);
  assert.equal(estaOculto({ nombre: 'Bar', lat: 37.2, lon: -5.7 }, [fila]), false);
  assert.equal(estaOculto({ nombre: 'Bar', lat: 37.19, lon: -5.77,
    osmType: 'node', osmId: 11688104007 }, [fila]), true);
  assert.equal(estaOculto({ nombre: 'La Paraíta Los Militares', lat: 37.1867865,
    lon: -5.7664972 }, [fila]), false);
});

test('un alta encima de un oculto se queda (La Paraíta sobre el «Bar»)', () => {
  const bar = { nombre: 'Bar', lat: 37.1867865, lon: -5.7664972, osmType: 'node', osmId: 11688104007 };
  const paraita = { nombre: 'La Paraíta Los Militares', lat: 37.1867865, lon: -5.7664972 };
  const fila = { nombre_lugar: 'Bar', lat: 37.1867865, lon: -5.7664972, osm_type: 'node', osm_id: 11688104007 };
  const visible = (p) => !estaOculto(p, [fila]);
  const todos = juntar([bar].filter(visible), [paraita]).filter(visible);
  assert.deepEqual(todos.map((p) => p.nombre), ['La Paraíta Los Militares']);
});
