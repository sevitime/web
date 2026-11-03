// El contador de novedades de «Qué pasa» es local, y de él depende que la
// tira de Explorar enseñe o no el número. Se prueban los tres casos que
// importan sin navegador: primera visita, cosas nuevas y que la marca no
// retroceda al volver a una entrada vieja.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function cargar() {
  const datos = new Map();
  const localStorage = {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
  const window = {};
  const contexto = vm.createContext({ window, localStorage, console });
  vm.runInContext(
    readFileSync(new URL('../cronologia/comun.js', import.meta.url), 'utf8'),
    contexto,
  );
  return { C: window.SeviCrono, datos };
}

const dia = (iso) => ({ cuando: iso });

test('la primera visita siembra la marca y no cuenta nada como nuevo', () => {
  const { C } = cargar();
  const filas = [dia('2026-11-03T10:00:00Z'), dia('2026-11-02T10:00:00Z')];

  C.inicializarVisto(filas);

  assert.equal(C.leerVisto(), '2026-11-03T10:00:00.000Z');
  assert.equal(C.nuevas(filas), 0);
});

test('solo cuenta lo posterior a la última visita', () => {
  const { C } = cargar();
  C.marcarVisto('2026-11-03T10:00:00Z');

  assert.equal(C.nuevas([
    dia('2026-11-03T11:00:00Z'),
    dia('2026-11-03T10:30:00Z'),
    dia('2026-11-03T09:00:00Z'),
  ]), 2);
});

test('la marca no retrocede al marcar una entrada vieja', () => {
  const { C } = cargar();
  C.marcarVisto('2026-11-03T10:00:00Z');
  C.marcarVisto('2026-11-01T10:00:00Z');

  assert.equal(C.leerVisto(), '2026-11-03T10:00:00.000Z');
});

test('sin localStorage, el contador se queda a cero y no revienta', () => {
  const datos = new Map();
  const localStorage = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('bloqueado'); },
  };
  const window = {};
  const contexto = vm.createContext({ window, localStorage, console });
  vm.runInContext(
    readFileSync(new URL('../cronologia/comun.js', import.meta.url), 'utf8'),
    contexto,
  );
  const C = window.SeviCrono;

  C.inicializarVisto([dia('2026-11-03T10:00:00Z')]);

  assert.equal(C.nuevas([dia('2026-11-04T10:00:00Z')]), 0);
  assert.equal(datos.size, 0);
});
