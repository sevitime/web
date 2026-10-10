// Genera `sitemap-lugares.xml`: las fichas de sitio que merece la pena que
// Google conozca.
//
// `/lugar/?k=…` es una sola página que pinta cualquier sitio. Google ejecuta
// su script y puede indexarlas una a una, pero solo si sabe que existen, y
// desde la web no hay ningún enlace que lleve a ellas: se llega por un enlace
// compartido desde la app. Este fichero es esa lista.
//
// NO van todos. La foto diaria trae más de 9.000 sitios con nombre, y de casi
// todos solo se sabe eso, el nombre: una ficha con un nombre y un mapa es
// contenido pobre, y mandarle 9.000 a Google desde un dominio con siete
// páginas es pedir que las ignore todas. Van los que tienen algo que enseñar:
// al menos dos de horario, teléfono y web.
//
// Las claves son coordenadas, así que no caducan mientras el sitio no se
// mueva. Si uno cierra, su ficha dice «no encontramos ese sitio» y se marca
// `noindex` sola; aun así conviene regenerar esto de vez en cuando:
//
//   node tool/sitemap_lugares.mjs
//
// No hay cron detrás, igual que con las categorías: es un fichero estático y
// cambia poco.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// La misma dirección que `SNAPSHOT_URL` en lugares.js.
const FOTO =
  'https://kdqiwhvtovafugpcrumf.supabase.co/storage/v1/object/public/snapshots/lugares-sevilla.json';

/// Cuántos de los tres datos que enseña la ficha tiene un sitio.
export function datosDe(tags) {
  return [
    tags.opening_hours,
    tags.phone || tags['contact:phone'],
    tags.website || tags['contact:website'],
  ].filter(Boolean).length;
}

/// La clave de la ficha: la de `claveDe` en lugares.js y `Place.placeKey`.
export function claveDe(lat, lon) {
  return lat.toFixed(5) + '_' + lon.toFixed(5);
}

/// Las entradas del sitemap para los elementos de la foto, sin repetir clave.
export function entradas(elementos) {
  const vistas = new Map();
  for (const e of elementos) {
    const tags = e.tags || {};
    if (!(tags.name || '').trim() || datosDe(tags) < 2) continue;
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const clave = claveDe(lat, lon);
    if (!vistas.has(clave)) vistas.set(clave, (e.timestamp || '').slice(0, 10));
  }
  return [...vistas].sort(([a], [b]) => (a < b ? -1 : 1));
}

export function xml(lista) {
  const urls = lista.map(([clave, fecha]) =>
    '  <url>\n' +
    `    <loc>https://sevitime.com/lugar/?k=${clave}</loc>\n` +
    (/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `    <lastmod>${fecha}</lastmod>\n` : '') +
    '  </url>\n').join('');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + '</urlset>\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await fetch(FOTO);
  if (!r.ok) throw new Error(`No se pudo leer la foto de lugares: ${r.status}`);
  const lista = entradas((await r.json()).elements || []);
  // Con muy pocas, algo ha ido mal con la foto: no se pisa el fichero bueno.
  if (lista.length < 100) throw new Error(`Solo ${lista.length} sitios: no se escribe nada.`);
  writeFileSync(join(RAIZ, 'sitemap-lugares.xml'), xml(lista));
  console.log(`sitemap-lugares.xml: ${lista.length} fichas`);
}
