// Los kilómetros de una ruta, con los mismos casos que
// `test/utils/paradas_ruta_test.dart` en la app.
//
//   node --test tool/rutas_km.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync('rutas/km.js', 'utf8'), ctx);
const { kmDeRuta, textoKm } = ctx.window.sevitimeRutasKm;

const catedral = { lat: 37.38592, lon: -5.99315 };
const giralda = { lat: 37.38619, lon: -5.99252 };
const torreOro = { lat: 37.38240, lon: -5.99632 };

test('una sola parada no tiene recorrido', () => {
  assert.equal(kmDeRuta([catedral]), 0);
  assert.equal(kmDeRuta([]), 0);
});

test('suma los tramos en orden', () => {
  const km = kmDeRuta([catedral, giralda, torreOro]);
  assert.ok(km > 0.5 && km < 0.7, String(km));
});

test('textoKm como en la app', () => {
  assert.equal(textoKm(0.43), '450 m');
  assert.equal(textoKm(0.04), '50 m');
  assert.equal(textoKm(2.44), '2,4 km');
  assert.equal(textoKm(1.0), '1 km');
  assert.equal(textoKm(12.0), '12 km');
});
