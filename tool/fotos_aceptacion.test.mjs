// El aviso de fotos con personas se recuerda en el dispositivo y no debe
// repetirse. Se prueba la parte que no necesita DOM.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function cargar(valorInicial = null) {
  const datos = new Map();
  if (valorInicial) datos.set('sevi-fotos-aceptacion', valorInicial);
  const localStorage = {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
  };
  const window = {};
  const contexto = vm.createContext({ window, localStorage, console });
  vm.runInContext(
    readFileSync(new URL('../fotos/aceptacion.js', import.meta.url), 'utf8'),
    contexto,
  );
  return { F: window.SeviFotos, datos };
}

test('la versión coincide con la que espera la app', () => {
  const { F } = cargar();
  assert.equal(F.version, 'fotos-2026-11-03');
});

test('sin aceptación previa, asegurar no devuelve true por la espalda', async () => {
  const { F } = cargar();
  assert.equal(F.yaAceptada(), false);
});

test('con la versión guardada, no se vuelve a preguntar', async () => {
  const { F } = cargar('fotos-2026-11-03');
  assert.equal(F.yaAceptada(), true);
  assert.equal(await F.asegurar(), true);
});
