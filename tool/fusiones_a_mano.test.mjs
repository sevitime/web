// Las fusiones hechas a mano (`fusiones_lugares`): los duplicados que no se
// llaman igual y que dice una persona desde el panel. La web tiene que juntar
// exactamente los mismos pares que la app (`juntar_osm.dart`), o el mismo
// sitio sale una vez en el móvil y dos en sevitime.com.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function montar({ filas, falla = false }) {
  const guardado = new Map();
  const ctx = {
    console,
    localStorage: {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
    },
    fetch: async (url) => {
      if (!String(url).includes('fusiones_lugares')) {
        return { ok: true, json: async () => [] };
      }
      if (falla) throw new Error('Supabase caído');
      return { ok: true, json: async () => filas };
    },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
  return { api: ctx.window.sevitimeLugares, guardado };
}

const sinVotos = () => false;

// «La Palmera» y «Farmacia La Palmera», a 3 m en la foto del 14-oct-2026.
const laPalmera = () => ({
  nombre: 'La Palmera', lat: 37.35665, lon: -5.97938, tipo: 'pharmacy',
  telefono: '', web: '', horario: '',
});
const farmacia = () => ({
  nombre: 'Farmacia La Palmera', lat: 37.35668, lon: -5.97938, tipo: 'pharmacy',
  telefono: '954 00 00 00', web: '', horario: '',
});

function fila(a, b, nombre = null) {
  const { api } = montar({ filas: [] });
  return {
    a_place_key: api.claveDe(a.lat, a.lon), a_osm_type: null, a_osm_id: null,
    b_place_key: api.claveDe(b.lat, b.lon), b_osm_type: null, b_osm_id: null,
    nombre,
  };
}

test('sin la fusión son dos tarjetas: la regla no las junta', () => {
  const { api } = montar({ filas: [] });
  assert.equal(api.juntarDeOsm([laPalmera(), farmacia()], sinVotos).length, 2);
});

test('con la fusión queda una, con lo que solo tenía la otra', () => {
  const { api } = montar({ filas: [] });
  const una = laPalmera(), otra = farmacia();
  const r = api.juntarDeOsm([una, otra], sinVotos, [fila(una, otra)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].telefono, '954 00 00 00');
  assert.ok(r[0].clavesFusionadas.length >= 1);
});

test('el nombre elegido manda sobre el de la ficha que gana', () => {
  const { api } = montar({ filas: [] });
  const una = laPalmera(), otra = farmacia();
  const conVotos = (p) => api.claveDe(p.lat, p.lon) === api.claveDe(una.lat, una.lon);
  const r = api.juntarDeOsm([una, otra], conVotos,
    [fila(una, otra, 'Farmacia La Palmera')]);
  assert.equal(r.length, 1);
  assert.equal(r[0].nombre, 'Farmacia La Palmera');
});

test('tres fichas en dos pares quedan en una', () => {
  const { api } = montar({ filas: [] });
  const uno = { nombre: 'Sol y Sombra', lat: 37.38916, lon: -6.01011, tipo: 'restaurant' };
  const dos = { nombre: 'Sol y Sombra 2', lat: 37.38913, lon: -6.01003, tipo: 'restaurant' };
  const tres = { nombre: 'Salón Sol y Sombra', lat: 37.38912, lon: -6.00994, tipo: 'restaurant' };
  const r = api.juntarDeOsm([uno, dos, tres], sinVotos,
    [fila(uno, dos), fila(dos, tres)]);
  assert.equal(r.length, 1);
});

test('reconoce el lado por el elemento de OSM si movieron el nodo', () => {
  const { api } = montar({ filas: [] });
  const torre = { nombre: 'Torre de los Perdigones', lat: 37.4001, lon: -5.9869,
                  tipo: 'tower', osmType: 'way', osmId: 42 };
  const otra = { nombre: 'Antigua Torre de los Perdigones', lat: 37.4002,
                 lon: -5.9869, tipo: 'attraction' };
  const r = api.juntarDeOsm([torre, otra], sinVotos, [{
    a_place_key: '37.39000_-5.98690', a_osm_type: 'way', a_osm_id: 42,
    b_place_key: api.claveDe(otra.lat, otra.lon), b_osm_type: null, b_osm_id: null,
    nombre: null,
  }]);
  assert.equal(r.length, 1);
});

test('si Supabase falla se usa la última lista que llegó bien', async () => {
  const una = laPalmera(), otra = farmacia();
  const f = fila(una, otra);
  const bien = montar({ filas: [f] });
  // JSON y no deepEqual: las filas nacen en otro contexto de VM y sus
  // prototipos no son los mismos.
  assert.equal(JSON.stringify(await bien.api.fusiones()), JSON.stringify([f]));

  // Mismo navegador, Supabase caído: lo que no puede pasar es que vuelvan a
  // salir dos tarjetas del mismo sitio.
  const caido = montar({ filas: [], falla: true });
  caido.guardado.set('sevitime_fusiones', JSON.stringify([f]));
  assert.equal(JSON.stringify(await caido.api.fusiones()), JSON.stringify([f]));
});
