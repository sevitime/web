// Tocar la dirección de una ficha la abre en la app de mapas (14-nov-2026),
// como en la app (`NavigationUtils.mostrarEnMaps`, `geo:`).
//
//   node --test tool/enlace_mapa.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ctx = { console, window: {}, localStorage: { getItem: () => null, setItem() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
const { enlaceAlMapa } = ctx.window.sevitimeLugares;

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; A142) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

test('en Android, geo: para la app de mapas de cada uno', () => {
  const u = enlaceAlMapa(37.3886, -5.9953, 'Bar Pepe', ANDROID);
  assert.ok(u.startsWith('geo:37.3886,-5.9953?q=37.3886,-5.9953'), u);
  assert.ok(decodeURIComponent(u).includes('(Bar Pepe)'), u);
});

test('en iPhone, Apple Maps', () => {
  const u = enlaceAlMapa(37.3886, -5.9953, 'Bar Pepe', IPHONE);
  assert.ok(u.startsWith('https://maps.apple.com/?'), u);
  assert.ok(u.includes('ll=37.3886,-5.9953'), u);
});

test('en el ordenador, Google Maps en el navegador', () => {
  const u = enlaceAlMapa(37.3886, -5.9953, 'Bar Pepe', ESCRITORIO);
  assert.ok(u.startsWith('https://www.google.com/maps/search/?api=1&query=37.3886,-5.9953'), u);
});
