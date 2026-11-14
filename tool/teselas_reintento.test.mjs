// El mapa se quedaba muerto si la PRIMERA petición del .pmtiles fallaba una
// sola vez (14-nov-2026): pmtiles guarda la cabecera fallida para siempre y
// no vuelve a pedirla, así que solo recargar la página lo arreglaba.
// `usarProtocoloTeselas` reintenta con un protocolo nuevo antes de rendirse.
//
//   node --test tool/teselas_reintento.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function montar(fallosAntesDeIr) {
  let creados = 0;
  let pendientes = fallosAntesDeIr;
  const ctx = {
    window: {},
    setTimeout,
    pmtiles: {
      Protocol: class {
        constructor() { creados++; }
        tile() {
          if (pendientes > 0) { pendientes--; return Promise.reject(new TypeError('Failed to fetch')); }
          return Promise.resolve({ data: 'ok' });
        }
      },
    },
    maplibregl: { addProtocol(nombre, fn) { ctx.manejador = fn; } },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('mapa/estilo-mapa.js', 'utf8'), ctx);
  ctx.window.sevitimeTeselas.esperaReintentoMs = 1;
  vm.runInContext('usarProtocoloTeselas()', ctx);
  return { ctx, creados: () => creados };
}

const pedir = (ctx, abortado = false) =>
  ctx.manejador({ url: 'pmtiles://x', type: 'json' }, { signal: { aborted: abortado } });

test('un fallo suelto se reintenta solo y el mapa carga', async () => {
  const { ctx, creados } = montar(1);
  assert.deepEqual({ ...(await pedir(ctx)) }, { data: 'ok' });
  assert.equal(creados(), 2, 'un protocolo nuevo para el reintento');
  assert.equal(ctx.window.sevitimeTeselas.fallo(), false);
});

test('si sigue fallando, se rinde y avisa', async () => {
  const { ctx } = montar(99);
  await assert.rejects(pedir(ctx));
  assert.equal(ctx.window.sevitimeTeselas.fallo(), true);
});

test('una petición que cancela el propio mapa no es un fallo ni se reintenta', async () => {
  const { ctx, creados } = montar(1);
  await assert.rejects(pedir(ctx, true));
  assert.equal(creados(), 1);
  assert.equal(ctx.window.sevitimeTeselas.fallo(), false);
});
