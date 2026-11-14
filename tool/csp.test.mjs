// La CSP de cada página (revisión de seguridad del 14-nov-2026, n.º 4).
//
// Solo se ejecutan scripts de la propia web, de Firebase (gstatic.com) y los
// que van dentro de la página, autorizados por su huella. Si alguien edita
// uno de esos scripts y no ejecuta `node tool/versionar.mjs`, la huella deja
// de coincidir y el navegador lo bloquea: por eso el test de versiones también
// falla en ese caso.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { conCsp, politica } from './versionar.mjs';

const huella = (codigo) => `'sha256-${createHash('sha256').update(codigo, 'utf8').digest('base64')}'`;

const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>x</title><script defer src="/nav.js"></script>
<script type="application/ld+json">{"@type":"Place"}</script>
<script>console.log('hola')</script></head><body></body></html>`;

test('la meta CSP va justo detrás del charset, antes de cualquier script', () => {
  const html = conCsp(PAGINA);
  const i = html.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(i > html.indexOf('<meta charset="utf-8">'));
  assert.ok(i < html.indexOf('<script'));
});

test('autoriza los scripts de dentro de la página por su huella, y no los ld+json', () => {
  const html = conCsp(PAGINA);
  assert.ok(html.includes(huella("console.log('hola')")));
  assert.ok(!html.includes(huella('{"@type":"Place"}')));
});

test('lo esencial: scripts propios y de gstatic, sin plugins ni <base> ajeno', () => {
  const p = politica([]);
  assert.match(p, /script-src 'self' https:\/\/www\.gstatic\.com(;| )/);
  assert.match(p, /object-src 'none'/);
  assert.match(p, /base-uri 'self'/);
  assert.match(p, /worker-src 'self' blob:/);
  assert.ok(!p.includes("'unsafe-inline'; ") || !/script-src[^;]*unsafe-inline/.test(p));
  assert.ok(!/script-src[^;]*unsafe-eval/.test(p));
});

test('aplicarla dos veces no cambia nada, y si cambia el script cambia la huella', () => {
  const una = conCsp(PAGINA);
  assert.equal(conCsp(una), una);
  const otra = conCsp(una.replace("console.log('hola')", "console.log('adiós')"));
  assert.ok(otra.includes(huella("console.log('adiós')")));
  assert.ok(!otra.includes(huella("console.log('hola')")));
  assert.equal((otra.match(/Content-Security-Policy/g) || []).length, 1);
});

test('también con el charset escrito como <meta charset="utf-8" /> (la del mapa)', () => {
  const html = conCsp('<head><meta charset="utf-8" />\n<script>x()</script></head>');
  assert.ok(html.includes('Content-Security-Policy'));
});
