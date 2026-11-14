// El corazón de guardar y de «me gusta» da un salto y vibra al marcarse
// (14-nov-2026), como en la app (`IconoQueLate`).
//
//   node --test tool/latir.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function montar({ reducir = false } = {}) {
  const vibraciones = [];
  const ctx = {
    console, window: {}, localStorage: { getItem: () => null, setItem() {} },
    navigator: { vibrate: (ms) => { vibraciones.push(ms); return true; } },
    matchMedia: (q) => ({ matches: reducir && /reduced-motion/.test(q) }),
  };
  ctx.window.matchMedia = ctx.matchMedia;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
  return { latir: ctx.window.sevitimeLugares.latir, vibraciones };
}

function elemento() {
  const clases = new Set();
  return {
    clases,
    classList: { add: (c) => clases.add(c), remove: (c) => clases.delete(c) },
    get offsetWidth() { return 10; },
  };
}

test('salta y vibra', () => {
  const { latir, vibraciones } = montar();
  const e = elemento();
  latir(e);
  assert.ok(e.clases.has('late-ahora'));
  assert.deepEqual(vibraciones, [12]);
});

test('con «reducir movimiento», solo vibra', () => {
  const { latir, vibraciones } = montar({ reducir: true });
  const e = elemento();
  latir(e);
  assert.equal(e.clases.has('late-ahora'), false);
  assert.deepEqual(vibraciones, [12]);
});

test('sin elemento no rompe nada', () => {
  const { latir } = montar();
  assert.doesNotThrow(() => latir(null));
});
