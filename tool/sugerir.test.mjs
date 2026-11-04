// Lo que la web manda al sugerir un sitio.
//
// Hasta el 5-nov-2026 mandaba menos que la app, y dos campos de menos tenían
// consecuencias: sin `tapas`, un bar sugerido desde la web no entraba nunca
// en «Dónde tapear»; y con `punto_origen` siempre en `'web'`, quien modera no
// sabía si el punto venía del GPS en la puerta o de una chincheta en el mapa,
// que es justo lo que decide si se fía para plantar el nodo en OSM.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function cargar() {
  const enviado = [];
  const sb = {
    from: () => ({
      insert: (fila) => {
        enviado.push(fila);
        return Promise.resolve({ error: null });
      },
    }),
  };
  const window = {};
  const contexto = vm.createContext({
    window,
    localStorage: { getItem: () => null, setItem: () => {} },
    crypto: { randomUUID: () => 'id-de-prueba' },
    console,
    confirm: () => true,
  });
  vm.runInContext(
    readFileSync(new URL('../sugerir.js', import.meta.url), 'utf8'),
    contexto,
  );
  return { S: window.SeviSugerir, sb, enviado };
}

const base = (sb) => ({
  nombre: 'Bar Pepe',
  tipo: 'bar',
  lat: 37.39,
  lon: -5.99,
  deviceId: 'yo',
  cercanos: [],
  sb,
});

test('las tapas viajan cuando el tipo las admite', async () => {
  const { S, sb, enviado } = cargar();
  const r = await S.enviar({ ...base(sb), tapas: true });
  assert.equal(r.ok, true);
  assert.equal(enviado[0].tapas, true);
});

test('en un tipo que no lleva tapas, el campo no se manda', async () => {
  // En una heladería la pregunta sobra, igual que en la app
  // (`tipoConTapas`: solo bar y restaurante).
  const { S, sb, enviado } = cargar();
  await S.enviar({ ...base(sb), tipo: 'ice_cream', tapas: true });
  assert.equal('tapas' in enviado[0], false);
});

test('sin marcar las tapas tampoco se manda', async () => {
  const { S, sb, enviado } = cargar();
  await S.enviar(base(sb));
  assert.equal('tapas' in enviado[0], false);
});

test('el origen del punto distingue el GPS de la chincheta', async () => {
  const { S, sb, enviado } = cargar();
  await S.enviar({ ...base(sb), puntoOrigen: 'gps' });
  assert.equal(enviado[0].punto_origen, 'gps');

  await S.enviar({ ...base(sb), nombre: 'Bar Dos', puntoOrigen: 'mapa' });
  assert.equal(enviado[1].punto_origen, 'mapa');
});

test('un origen que no existe no se inventa: queda en web', async () => {
  const { S, sb, enviado } = cargar();
  await S.enviar({ ...base(sb), puntoOrigen: 'telepatía' });
  assert.equal(enviado[0].punto_origen, 'web');
});

test('la calidad del fix viaja si el navegador la da', async () => {
  const { S, sb, enviado } = cargar();
  await S.enviar({
    ...base(sb),
    puntoOrigen: 'gps',
    precisionM: 12.5,
    tomadoEl: Date.UTC(2026, 10, 5, 10, 30),
  });
  assert.equal(enviado[0].gps_precision_m, 12.5);
  assert.equal(enviado[0].gps_fix_el, '2026-11-05T10:30:00.000Z');
});

test('una chincheta no manda precisión de GPS', async () => {
  // El punto lo puso una persona con el dedo: no hay fix que medir, y decir
  // que lo hay sería mentirle a quien modera.
  const { S, sb, enviado } = cargar();
  await S.enviar({ ...base(sb), puntoOrigen: 'mapa', precisionM: 12.5 });
  assert.equal('gps_precision_m' in enviado[0], false);
});
