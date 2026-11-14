// Pone en cada <link> y <script> de la web la versión de su fichero:
// `/estilo.css?v=3f9a1c2e`.
//
// GitHub Pages deja que el navegador guarde cada fichero diez minutos, y los
// estilos y scripts se piden siempre con el mismo nombre: tras publicar, la
// página nueva podía pintarse con el `estilo.css` viejo. Con la versión en la
// dirección, lo que cambia se pide de nuevo y lo que no, sigue en caché. Es
// lo mismo que hace el panel de /admin/ con su `main.dart.js`.
//
// La versión es un trozo del hash del contenido, no una fecha: si el fichero
// no cambia, su dirección tampoco, y ejecutar esto dos veces no toca nada.
//
// Uso, desde la raíz, antes de commitear un cambio de CSS o JS:
//   node tool/versionar.mjs              reescribe los HTML que haga falta
//   node tool/versionar.mjs --comprobar  no toca nada; sale con 1 si falta
//
// `admin/` se queda fuera (el panel se versiona al compilarlo) y `libs/`
// también: son librerías con la versión fijada, no cambian entre
// publicaciones.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUERA = new Set(['admin', 'libs', 'node_modules', '.git', 'tool', 'capturas', 'fuentes']);
const SIN_VERSION = ['/libs/', '/admin/'];

const REFERENCIA = /\b(href|src)="(\/[^"?#]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g;

function paginas(carpeta) {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      return FUERA.has(nombre) ? [] : paginas(ruta);
    }
    return nombre.endsWith('.html') ? [ruta] : [];
  });
}

const versiones = new Map();
function versionDe(ruta) {
  if (!versiones.has(ruta)) {
    let hash = null;
    try {
      hash = createHash('sha1').update(readFileSync(join(RAIZ, ruta))).digest('hex').slice(0, 8);
    } catch {
      // Un fichero que no existe se deja como está: no es cosa de este script.
    }
    versiones.set(ruta, hash);
  }
  return versiones.get(ruta);
}

/// El HTML con cada referencia apuntando a la versión actual de su fichero.
export function versionar(html) {
  return html.replace(REFERENCIA, (todo, atributo, ruta) => {
    if (SIN_VERSION.some((p) => ruta.startsWith(p))) return todo;
    const v = versionDe(ruta);
    return v ? `${atributo}="${ruta}?v=${v}"` : todo;
  });
}

// ── CSP (revisión de seguridad del 14-nov-2026, n.º 4) ─────────────────────
//
// GitHub Pages no deja poner cabeceras, así que la política va en una
// <meta http-equiv>, que se escribe aquí para que esté siempre al día.
//
// Lo que de verdad protege está cerrado: solo se ejecutan scripts de la propia
// web, de Firebase (gstatic.com, avisos de la web) y los que van dentro de la
// página, autorizados por su huella SHA-256; nada de plugins (`object-src`) ni
// de `<base>` ajeno. Imágenes, conexiones y vídeos quedan abiertos a `https:`:
// la web tira de muchos servicios (Supabase, Open-Meteo, Overpass, CityBikes,
// el Consorcio, fotos de Wikimedia y de los propios sitios…) y cerrarlos uno a
// uno rompería algo en cuanto se añada otro, a cambio de poco.
//
// `worker-src blob:` es para MapLibre, que monta sus workers desde un blob.
// El panel (`admin/`) no pasa por aquí: es Flutter compilado y va tras el login.

const SCRIPT_EN_LINEA = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
const META_CSP = /\n?[ \t]*<meta http-equiv="Content-Security-Policy"[^>]*>/;

/// La política de una página con estas huellas de scripts en línea.
export function politica(huellas) {
  return [
    "default-src 'self'",
    `script-src 'self' https://www.gstatic.com${huellas.map((h) => ` '${h}'`).join('')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    'frame-src https:',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/// El HTML con su meta CSP al día (justo detrás del charset).
export function conCsp(html) {
  const huellas = [];
  for (const [, atributos, codigo] of html.matchAll(SCRIPT_EN_LINEA)) {
    // Los `type` que no son JavaScript (ld+json, plantillas) no se ejecutan.
    const tipo = /\btype="([^"]+)"/.exec(atributos)?.[1];
    if (tipo && !/javascript|module/.test(tipo)) continue;
    huellas.push(`sha256-${createHash('sha256').update(codigo, 'utf8').digest('base64')}`);
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${politica(huellas)}">`;
  const sinMeta = html.replace(META_CSP, '');
  return sinMeta.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n  ${meta}`);
}

/// Cómo debe quedar una página: versiones y CSP al día.
export function preparar(html) {
  return conCsp(versionar(html));
}

/// Las páginas cuyo HTML no lleva las versiones o la CSP al día.
export function desfasadas() {
  return paginas(RAIZ).filter((p) => {
    const html = readFileSync(p, 'utf8');
    return preparar(html) !== html;
  }).map((p) => relative(RAIZ, p));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pendientes = desfasadas();
  if (process.argv.includes('--comprobar')) {
    if (pendientes.length) {
      console.error(`Versiones sin actualizar en: ${pendientes.join(', ')}\nEjecuta: node tool/versionar.mjs`);
      process.exit(1);
    }
    console.log('Versiones al día.');
  } else {
    for (const p of pendientes) {
      const ruta = join(RAIZ, p);
      writeFileSync(ruta, preparar(readFileSync(ruta, 'utf8')));
    }
    console.log(pendientes.length ? `Actualizadas: ${pendientes.join(', ')}` : 'Versiones al día.');
  }
}
