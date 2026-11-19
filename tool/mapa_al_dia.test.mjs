// Lo que «Qué pasa» anuncia después de la foto (altas y renombrados) se
// aplica encima de ella, igual que `MapaAlDiaService` en la app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function api() {
  const ctx = {
    console, window: {}, AbortController, setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, json: async () => [] }),
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
  return ctx.window.sevitimeLugares;
}

const barPepe = {
  type: 'node', id: 1, lat: 37.3891, lon: -5.9845,
  tags: { name: 'Guadalquivir', amenity: 'pub', phone: '954000000' },
};
const renombrado = {
  clase: 'nombre', osm_type: 'node', osm_id: 1, lat: 37.3891, lon: -5.9845,
  place_key: null, nombre: 'Malafama', clave: 'amenity', valor: 'pub',
};
const alta = {
  clase: 'alta', osm_type: 'way', osm_id: 99, lat: 37.1672, lon: -5.9213,
  place_key: '37.16720_-5.92130', nombre: 'Parroquia El Buen Pastor',
  clave: 'amenity', valor: 'place_of_worship',
};

test('un renombrado cambia el nombre y conserva lo demás', () => {
  const r = api().aplicarMapaAlDia([barPepe], [renombrado]);
  assert.equal(r[0].tags.name, 'Malafama');
  assert.equal(r[0].tags.phone, '954000000');
  assert.equal(barPepe.tags.name, 'Guadalquivir', 'la foto no se toca');
});

test('sin el mismo id, se encuentra por la clave', () => {
  const L = api();
  const r = L.aplicarMapaAlDia([barPepe], [Object.assign({}, renombrado, {
    osm_type: 'way', osm_id: 5, place_key: L.claveDe(37.3891, -5.9845),
  })]);
  assert.equal(r[0].tags.name, 'Malafama');
});

test('un alta se añade, y no se repite si la foto ya la tiene', () => {
  const L = api();
  const r = L.aplicarMapaAlDia([barPepe], [alta]);
  assert.equal(r.length, 2);
  assert.equal(r[1].tags.name, 'Parroquia El Buen Pastor');
  assert.equal(r[1].tags.amenity, 'place_of_worship');
  assert.equal(L.aplicarMapaAlDia(r, [alta]).length, 2);
});
