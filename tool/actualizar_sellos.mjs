#!/usr/bin/env node
// Genera `pasaporte/sellos.js` leyendo los sellos del repo de la app
// (`lib/services/passport_service.dart`) y los iconos de `tool/sellos_svg.json`.
//
// POR QUÉ ASÍ. El catálogo de sellos —qué monumentos hay, cómo se llaman, de
// qué color y qué pista se da— es una lista que ya existe y que se puede
// equivocar en un solo sitio: la app. Copiarla a mano a la web es pedir que
// dentro de seis meses digan cosas distintas, como ya pasó con las categorías
// de lugares (ver `actualizar_categorias.mjs`, mismo patrón).
//
// Uso, cuando se añada o se cambie un sello en la app:
//
//   node tool/actualizar_sellos.mjs
//
// Por defecto busca el otro repo como hermano de este (~/Documentos/sevitime
// y ~/Documentos/sevitime-web). Si está en otro sitio:
//
//   RUTA_APP=/ruta/al/repo/de/la/app node tool/actualizar_sellos.mjs
//
// LOS ICONOS NO SALEN DE AQUÍ. `tool/sellos_svg.json` lleva el trazado SVG de
// cada icono, sacado **una vez** de `MaterialIcons-Regular.otf` del SDK de
// Flutter (el mismo fichero que usa la app, licencia Apache 2.0) con
// fontTools: se buscó el codepoint de cada `Icons.*_rounded` en
// `icons.dart`, se extrajo el contorno del glifo y se escaló a la caja de
// 24×24 dando la vuelta al eje Y. Así la web enseña **el mismo dibujo** que
// el móvil y no un emoji parecido. Si se añade un sello con un icono nuevo,
// hay que añadir su trazado a ese JSON por el mismo camino; mientras no
// esté, el sello sale con el icono de monumento, como en la app.
//
// Si un sello del Dart no tiene icono en el JSON, este script avisa y sigue:
// que falte un dibujo no debe dejar la página sin el resto del pasaporte.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const repoApp = process.env.RUTA_APP || path.resolve(raiz, '..', 'sevitime');
const dart = path.join(repoApp, 'lib', 'services', 'passport_service.dart');

const fuente = readFileSync(dart, 'utf8');
const svg = JSON.parse(readFileSync(path.join(aqui, 'sellos_svg.json'), 'utf8'));

const ini = fuente.indexOf('static const List<PassportStamp> stamps = [');
if (ini < 0) {
  console.error('No encuentro la lista de sellos en ' + dart);
  process.exit(1);
}
const bloque = fuente.slice(ini, fuente.indexOf('\n  ];', ini));

const texto = (t, campo) => {
  const m = t.match(new RegExp(campo + ":\\s*'((?:[^'\\\\]|\\\\.)*)'"));
  return m ? m[1].replace(/\\'/g, "'") : null;
};
const numero = (t, campo) => {
  const m = t.match(new RegExp(campo + ':\\s*(-?[0-9.]+)'));
  return m ? Number(m[1]) : null;
};

const sellos = [];
const faltan = [];
for (const trozo of bloque.split('PassportStamp(').slice(1)) {
  const id = texto(trozo, 'id');
  if (!id) continue;
  const color = trozo.match(/colorHex:\s*0x[fF]{2}([0-9a-fA-F]{6})/);
  const nombreIcono = svg.iconos[id];
  const d = nombreIcono ? svg.paths[nombreIcono] : null;
  if (!d) faltan.push(id);
  sellos.push({
    id,
    label: texto(trozo, 'label'),
    color: color ? '#' + color[1].toUpperCase() : '#00897B',
    hint: texto(trozo, 'hint'),
    // `zona` = los de «la primera vez que…», que se consiguen en cualquier
    // sitio de ese tipo; los demás son un monumento concreto.
    zona: /matchTypes:/.test(trozo),
    lat: numero(trozo, 'lat'),
    lon: numero(trozo, 'lon'),
    d: d || null,
  });
}

const cabecera = `// Catálogo de sellos del Pasaporte. **Generado**, no se edita a mano:
//
//   node tool/actualizar_sellos.mjs
//
// Sale de lib/services/passport_service.dart del repo de la app, y los
// trazados de los iconos de tool/sellos_svg.json (Material Icons, los mismos
// que dibuja el móvil). Si cambias un sello, cámbialo allí y vuelve a
// generar esto.
`;

writeFileSync(
  path.join(raiz, 'pasaporte', 'sellos.js'),
  cabecera + 'window.sevitimeSellos = ' + JSON.stringify(sellos, null, 1) + ';\n',
  'utf8',
);

console.log('pasaporte/sellos.js: ' + sellos.length + ' sellos');
if (faltan.length) {
  console.warn('Sin trazado de icono (saldrán con el de monumento): ' + faltan.join(', '));
}
