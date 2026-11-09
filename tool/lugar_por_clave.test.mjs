// Un enlace a un sitio que aún no está en la foto: la web pregunta a Overpass
// una vez, en 50 m, en vez de decir «no encontrado». Es el mismo atajo que la
// app (ver `PlacesService.getPlaceByKey`). Lo que se prueba aquí es el camino
// de `lugares.js`, sin navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function montar({ elements = [], ok = true } = {}) {
  let cuerpo = null;
  const ctx = {
    console,
    window: {},
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async function (url, init) {
      if (String(url).includes('overpass')) {
        cuerpo = init && init.body;
        if (!ok) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => ({ elements: elements }) };
      }
      return { ok: true, json: async () => [] };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
  return { api: ctx.window.sevitimeLugares, cuerpo: function () { return cuerpo; } };
}

test('si la foto no lo tiene, se busca en Overpass por la clave', async () => {
  // Un sitio recién aparecido en OSM: sale en «Qué pasa» a los 30 minutos,
  // pero la foto es de la madrugada. Antes el enlace daba «no encontrado».
  const { api, cuerpo } = montar({
    elements: [{
      type: 'node', id: 1, lat: 37.389, lon: -5.984,
      tags: { name: 'Discoteca Nueva', amenity: 'nightclub' },
    }],
  });

  const p = await api.buscarPorClave('37.38900_-5.98400');

  assert.equal(p.nombre, 'Discoteca Nueva');
  assert.equal(p.tipo, 'nightclub');
  assert.equal(p.osmType, 'node');
  assert.match(cuerpo(), /around:50,37\.389,-5\.984/);
});

test('si el elemento no cae en la clave, no se inventa un sitio', async () => {
  const { api } = montar({
    elements: [{
      type: 'node', id: 2, lat: 37.4, lon: -5.99,
      tags: { name: 'Otro sitio', amenity: 'bar' },
    }],
  });

  assert.equal(await api.buscarPorClave('37.38900_-5.98400'), null);
});

test('si todos los espejos fallan, no hay sitio', async () => {
  const { api } = montar({ ok: false });

  assert.equal(await api.buscarPorClave('37.38900_-5.98400'), null);
});

test('una clave que no es una clave no gasta una consulta', async () => {
  const { api, cuerpo } = montar();

  assert.equal(await api.buscarPorClave('no-es-una-clave'), null);
  assert.equal(cuerpo(), null);
});
