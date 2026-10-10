// Genera las dos cosas con las que Google encuentra las fichas de sitio:
//
//   sitemap-lugares.xml   la lista de direcciones `/lugar/?k=…`
//   sitios/index.html     una página de verdad, con un enlace a cada ficha
//
// `/lugar/?k=…` es una sola página que pinta cualquier sitio. Google ejecuta
// su script y puede indexarlas una a una, pero solo si sabe que existen y,
// mejor aún, si llega a ellas por un enlace normal. Hasta ahora no había
// ninguno: a una ficha se llegaba desde un enlace compartido en la app o
// tocando un sitio en el mapa, y Google no toca mapas. El listado es ese
// camino, y de paso es una página útil: los sitios de los que más se sabe,
// ordenados por tipo.
//
// Se llama «Sevilla y alrededores» y no «y su provincia» porque la foto
// diaria es un radio alrededor de Sevilla y se sale un poco: trae la Gruta de
// las Maravillas, que está en Aracena (Huelva).
//
// NO van todos. De los más de 9.000 sitios con nombre, de casi todos solo se
// sabe eso, el nombre: una ficha con un nombre y un mapa es contenido pobre,
// y mandarle 9.000 a Google desde un dominio con siete páginas es pedir que
// las ignore todas. Van los que tienen algo que enseñar: al menos dos de
// horario, teléfono y web.
//
// Los sitios salen de `lugares.js`, el mismo fichero que usa la web (la foto
// diaria, más las altas, menos los ocultos), ejecutado aquí tal cual: así
// este listado no puede enseñar un sitio que el mapa esconde.
//
// Las claves son coordenadas, así que no caducan mientras el sitio no se
// mueva. Si uno cierra, su ficha se marca `noindex` sola; aun así conviene
// regenerar esto de vez en cuando:
//
//   node tool/sitemap_lugares.mjs && node tool/versionar.mjs
//
// No hay cron detrás, igual que con las categorías: son ficheros estáticos y
// cambian poco.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/// Cuántos de los tres datos que enseña la ficha tiene un sitio.
export function datosDe(p) {
  return [p.horario, p.telefono, p.web].filter(Boolean).length;
}

/// Los sitios que entran, con su clave, sin repetir y en orden estable:
/// por tipo y, dentro de cada tipo, por nombre.
export function elegir(lugares, claveDe) {
  const vistas = new Set();
  const elegidos = [];
  for (const p of lugares) {
    const nombre = (p.nombre || '').trim();
    if (!nombre || datosDe(p) < 2) continue;
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const clave = claveDe(p.lat, p.lon);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    elegidos.push({ clave, nombre, tipo: (p.label || 'Otros sitios').trim(), emoji: p.emoji || '' });
  }
  const orden = new Intl.Collator('es');
  return elegidos.sort((a, b) =>
    orden.compare(a.tipo, b.tipo) || orden.compare(a.nombre, b.nombre) ||
    (a.clave < b.clave ? -1 : 1));
}

export function xml(elegidos) {
  const urls = elegidos.map((s) =>
    `  <url>\n    <loc>https://sevitime.com/lugar/?k=${s.clave}</loc>\n  </url>\n`).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + '</urlset>\n';
}

function texto(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/// El trozo de la portada entre dos marcas, para que el listado lleve la
/// misma barra y el mismo pie sin copiarlos a mano.
function trozo(html, desde, hasta) {
  const a = html.indexOf(desde);
  const b = html.indexOf(hasta, a);
  if (a < 0 || b < 0) throw new Error(`La portada ya no tiene «${desde}»: revisa el molde.`);
  return html.slice(a, b + hasta.length);
}

/// La página del listado. [portada] es el HTML de `index.html`.
export function pagina(elegidos, portada) {
  const porTipo = new Map();
  for (const s of elegidos) {
    if (!porTipo.has(s.tipo)) porTipo.set(s.tipo, []);
    porTipo.get(s.tipo).push(s);
  }
  const secciones = [...porTipo].map(([tipo, sitios]) =>
    `  <section>\n    <h2>${texto(sitios[0].emoji ? sitios[0].emoji + ' ' : '')}${texto(tipo)} <span class="cuantos">${sitios.length}</span></h2>\n    <ul>\n` +
    sitios.map((s) => `      <li><a href="/lugar/?k=${s.clave}">${texto(s.nombre)}</a></li>\n`).join('') +
    '    </ul>\n  </section>\n').join('');

  return `<!DOCTYPE html>
<!-- GENERADO por tool/sitemap_lugares.mjs. No lo edites a mano: se pisa. -->
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sitios de Sevilla y alrededores — SeviTime</title>
<meta name="description" content="Bares, restaurantes, museos y comercios de Sevilla, su provincia y alrededores con horario, teléfono o web, ordenados por tipo. Cada uno con su ficha y su sitio en el mapa.">
<link rel="canonical" href="https://sevitime.com/sitios/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sevitime.com/sitios/">
<meta property="og:site_name" content="SeviTime">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="Sitios de Sevilla y alrededores — SeviTime">
<meta property="og:description" content="Los sitios de los que más se sabe, ordenados por tipo.">
<meta property="og:image" content="https://sevitime.com/social.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F1C1A" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F2F7F6" media="(prefers-color-scheme: light)">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fuentes/inter-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilo.css">
<script defer src="/nav.js"></script>
<style>
  .sitios { max-width: 1120px; margin: 0 auto; padding: 32px 24px 60px; }
  .sitios h1 {
    font-size: var(--t-display); font-weight: 800; color: var(--texto);
    letter-spacing: -0.02em; text-wrap: balance; margin-bottom: 8px;
  }
  .sitios .intro { font-size: var(--t-item); color: var(--apagado); max-width: 62ch; }
  .sitios .intro a { color: var(--verde-claro); }
  .sitios h2 {
    font-size: var(--t-seccion); font-weight: 700; color: var(--texto);
    margin: 34px 0 10px;
  }
  .sitios .cuantos { font-size: var(--t-etiqueta); font-weight: 600; color: var(--tenue); margin-left: 4px; }
  .sitios ul {
    list-style: none; display: grid; gap: 2px 18px;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  }
  .sitios li a {
    display: block; padding: 7px 0; font-size: var(--t-cuerpo);
    color: var(--texto); text-decoration: none;
    border-bottom: 1px solid var(--borde);
    overflow-wrap: anywhere;
  }
  .sitios li a:hover { color: var(--verde-claro); }
  .sitios li a:focus-visible { outline: 3px solid var(--verde-claro); outline-offset: 2px; }
</style>
</head>
<body>

<a class="saltar" href="#contenido">Saltar al contenido</a>

${trozo(portada, '<nav class="top-nav">', '</nav>')}

<main class="sitios" id="contenido" tabindex="-1">
  <h1>Sitios de Sevilla y alrededores</h1>
  <p class="intro">Los ${elegidos.length} sitios de los que más se sabe: tienen al menos dos datos entre horario, teléfono y web. Toca uno para ver su ficha. Están todos, y miles más, en <a href="/mapa/">el mapa</a>.</p>
${secciones}</main>

${trozo(portada, '<footer>', '</footer>')}

<script defer src="/auth.js"></script>
</body>
</html>
`;
}

/// `lugares.js` tal cual, con lo mínimo que espera encontrar en un navegador.
function cargarLugares() {
  const guardado = new Map();
  const ctx = {
    console,
    fetch,
    localStorage: {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
    },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(RAIZ, 'lugares.js'), 'utf8'), ctx);
  return ctx.window.sevitimeLugares;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const api = cargarLugares();
  const elegidos = elegir(await api.cargar(), api.claveDe);
  // Con muy pocos, algo ha ido mal con la foto: no se pisa lo bueno.
  if (elegidos.length < 100) throw new Error(`Solo ${elegidos.length} sitios: no se escribe nada.`);
  writeFileSync(join(RAIZ, 'sitemap-lugares.xml'), xml(elegidos));
  mkdirSync(join(RAIZ, 'sitios'), { recursive: true });
  writeFileSync(join(RAIZ, 'sitios', 'index.html'),
    pagina(elegidos, readFileSync(join(RAIZ, 'index.html'), 'utf8')));
  console.log(`${elegidos.length} sitios: sitemap-lugares.xml y sitios/index.html.\nFalta: node tool/versionar.mjs`);
}
