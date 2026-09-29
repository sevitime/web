// El respaldo de `lugares_ocultos`: si Supabase falla, la web NO puede
// ponerse a enseñar los sitios ocultos. Corre el `lugares.js` publicado,
// no una copia, con un `fetch` y un `localStorage` de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILA = { nombre_lugar: 'Bar', lat: 37.1867865, lon: -5.7664972,
               osm_type: 'node', osm_id: 11688104007 };

function montar({ falla }) {
  const guardado = new Map();
  const ctx = {
    console,
    localStorage: {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
    },
    fetch: async (url) => {
      if (!String(url).includes('lugares_ocultos')) {
        return { ok: true, json: async () => [] };
      }
      if (falla) throw new Error('Supabase caído');
      return { ok: true, json: async () => [FILA] };
    },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
  return { api: ctx.window.sevitimeLugares, guardado };
}

const sitio = { nombre: 'Bar', lat: 37.1867865, lon: -5.7664972,
                osmType: 'node', osmId: 11688104007 };

test('con Supabase bien, oculta y se guarda la lista', async () => {
  const { api, guardado } = montar({ falla: false });
  const filas = await api.ocultos();
  assert.equal(filas.length, 1);
  assert.ok(api.estaOculto(sitio, filas), 'tiene que ocultarlo');
  assert.ok(guardado.has('sevitime_ocultos'), 'tiene que guardarlo');
});

test('si Supabase falla SIN lista guardada, no puede ocultar', async () => {
  // El límite honesto: en la primera visita no hay nada que recordar.
  const { api } = montar({ falla: true });
  const filas = await api.ocultos();
  assert.equal(filas.length, 0);
});

test('si Supabase falla CON lista guardada, sigue ocultando', async () => {
  // El fallo que esto arregla: antes daba [] y pintaba los ocultos.
  const { api, guardado } = montar({ falla: false });
  await api.ocultos();
  const recordado = guardado.get('sevitime_ocultos');

  const segunda = montar({ falla: true });
  segunda.guardado.set('sevitime_ocultos', recordado);
  const filas = await segunda.api.ocultos();
  assert.equal(filas.length, 1, 'tiene que recuperar la lista de ayer');
  assert.ok(segunda.api.estaOculto(sitio, filas), 'y seguir ocultando');
});
