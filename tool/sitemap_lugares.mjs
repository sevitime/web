// Genera lo que hace falta para que Google encuentre las fichas de sitio:
//
//   sitio/<nombre>/index.html   una página de verdad por sitio
//   sitio/indice.json           qué página tiene cada clave
//   sitemap-lugares.xml         la lista de esas direcciones
//   sitios/index.html           un listado con un enlace a cada una
//
// POR QUÉ HAY UNA PÁGINA POR SITIO. Hasta el 12-nov-2026 todas las fichas
// eran una sola página, `/lugar/?k=…`, que un script rellenaba al cargar. Se
// le mandaron a Google 526 direcciones así el 11-oct-2026 y un mes después
// no había indexado NINGUNA (`site:sevitime.com` daba cinco páginas: portada,
// eventos, mapa, rutas y cuadro de honor). Para él eran 526 direcciones con
// el mismo HTML vacío. Ahora cada sitio tiene su fichero, con su nombre, su
// dirección, su horario y sus datos estructurados ya escritos dentro; el
// script de siempre (`lugar/ficha.js`) sigue corriendo encima y pone el
// mapa, las reseñas y los botones. De paso, compartir una ficha por WhatsApp
// enseña el nombre del sitio y no un título genérico.
//
// `/lugar/?k=…` sigue funcionando igual para todos los sitios: es adonde
// llevan el mapa, Explorar y los enlaces que comparte la app.
//
// El molde es `lugar/index.html`: las páginas generadas son ese mismo
// fichero con el sitio puesto. Si se cambia el molde, hay que regenerar.
//
// Se llama «Sevilla y alrededores» y no «y su provincia» por costumbre: la
// foto diaria fue un radio alrededor de Sevilla antes de recortarse a la
// provincia.
//
// NO van todos. De los más de 8.000 sitios con nombre, de casi todos solo se
// sabe eso, el nombre: una ficha con un nombre y un mapa es contenido pobre,
// y mandarle 8.000 a Google desde un dominio con cinco páginas indexadas es
// pedir que las ignore todas. Van los que tienen algo que enseñar: al menos
// dos de horario, teléfono y web.
//
// Los sitios salen de `lugares.js`, el mismo fichero que usa la web (la foto
// diaria, más las altas, menos los ocultos), ejecutado aquí tal cual: así
// este listado no puede enseñar un sitio que el mapa esconde.
//
// La dirección de cada página sale del nombre del sitio, así que si un bar
// cambia de nombre su página cambia de dirección y la vieja se borra. No hay
// cron detrás: son ficheros estáticos. Regenerar de vez en cuando, y siempre
// que se toque `lugar/index.html`:
//
//   node tool/sitemap_lugares.mjs && node tool/versionar.mjs

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    elegidos.push({
      clave, nombre, tipo: (p.label || 'Otros sitios').trim(), emoji: p.emoji || '',
      lat: p.lat, lon: p.lon,
      direccion: (p.direccion || '').trim(), telefono: (p.telefono || '').trim(),
      web: (p.web || '').trim(), horario: (p.horario || '').trim(),
      horarioPropio: !!p.horarioPropio,
    });
  }
  const orden = new Intl.Collator('es');
  elegidos.sort((a, b) =>
    orden.compare(a.tipo, b.tipo) || orden.compare(a.nombre, b.nombre) ||
    (a.clave < b.clave ? -1 : 1));
  return ponerDirecciones(elegidos);
}

/// «Bar El Rinconcillo» → `bar-el-rinconcillo`.
export function slugDe(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
}

/// A cada sitio, el nombre de su página (`slug`), sin repetir ninguno.
///
/// Con el nombre basta casi siempre. Cuando dos sitios se llaman igual
/// —hay farmacias y cajeros con el mismo nombre en toda la provincia— a
/// TODOS los que chocan se les añade la calle y, si aun así coinciden o no
/// la tienen, las coordenadas. A todos y no solo al segundo: si no, cuál se
/// queda con el nombre limpio dependería del orden, y bastaría que apareciera
/// un tercero para que las direcciones de los otros dos cambiaran.
export function ponerDirecciones(sitios) {
  const cuenta = (lista) => {
    const veces = new Map();
    for (const x of lista) veces.set(x, (veces.get(x) || 0) + 1);
    return veces;
  };
  const base = sitios.map((s) => slugDe(s.nombre) || 'sitio');
  const vecesBase = cuenta(base);
  const conCalle = sitios.map((s, i) => {
    if (vecesBase.get(base[i]) === 1) return base[i];
    const calle = slugDe(s.direccion || '');
    return calle ? base[i] + '-' + calle : base[i];
  });
  const vecesCalle = cuenta(conCalle);
  return sitios.map((s, i) => ({
    ...s,
    slug: vecesCalle.get(conCalle[i]) === 1
      ? conCalle[i]
      : base[i] + '-' + s.clave.replace(/[^0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  }));
}

export function xml(elegidos) {
  const urls = elegidos.map((s) =>
    `  <url>\n    <loc>https://sevitime.com/sitio/${s.slug}/</loc>\n  </url>\n`).join('');
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
    sitios.map((s) => `      <li><a href="/sitio/${s.slug}/">${texto(s.nombre)}</a></li>\n`).join('') +
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
<link rel="manifest" href="/manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SeviTime">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
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

/// «horario, teléfono y web», con lo que el sitio tenga.
function loQueSeSabe(s) {
  const sabe = [s.horario ? 'horario' : '', s.telefono ? 'teléfono' : '', s.web ? 'web' : '']
    .filter(Boolean);
  return sabe.join(', ').replace(/, ([^,]*)$/, ' y $1');
}

/// Lo mismo que escribe `paraBuscadores` en `lugar/ficha.js` para las fichas
/// sin página propia, con la calle delante cuando se sabe.
export function descripcionDe(s) {
  const sabe = loQueSeSabe(s);
  return s.nombre + ' (' + s.tipo.toLowerCase() + ')' +
    (s.direccion ? ', en ' + s.direccion : '') +
    ': ' + (sabe ? 'su ' + sabe + ', ' : '') +
    'dónde está y cómo llegar. En SeviTime, el mapa de Sevilla y su provincia.';
}

/// Solo lo que se ve en la página, como en `paraBuscadores`: sin nota ni
/// «abierto ahora». El horario no va porque OpenStreetMap lo escribe en un
/// formato que schema.org no entiende.
export function datosEstructurados(s) {
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: s.nombre,
    url: 'https://sevitime.com/sitio/' + s.slug + '/',
    geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon },
  };
  if (s.direccion) {
    datos.address = {
      '@type': 'PostalAddress', streetAddress: s.direccion,
      addressRegion: 'Sevilla', addressCountry: 'ES',
    };
  }
  if (s.telefono) datos.telephone = s.telefono;
  if (/^https?:\/\//.test(s.web || '')) datos.sameAs = s.web;
  return datos;
}

function cambiar(html, de, a) {
  if (!html.includes(de)) {
    throw new Error(`El molde lugar/index.html ya no tiene «${de.slice(0, 60)}»: revisa fichaDe.`);
  }
  return html.replace(de, () => a);
}

/// La página de un sitio: el molde (`lugar/index.html`) con el sitio puesto.
export function fichaDe(s, molde, horarioLegible = (h) => h) {
  const url = 'https://sevitime.com/sitio/' + s.slug + '/';
  // «El Rinconcillo: horario, teléfono, web y cómo llegar — SeviTime».
  const partes = [s.horario ? 'horario' : '', s.telefono ? 'teléfono' : '',
    s.web ? 'web' : '', 'cómo llegar'].filter(Boolean);
  const titulo = s.nombre + ': ' +
    partes.join(', ').replace(/, ([^,]*)$/, ' y $1') + ' — SeviTime';
  const descripcion = descripcionDe(s);
  const filas = [
    s.direccion ? ['Dirección', texto(s.direccion)] : null,
    s.telefono ? ['Teléfono', `<a href="tel:${texto(s.telefono)}">${texto(s.telefono)}</a>`] : null,
    s.web && /^https?:\/\//.test(s.web)
      ? ['Web', `<a href="${texto(s.web)}" target="_blank" rel="noopener">${texto(s.web)}</a>`]
      : null,
    s.horario ? ['Horario', texto(horarioLegible(s.horario)) +
      (s.horarioPropio ? ' (aportado a SeviTime)' : ' (según OpenStreetMap)')] : null,
  ].filter(Boolean).map(([etiqueta, valor]) =>
    `<li><span class="etiqueta">${etiqueta}</span><span>${valor}</span></li>`).join('');
  // `<` escapado: un nombre con «</script>» dentro no puede cerrar la etiqueta.
  const ld = JSON.stringify(datosEstructurados(s)).replace(/</g, '\\u003c');

  let html = molde;
  html = cambiar(html, '<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- GENERADO por tool/sitemap_lugares.mjs a partir de lugar/index.html. No lo edites a mano: se pisa. -->');
  html = cambiar(html, '<html lang="es">', `<html lang="es" data-k="${texto(s.clave)}">`);
  html = cambiar(html, '<title>Un sitio de Sevilla — SeviTime</title>', `<title>${texto(titulo)}</title>`);
  html = cambiar(html,
    '<meta name="description" content="Un sitio de Sevilla en SeviTime: dónde está, cómo llegar y qué se sabe de él.">',
    `<meta name="description" content="${texto(descripcion)}">\n<link rel="canonical" href="${url}">\n<script type="application/ld+json">${ld}</script>`);
  html = cambiar(html, '<meta property="og:url" content="https://sevitime.com/lugar/">',
    `<meta property="og:url" content="${url}">`);
  html = cambiar(html, '<meta property="og:title" content="Un sitio de Sevilla — SeviTime">',
    `<meta property="og:title" content="${texto(s.nombre)} — SeviTime">`);
  html = cambiar(html, '<meta property="og:description" content="Míralo en el mapa y ábrelo en SeviTime.">',
    `<meta property="og:description" content="${texto(descripcion)}">`);
  html = cambiar(html, '<div class="sitio-emoji" id="emoji" aria-hidden="true">📍</div>',
    `<div class="sitio-emoji" id="emoji" aria-hidden="true">${texto(s.emoji || '📍')}</div>`);
  html = cambiar(html, '<h1 id="nombre" class="cargando">Buscando el sitio…</h1>',
    `<h1 id="nombre">${texto(s.nombre)}</h1>`);
  html = cambiar(html, '<p class="sitio-tipo" id="tipo"></p>',
    `<p class="sitio-tipo" id="tipo">${texto(s.tipo)}</p>`);
  html = cambiar(html, '<ul class="sitio-datos" id="datos"></ul>',
    `<ul class="sitio-datos" id="datos">${filas}</ul>`);
  return html;
}

/// Escribe una página por sitio y borra las de los que ya no están.
function escribirFichas(elegidos, horarioLegible) {
  const carpeta = join(RAIZ, 'sitio');
  const molde = readFileSync(join(RAIZ, 'lugar', 'index.html'), 'utf8');
  mkdirSync(carpeta, { recursive: true });
  const vivas = new Set(elegidos.map((s) => s.slug));
  for (const nombre of readdirSync(carpeta, { withFileTypes: true })) {
    if (nombre.isDirectory() && !vivas.has(nombre.name)) {
      rmSync(join(carpeta, nombre.name), { recursive: true });
    }
  }
  for (const s of elegidos) {
    mkdirSync(join(carpeta, s.slug), { recursive: true });
    writeFileSync(join(carpeta, s.slug, 'index.html'), fichaDe(s, molde, horarioLegible));
  }
  const indice = {};
  for (const s of elegidos) indice[s.clave] = s.slug;
  writeFileSync(join(carpeta, 'indice.json'), JSON.stringify(indice) + '\n');
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
  escribirFichas(elegidos, api.horarioLegible);
  writeFileSync(join(RAIZ, 'sitemap-lugares.xml'), xml(elegidos));
  mkdirSync(join(RAIZ, 'sitios'), { recursive: true });
  writeFileSync(join(RAIZ, 'sitios', 'index.html'),
    pagina(elegidos, readFileSync(join(RAIZ, 'index.html'), 'utf8')));
  console.log(`${elegidos.length} sitios: sitio/<nombre>/, sitemap-lugares.xml y sitios/index.html.\nFalta: node tool/versionar.mjs`);
}
