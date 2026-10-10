// Qué fichas entran en `sitemap-lugares.xml` y en el listado `/sitios/`.
//
//   node --test tool/sitemap_lugares.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { elegir, pagina, xml } from './sitemap_lugares.mjs';

const claveDe = (lat, lon) => lat.toFixed(5) + '_' + lon.toFixed(5);
const sitio = (nombre, extra = {}) => ({
  nombre, lat: 37.3891, lon: -5.9845, label: 'Bar', emoji: '🍺',
  telefono: '', web: '', horario: '', ...extra,
});

test('solo entran los sitios con nombre y al menos dos datos', () => {
  const lista = elegir([
    sitio('Solo nombre'),
    sitio('Un dato', { telefono: '954000000', lat: 37.1 }),
    sitio('Dos datos', { telefono: '954000000', horario: 'Mo-Su 09:00-23:00', lat: 37.2 }),
    sitio('', { telefono: '954000000', web: 'https://ejemplo.es', lat: 37.3 }),
  ], claveDe);
  assert.deepEqual(lista.map((s) => s.clave), ['37.20000_-5.98450']);
});

test('dos sitios en el mismo punto no repiten la ficha', () => {
  const dos = { telefono: '954', web: 'https://m.es' };
  const lista = elegir([sitio('Museo', dos), sitio('Museo (entrada)', dos)], claveDe);
  assert.equal(lista.length, 1);
});

test('salen por tipo y, dentro, por nombre, con las tildes en su sitio', () => {
  const dos = { telefono: '954', web: 'https://m.es' };
  const lista = elegir([
    sitio('Zurbarán', { ...dos, lat: 37.1 }),
    sitio('Ávila', { ...dos, lat: 37.2 }),
    sitio('Museo', { ...dos, lat: 37.3, label: 'Atracción' }),
    sitio('Bodega', { ...dos, lat: 37.4 }),
  ], claveDe);
  assert.deepEqual(lista.map((s) => s.nombre), ['Museo', 'Ávila', 'Bodega', 'Zurbarán']);
});

test('el XML lleva una dirección por ficha', () => {
  const salida = xml([{ clave: '37.50000_-5.90000' }, { clave: '37.60000_-5.80000' }]);
  assert.equal((salida.match(/<url>/g) || []).length, 2);
  assert.match(salida, /<loc>https:\/\/sevitime\.com\/lugar\/\?k=37\.50000_-5\.90000<\/loc>/);
});

test('el listado enlaza cada ficha y no se cree lo que venga en un nombre', () => {
  const portada = readFileSync('index.html', 'utf8');
  const html = pagina([
    { clave: '37.50000_-5.90000', nombre: 'Bar <b>Pepe</b> & Hijos', tipo: 'Bar', emoji: '🍺' },
    { clave: '37.60000_-5.80000', nombre: 'Museo', tipo: 'Atracción', emoji: '' },
  ], portada);
  assert.match(html, /<a href="\/lugar\/\?k=37\.50000_-5\.90000">Bar &lt;b&gt;Pepe&lt;\/b&gt; &amp; Hijos<\/a>/);
  assert.equal((html.match(/<a href="\/lugar\/\?k=/g) || []).length, 2);
  assert.match(html, /<link rel="canonical" href="https:\/\/sevitime\.com\/sitios\/">/);
  // La barra y el pie son los de la portada, no una copia.
  assert.ok(html.includes('<nav class="top-nav">') && html.includes('<footer>'));
});

test('el sitemap y el listado publicados dicen lo mismo', () => {
  const claves = (texto, patron) => [...texto.matchAll(patron)].map((m) => m[1]).sort();
  const delSitemap = claves(readFileSync('sitemap-lugares.xml', 'utf8'), /\/lugar\/\?k=([0-9._-]+)<\/loc>/g);
  const delListado = claves(readFileSync('sitios/index.html', 'utf8'), /href="\/lugar\/\?k=([0-9._-]+)"/g);
  assert.ok(delSitemap.length >= 100);
  assert.deepEqual(delListado, delSitemap, 'Regenera los dos: node tool/sitemap_lugares.mjs');
});
