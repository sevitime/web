// La nota de las reseñas solo va en tipos que Google admite: los negocios.
// Search Console dio error (25-nov-2026) con la nota colgada de un `Place`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { console, window: {}, AbortController, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => [] }) };
vm.createContext(ctx);
vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
const { tipoSchemaDe } = ctx.window.sevitimeLugares;

test('los negocios llevan su tipo y admiten nota', () => {
  assert.deepEqual({ ...tipoSchemaDe('Restaurante') }, { tipo: 'Restaurant', nota: true });
  assert.deepEqual({ ...tipoSchemaDe('Bar') }, { tipo: 'BarOrPub', nota: true });
  assert.deepEqual({ ...tipoSchemaDe(' Café ') }, { tipo: 'CafeOrCoffeeShop', nota: true });
});

test('museos, iglesias y lo desconocido se quedan en Place y sin nota', () => {
  for (const e of ['Museo', 'Iglesia', 'Monumento', 'Parque', 'Sitio', '', undefined]) {
    assert.deepEqual({ ...tipoSchemaDe(e) }, { tipo: 'Place', nota: false }, String(e));
  }
});
