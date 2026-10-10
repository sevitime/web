// Que ninguna página apunte a una versión vieja de sus estilos o scripts.
//
// Si se cambia `estilo.css` y no se ejecuta `node tool/versionar.mjs`, las
// páginas siguen pidiendo la dirección de antes y el navegador sirve la copia
// que tenía guardada: el cambio «no se ve» durante un rato y nadie sabe por
// qué. Este test falla en ese caso y dice qué ejecutar.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { desfasadas, versionar } from './versionar.mjs';

test('todas las páginas llevan la versión actual de sus ficheros', () => {
  assert.deepEqual(desfasadas(), [], 'Ejecuta: node tool/versionar.mjs');
});

test('las librerías y el panel no se versionan', () => {
  const html = '<script src="/libs/supabase.min.js"></script><script src="/admin/main.dart.js"></script>';
  assert.equal(versionar(html), html);
});

test('una versión vieja se sustituye, no se acumula', () => {
  const salida = versionar('<link rel="stylesheet" href="/estilo.css?v=00000000">');
  assert.match(salida, /^<link rel="stylesheet" href="\/estilo\.css\?v=[0-9a-f]{8}">$/);
  assert.equal(versionar(salida), salida);
});
