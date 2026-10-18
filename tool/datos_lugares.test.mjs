import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const osm = { nombre: 'Burger Up!', lat: 37.3996386, lon: -6.0474193,
  telefono: '+34643006876', web: '', horario: '', osmType: 'node', osmId: 14212385193 };
const datos = { alta_id: 24, nombre: 'Burger Up!', tipo: 'fast_food',
  lat: osm.lat, lon: osm.lon, osm_type: 'node', osm_id: osm.osmId,
  web: 'https://burger.example', horario: 'Mo-Su 20:00-23:00',
  imagen_url: 'https://foto.example/burger.jpg', sin_imagen: false };
function montar({ filas = [datos], manuales = [], fotosAutorizadas = [] } = {}) {
  const ctx = { console, window: {}, fetch: async (url) => ({ ok: true, json: async () => {
    if (url.includes('lugares-sevilla.json')) return { elements: [{ type: 'node',
      id: osm.osmId, lat: osm.lat, lon: osm.lon, tags: { name: osm.nombre, amenity: 'fast_food' } }] };
    if (url.includes('/datos_lugares?')) return filas;
    if (url.includes('foto_web_autorizada_at')) return fotosAutorizadas;
    if (url.includes('/lugares_manuales?')) return manuales;
    return [];
  } }) };
  vm.createContext(ctx);
  vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
  return ctx.window.sevitimeLugares;
}

test('retirada el alta, OSM conserva web y horario, pero no publica la foto sin permiso', async () => {
  const api = montar();
  const sitios = await api.cargar();
  assert.equal(sitios.length, 1);
  assert.equal(api.claveDe(sitios[0].lat, sitios[0].lon), api.claveDe(osm.lat, osm.lon));
  assert.equal(sitios[0].web, datos.web);
  assert.equal(sitios[0].horario, datos.horario);
  assert.equal(sitios[0].imagenUrl, undefined);
});

test('publica la foto permanente solo con permiso para la misma alta y URL', async () => {
  const autorizado = { id: datos.alta_id, imagen_url: datos.imagen_url,
    foto_web_autorizada_at: '2026-10-18T12:00:00Z' };
  const api = montar({ fotosAutorizadas: [autorizado] });
  const sitios = await api.cargar();
  assert.equal(sitios[0].imagenUrl, datos.imagen_url);
});

test('no extiende el permiso de una foto anterior a una URL nueva', () => {
  const api = montar();
  const permisos = new Map([[String(datos.alta_id), 'https://foto.example/foto-anterior.jpg']]);
  assert.equal(api.completarConDatosPropios(osm, [datos], permisos).imagenUrl, undefined);
});

test('los datos propios solos no crean un sitio que OSM no tiene', () => {
  const api = montar();
  const sitio = { ...osm, nombre: 'Bar El Nuevo' };
  assert.equal(api.completarConDatosPropios(sitio, [datos]).web, '');
});

test('un homónimo vecino con otro id no hereda las aportaciones', () => {
  const api = montar();
  assert.equal(api.completarConDatosPropios({ ...osm, osmId: 999 }, [datos], new Map()).web, '');
});

test('un homónimo lejano sin vínculo no hereda la foto', () => {
  const api = montar();
  const sinVinculo = { ...datos, osm_id: null, osm_type: null };
  const lejos = { ...osm, lat: 37.45 };
  const permisos = new Map([[String(datos.alta_id), datos.imagen_url]]);
  assert.equal(api.completarConDatosPropios(lejos, [sinVinculo], permisos).imagenUrl, undefined);
});

test('el nodo movido conserva sus datos y las coordenadas actuales', () => {
  const api = montar();
  const movido = { ...osm, lat: 37.401 };
  const sitio = api.completarConDatosPropios(movido, [datos], new Map());
  assert.equal(sitio.lat, movido.lat);
  assert.equal(sitio.web, datos.web);
});

test('una aportación posterior actualiza la ficha', () => {
  const api = montar();
  const nuevo = { ...datos, web: 'https://nuevo.example' };
  assert.equal(api.completarConDatosPropios(osm, [datos, nuevo], new Map()).web, nuevo.web);
});
