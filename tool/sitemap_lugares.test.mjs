// Qué fichas entran en `sitemap-lugares.xml`.
//
//   node --test tool/sitemap_lugares.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { claveDe, entradas, xml } from './sitemap_lugares.mjs';

const bar = (tags, extra = {}) => ({ type: 'node', id: 1, lat: 37.3891, lon: -5.9845, tags, ...extra });

test('la clave es la de la app: cinco decimales y un guion bajo', () => {
  assert.equal(claveDe(37.393612, -5.987041), '37.39361_-5.98704');
  assert.equal(claveDe(37.4, -6), '37.40000_-6.00000');
});

test('solo entran los sitios con nombre y al menos dos datos', () => {
  const lista = entradas([
    bar({ name: 'Solo nombre' }),
    bar({ name: 'Un dato', phone: '954000000' }, { lat: 37.1 }),
    bar({ name: 'Dos datos', phone: '954000000', opening_hours: 'Mo-Su 09:00-23:00' }, { lat: 37.2 }),
    bar({ phone: '954000000', website: 'https://ejemplo.es' }, { lat: 37.3 }),
  ]);
  assert.deepEqual(lista.map(([k]) => k), ['37.20000_-5.98450']);
});

test('los datos de contacto valen también con el prefijo contact:', () => {
  const lista = entradas([
    bar({ name: 'Bar', 'contact:phone': '954000000', 'contact:website': 'https://ejemplo.es' }),
  ]);
  assert.equal(lista.length, 1);
});

test('un sitio dibujado como edificio usa su centro, y no se repite la clave', () => {
  const lista = entradas([
    { type: 'way', id: 2, center: { lat: 37.5, lon: -5.9 }, timestamp: '2026-03-01T10:00:00Z',
      tags: { name: 'Museo', website: 'https://m.es', opening_hours: 'Tu-Su 10:00-20:00' } },
    { type: 'node', id: 3, lat: 37.5, lon: -5.9,
      tags: { name: 'Museo (entrada)', website: 'https://m.es', phone: '954' } },
  ]);
  assert.deepEqual(lista, [['37.50000_-5.90000', '2026-03-01']]);
});

test('el XML lleva una URL por ficha, con fecha solo si la hay', () => {
  const salida = xml([['37.50000_-5.90000', '2026-03-01'], ['37.60000_-5.80000', '']]);
  assert.equal((salida.match(/<url>/g) || []).length, 2);
  assert.match(salida, /<loc>https:\/\/sevitime\.com\/lugar\/\?k=37\.50000_-5\.90000<\/loc>\n    <lastmod>2026-03-01<\/lastmod>/);
  assert.equal((salida.match(/<lastmod>/g) || []).length, 1);
});
