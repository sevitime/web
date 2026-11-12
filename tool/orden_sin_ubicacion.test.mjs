// Qué enseña Explorar primero cuando no se sabe dónde está quien mira.
// Los mismos casos que `test/providers/orden_sin_ubicacion_test.dart` en la
// app: las dos listas tienen que abrir igual.
//
//   node --test tool/orden_sin_ubicacion.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ctx = { console, window: {}, localStorage: { getItem: () => null, setItem() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
vm.runInContext(readFileSync('pasaporte/sellos.js', 'utf8'), ctx);
const { ordenarSinUbicacion } = ctx.window.sevitimeLugares;
const sellos = ctx.window.sevitimeSellos;
const visitables = ctx.window.sevitimeTiposVisitables;

const sitio = (nombre, tipo, extra = {}) =>
  ({ nombre, tipo, lat: 37.40, lon: -5.95, conArticulo: false, ...extra });
const orden = (lista, notas = {}) =>
  ordenarSinUbicacion(lista, (p) => notas[p.nombre] ?? 3.6, sellos, visitables)
    .map((p) => p.nombre);

test('entre monumentos sin votos manda lo conocido, no el abecedario ni la distancia', () => {
  const lista = orden([
    sitio('"Siin título"', 'monument'),
    sitio('A Cristobal Colon', 'memorial'),
    sitio('Torre de Don Fadrique', 'monument', { conArticulo: true }),
    sitio('Catedral de Sevilla', 'place_of_worship',
      { lat: 37.3858, lon: -5.9931, conArticulo: true }),
    // Un banco de azulejos de la Plaza de España: dentro del radio de su
    // sello, pero no es la plaza.
    sitio('Albacete', 'artwork', { lat: 37.3772, lon: -5.9869 }),
  ]);
  assert.equal(lista[0], 'Catedral de Sevilla');
  assert.equal(lista[1], 'Torre de Don Fadrique');
  assert.ok(lista.indexOf('Albacete') > 1);
});

test('un monumento va antes que un bar, aunque el bar tenga mejor nota', () => {
  const lista = orden([
    sitio('Bodega', 'bar'),
    sitio('Convento', 'monument'),
    sitio('Cajero', 'atm'),
  ], { Bodega: 4.8 });
  assert.deepEqual(lista, ['Convento', 'Bodega', 'Cajero']);
});

test('dentro de la misma clase y fama, la nota', () => {
  const lista = orden([sitio('Bar A', 'bar'), sitio('Bar B', 'bar')], { 'Bar B': 4.5 });
  assert.deepEqual(lista, ['Bar B', 'Bar A']);
});

test('no cambia la lista que recibe', () => {
  const original = [sitio('Z', 'bar'), sitio('A', 'bar')];
  orden(original);
  assert.equal(original[0].nombre, 'Z');
});
