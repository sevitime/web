// Qué paradas de una ruta tienen sello del Pasaporte (14-nov-2026). Los
// mismos casos que `test/services/sellos_en_ruta_test.dart` en la app.
//
//   node --test tool/sellos_ruta.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync('rutas/km.js', 'utf8'), ctx);
vm.runInContext(readFileSync('pasaporte/sellos.js', 'utf8'), ctx);
vm.runInContext(readFileSync('rutas/sellos-ruta.js', 'utf8'), ctx);
const { sellosDeParadas, textoResumenSellos } = ctx.window.sevitimeSellosRuta;

const p = (nombre, lat, lon, tipo) => ({ nombre, lat, lon, tipo });

test('un monumento con sello propio lo tiene; un bar no lleva el genérico', () => {
  const s = sellosDeParadas([
    p('La Giralda', 37.38619, -5.99252, 'attraction'),
    p('El Rinconcillo', 37.39334, -5.98829, 'bar'),
  ]);
  assert.equal(s[0] && s[0].id, 'giralda');
  assert.equal(s[1], null);
});

test('un sello con radio grande sale solo en la parada más cercana', () => {
  const s = sellosDeParadas([
    p('Puente de Isabel II', 37.38633, -6.00239, 'attraction'),
    p('Castillo de San Jorge', 37.38572, -6.00317, 'museum'),
    p('Mercado de Triana', 37.38554, -6.00292, 'attraction'),
  ]);
  assert.equal(s.filter((x) => x && x.id === 'puente_triana').length, 1);
  assert.equal(s[0] && s[0].id, 'puente_triana');
});

test('el resumen, en singular y en plural', () => {
  const giralda = { id: 'giralda' }, alcazar = { id: 'alcazar' };
  assert.equal(textoResumenSellos([giralda, null]), '1 sello del Pasaporte en esta ruta');
  assert.equal(textoResumenSellos([giralda, alcazar]), '2 sellos del Pasaporte en esta ruta');
  assert.equal(textoResumenSellos([null]), '');
});
