#!/usr/bin/env node
// Copia tool/categorias_lugares.json (generado en el repo de la app, desde
// place_categories_data.dart) dentro del bloque marcado de lugares.js.
//
// Antes lugares.js llevaba las categorías, colores y emojis escritos a mano,
// calcados de lib/models/place_types.dart a ojo. Ahora la app genera un JSON
// con `dart run tool/generar_categorias_lugares.dart` y este script lo copia
// aquí, así que un tipo nuevo solo se escribe una vez.
//
// Uso, tras regenerar el JSON en el repo de la app:
//
//   node tool/actualizar_categorias.mjs
//
// Por defecto busca el otro repo como hermano de este
// (~/Documentos/sevitime y ~/Documentos/sevitime-web). Si está en otro
// sitio, indícalo con RUTA_CATEGORIAS=/ruta/a/categorias_lugares.json.
//
// No lo lanza ningún cron ni GitHub Actions: los tipos de lugar cambian pocas
// veces al año y esto solo reescribe un fichero estático que ya se sirve tal
// cual, así que no hace falta gastar minutos en automatizarlo.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_JSON = process.env.RUTA_CATEGORIAS ||
  path.resolve(AQUI, '../../sevitime/tool/categorias_lugares.json');
const RUTA_LUGARES_JS = path.resolve(AQUI, '../lugares.js');

const INICIO = '// ===== INICIO categorias-lugares (generado, no editar a mano) =====';
const FIN = '// ===== FIN categorias-lugares =====';

function main() {
  let json;
  try {
    json = readFileSync(RUTA_JSON, 'utf8');
  } catch (e) {
    console.error(`No se pudo leer ${RUTA_JSON}.`);
    console.error('¿Has ejecutado, en el repo de la app, '
      + '"dart run tool/generar_categorias_lugares.dart"?');
    console.error(String(e.message || e));
    process.exit(1);
  }

  const datos = JSON.parse(json);
  if (!datos.tipos || !datos.filtros) {
    console.error(`${RUTA_JSON} no tiene la forma esperada (faltan "tipos" o "filtros").`);
    process.exit(1);
  }

  const actual = readFileSync(RUTA_LUGARES_JS, 'utf8');
  const inicioIdx = actual.indexOf(INICIO);
  const finIdx = actual.indexOf(FIN);
  if (inicioIdx === -1 || finIdx === -1 || finIdx < inicioIdx) {
    console.error(`No encuentro los marcadores "${INICIO}" / "${FIN}" en ${RUTA_LUGARES_JS}.`);
    process.exit(1);
  }

  const bloque = `${INICIO}\n`
    + '// Fuente: sevitime/lib/models/place_categories_data.dart. Para cambiar\n'
    + '// un tipo o un filtro, edita ese fichero, ejecuta allí\n'
    + '// "dart run tool/generar_categorias_lugares.dart" y luego aquí\n'
    + '// "node tool/actualizar_categorias.mjs".\n'
    + `const CATEGORIAS_LUGARES = ${JSON.stringify(datos, null, 2)};\n`;

  const nuevo = actual.slice(0, inicioIdx) + bloque + actual.slice(finIdx);
  writeFileSync(RUTA_LUGARES_JS, nuevo);

  const nTipos = Object.keys(datos.tipos).length;
  console.log(`lugares.js actualizado: ${nTipos} tipos, ${datos.filtros.length} filtros `
    + `(desde ${RUTA_JSON}).`);
}

main();
