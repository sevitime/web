// Un icono por dato en «Qué pasa» (14-nov-2026), como `iconoDeCronologia` en
// la app: los cambios del mapa llevaban todos el mismo lápiz.
//
//   node --test tool/cronologia_iconos.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const window = {};
const ctx = vm.createContext({
  window, console, document: { createElement: () => ({ setAttribute() {}, style: {} }) },
  localStorage: { getItem: () => null, setItem: () => {} },
  fetch: () => Promise.resolve({ ok: false }),
});
vm.runInContext(readFileSync('cronologia/comun.js', 'utf8'), ctx);
const { emojiDe } = window.SeviCrono;

test('cada dato del mapa lleva el suyo', () => {
  const esperados = {
    horario: '🕒', telefono: '📞', web: '🌐', terraza: '☂️',
    cocina: '🍽️', accesibilidad: '♿', historia: '📜', direccion: '📍',
  };
  for (const [campo, e] of Object.entries(esperados)) {
    assert.equal(emojiDe({ tipo: 'lugar_datos', texto: campo }), e, campo);
  }
});

test('las aportaciones de la gente, con tilde, igual', () => {
  assert.equal(emojiDe({ tipo: 'dato', texto: 'teléfono' }), '📞');
  assert.equal(emojiDe({ tipo: 'dato', texto: 'Horario' }), '🕒');
});

test('varios datos o uno desconocido: el general', () => {
  assert.equal(emojiDe({ tipo: 'lugar_datos', texto: 'horario, terraza' }), '✏️');
  assert.equal(emojiDe({ tipo: 'lugar_datos', texto: 'wifi' }), '✏️');
  assert.equal(emojiDe({ tipo: 'resena' }), '⭐');
  assert.equal(emojiDe({ tipo: 'raro' }), null);
});
