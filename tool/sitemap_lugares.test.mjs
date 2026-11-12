// Qué fichas entran en `sitemap-lugares.xml` y en el listado `/sitios/`.
//
//   node --test tool/sitemap_lugares.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { elegir, fichaDe, pagina, ponerDirecciones, slugDe, xml } from './sitemap_lugares.mjs';

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
  const salida = xml([{ slug: 'bar-pepe' }, { slug: 'museo' }]);
  assert.equal((salida.match(/<url>/g) || []).length, 2);
  assert.match(salida, /<loc>https:\/\/sevitime\.com\/sitio\/bar-pepe\/<\/loc>/);
});

test('el listado enlaza cada ficha y no se cree lo que venga en un nombre', () => {
  const portada = readFileSync('index.html', 'utf8');
  const html = pagina([
    { slug: 'bar-pepe-hijos', nombre: 'Bar <b>Pepe</b> & Hijos', tipo: 'Bar', emoji: '🍺' },
    { slug: 'museo', nombre: 'Museo', tipo: 'Atracción', emoji: '' },
  ], portada);
  assert.match(html, /<a href="\/sitio\/bar-pepe-hijos\/">Bar &lt;b&gt;Pepe&lt;\/b&gt; &amp; Hijos<\/a>/);
  assert.equal((html.match(/<a href="\/sitio\//g) || []).length, 2);
  assert.match(html, /<link rel="canonical" href="https:\/\/sevitime\.com\/sitios\/">/);
  // La barra y el pie son los de la portada, no una copia.
  assert.ok(html.includes('<nav class="top-nav">') && html.includes('<footer>'));
});

test('el sitemap, el listado y las páginas publicadas dicen lo mismo', () => {
  const nombres = (texto, patron) => [...texto.matchAll(patron)].map((m) => m[1]).sort();
  const delSitemap = nombres(readFileSync('sitemap-lugares.xml', 'utf8'), /\/sitio\/([a-z0-9-]+)\/<\/loc>/g);
  const delListado = nombres(readFileSync('sitios/index.html', 'utf8'), /href="\/sitio\/([a-z0-9-]+)\/"/g);
  const delIndice = Object.values(JSON.parse(readFileSync('sitio/indice.json', 'utf8'))).sort();
  const enDisco = readdirSync('sitio', { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const regenera = 'Regenera: node tool/sitemap_lugares.mjs && node tool/versionar.mjs';
  assert.ok(delSitemap.length >= 100);
  assert.deepEqual(delListado, delSitemap, regenera);
  assert.deepEqual(delIndice, delSitemap, regenera);
  assert.deepEqual(enDisco, delSitemap, regenera);
});

test('el nombre de la página sale del nombre del sitio, sin tildes ni signos', () => {
  assert.equal(slugDe('Bar «El Rinconcillo»'), 'bar-el-rinconcillo');
  assert.equal(slugDe("Peña Sevillista Ñú & Cía."), 'pena-sevillista-nu-cia');
  assert.equal(slugDe('¡¡!!'), '');
});

test('dos sitios con el mismo nombre no comparten página, y ninguno se queda el nombre limpio', () => {
  const s = (nombre, clave, direccion = '') => ({ nombre, clave, direccion });
  const lista = ponerDirecciones([
    s('Caixabank', '37.10000_-5.90000', 'Calle Carmona, 4'),
    s('Caixabank', '37.20000_-5.90000', 'Calle San Jacinto, 109'),
    s('Caixabank', '37.30000_-5.90000'),
    s('Caixabank', '37.40000_-5.90000'),
    s('El Rinconcillo', '37.39334_-5.98829', 'Calle Gerona, 40'),
  ]).map((x) => x.slug);
  assert.deepEqual(lista, [
    'caixabank-calle-carmona-4',
    'caixabank-calle-san-jacinto-109',
    'caixabank-37-30000-5-90000',
    'caixabank-37-40000-5-90000',
    'el-rinconcillo',
  ]);
  assert.equal(new Set(lista).size, lista.length);
});

test('la página de un sitio lleva sus datos escritos, no los pone el script', () => {
  const molde = readFileSync('lugar/index.html', 'utf8');
  const html = fichaDe({
    slug: 'bar-pepe', clave: '37.50000_-5.90000', nombre: 'Bar <i>Pepe</i>', tipo: 'Bar',
    emoji: '🍺', lat: 37.5, lon: -5.9, direccion: 'Calle Feria, 1', telefono: '954000000',
    web: 'https://pepe.example', horario: 'Mo-Fr 09:00-14:00', horarioPropio: false,
  }, molde, () => 'De lunes a viernes, de 9:00 a 14:00');

  assert.match(html, /<html lang="es" data-k="37\.50000_-5\.90000">/);
  assert.match(html, /<title>Bar &lt;i&gt;Pepe&lt;\/i&gt;: horario, teléfono, web y cómo llegar — SeviTime<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/sevitime\.com\/sitio\/bar-pepe\/">/);
  assert.match(html, /<h1 id="nombre">Bar &lt;i&gt;Pepe&lt;\/i&gt;<\/h1>/);
  assert.match(html, /Calle Feria, 1/);
  assert.match(html, /De lunes a viernes, de 9:00 a 14:00 \(según OpenStreetMap\)/);
  // Los datos estructurados son JSON válido y no dejan cerrar la etiqueta.
  const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1];
  assert.equal(JSON.parse(ld).name, 'Bar <i>Pepe</i>');
  assert.ok(!ld.includes('<'));
  // Sigue siendo la ficha de siempre: mismo script, mismo estilo.
  assert.match(html, /src="\/lugar\/ficha\.js/);
});

test('una web que no es http no se convierte en enlace', () => {
  const molde = readFileSync('lugar/index.html', 'utf8');
  const html = fichaDe({
    slug: 'x', clave: '37.50000_-5.90000', nombre: 'X', tipo: 'Bar', emoji: '', lat: 37.5,
    lon: -5.9, direccion: '', telefono: '954', web: 'javascript:alert(1)', horario: '',
  }, molde);
  assert.ok(!html.includes('javascript:alert'));
});

test('las páginas publicadas están hechas con el molde de hoy', () => {
  // Si alguien toca `lugar/index.html` y no regenera, las 500 páginas se
  // quedan con la cabecera vieja sin que nada avise. Se mira una: sin su
  // contenido propio, tiene que tener las mismas líneas que el molde.
  const indice = JSON.parse(readFileSync('sitio/indice.json', 'utf8'));
  const slug = Object.values(indice)[0];
  const lineas = (f) => new Set(readFileSync(f, 'utf8').split('\n').map((l) => l.trim()));
  const pagina = lineas(`sitio/${slug}/index.html`);
  const faltan = [...lineas('lugar/index.html')].filter((l) =>
    l && !pagina.has(l) && !/<html |<title>|name="description"|og:url|og:title|og:description|id="emoji"|id="nombre"|id="tipo"|id="datos"|<!DOCTYPE/.test(l));
  assert.deepEqual(faltan, [], 'regenera con: node tool/sitemap_lugares.mjs && node tool/versionar.mjs');
});
