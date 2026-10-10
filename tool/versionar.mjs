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

/// Las páginas cuyo HTML no lleva las versiones al día.
export function desfasadas() {
  return paginas(RAIZ).filter((p) => {
    const html = readFileSync(p, 'utf8');
    return versionar(html) !== html;
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
      writeFileSync(ruta, versionar(readFileSync(ruta, 'utf8')));
    }
    console.log(pendientes.length ? `Actualizadas: ${pendientes.join(', ')}` : 'Versiones al día.');
  }
}
