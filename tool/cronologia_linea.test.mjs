// A dónde lleva cada nombre de la cronología.
//
// Antes el apodo era solo texto en negrita: de la persona no se podía llegar
// a su perfil, y en cambio tocar la fila entera abría el sitio. Cada nombre
// lleva a lo que nombra, y tiene que ser igual que en la app
// (`LineaCronologia`).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

/// Un `document` con lo justo que usa `linea()`.
function documentoDePega() {
  const crear = (tag) => ({
    tag,
    className: '',
    href: '',
    textContent: '',
    hijos: [],
    style: {},
    appendChild(h) { this.hijos.push(h); return h; },
    setAttribute() {},
  });
  return {
    createElement: crear,
    createTextNode: (texto) => ({ tag: '#texto', textContent: texto, hijos: [] }),
  };
}

function cargar() {
  const window = {};
  const document = documentoDePega();
  const contexto = vm.createContext({
    window, document, console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.resolve({ ok: false }),
  });
  vm.runInContext(
    readFileSync(new URL('../cronologia/comun.js', import.meta.url), 'utf8'),
    contexto,
  );
  return window.SeviCrono;
}

const entrada = (extra) => ({
  tipo: 'resena',
  apodo: 'Ana',
  sitio: 'Bar Pepe',
  cuando: '2026-11-05T12:00:00Z',
  ...extra,
});

const enlaces = (p) => p.hijos.filter((h) => h.tag === 'a');

test('el apodo lleva al perfil de quien lo hizo', () => {
  const C = cargar();
  const p = C.linea(entrada({ place_key: '37.39_-5.99' }));
  const apodo = enlaces(p).find((a) => a.textContent === 'Ana');
  assert.ok(apodo, 'el apodo debe ser un enlace');
  assert.equal(apodo.href, '/perfil/?n=Ana');
});

test('un apodo con espacios o acentos viaja bien en la dirección', () => {
  const C = cargar();
  const p = C.linea(entrada({ apodo: 'Ana Pérez' }));
  const apodo = enlaces(p).find((a) => a.textContent === 'Ana Pérez');
  assert.equal(apodo.href, '/perfil/?n=Ana%20P%C3%A9rez');
});

test('el nombre del sitio sigue llevando a su ficha', () => {
  const C = cargar();
  const p = C.linea(entrada({ place_key: '37.39_-5.99' }));
  const sitio = enlaces(p).find((a) => a.textContent === 'Bar Pepe');
  assert.equal(sitio.href, '/lugar/?k=37.39_-5.99');
});

test('sin sitio al que ir, el apodo sigue llevando al perfil', () => {
  const C = cargar();
  const p = C.linea(entrada({ tipo: 'comentario_evento' }));
  const puestos = enlaces(p);
  assert.equal(puestos.length, 1);
  assert.equal(puestos[0].href, '/perfil/?n=Ana');
});
