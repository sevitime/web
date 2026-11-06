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

// --- Lo que le pasa a la ciudad y no lo ha hecho nadie ----------------------
//
// Entró el 6-nov-2026: «Qué pasa», contando solo lo de la gente, estuvo
// vacía 19 de los 30 días anteriores. Estas entradas no tienen autor, así
// que no hay apodo ni perfil al que ir. Tiene que decir lo mismo que la app
// (`ItemCronologia`), o la web y la app dejan de contar lo mismo.

const DE_LA_CIUDAD = ['lugar_nuevo', 'lugar_desaparecido', 'evento_nuevo'];

const deLaCiudad = (tipo, extra) => ({
  tipo,
  apodo: null,
  sitio: 'Bar Pepe',
  cuando: '2026-11-06T05:17:00Z',
  ...extra,
});

test('sin autor no se pinta un enlace a un perfil que no existe', () => {
  const C = cargar();
  for (const tipo of DE_LA_CIUDAD) {
    const p = C.linea(deLaCiudad(tipo, { place_key: '37.39_-5.99' }));
    const perfiles = enlaces(p).filter((a) => a.href.startsWith('/perfil/'));
    assert.equal(perfiles.length, 0, tipo);
  }
});

test('la línea empieza por la frase y acaba en el nombre del sitio', () => {
  const C = cargar();
  assert.equal(C.frase(deLaCiudad('lugar_nuevo')), 'Nuevo en el mapa:');
  assert.equal(C.frase(deLaCiudad('evento_nuevo')), 'Nuevo evento:');
  const p = C.linea(deLaCiudad('lugar_nuevo', { place_key: '37.39_-5.99' }));
  const sitio = enlaces(p).find((a) => a.textContent === 'Bar Pepe');
  assert.ok(sitio, 'el sitio sigue llevando a su ficha');
});

test('de un sitio que desaparece NUNCA se dice que ha cerrado', () => {
  // Que no esté en OpenStreetMap no demuestra que haya cerrado: puede ser un
  // editor que borró el nodo o un espejo que contestó a medias. Afirmar un
  // cierre falso de un negocio real es el fallo que no se perdona.
  const C = cargar();
  const texto = C.frase(deLaCiudad('lugar_desaparecido')).toLowerCase();
  assert.ok(texto.includes('ya no aparece en el mapa'), texto);
  assert.ok(!texto.includes('cerrad'), texto);
});

test('nada de la ciudad se enseña entre comillas como si lo hubiera dicho alguien', () => {
  const C = cargar();
  for (const tipo of DE_LA_CIUDAD) {
    assert.equal(C.cita(deLaCiudad(tipo, { texto: 'algo' })), null, tipo);
  }
});

test('de un evento nuevo se dice dónde es', () => {
  const C = cargar();
  assert.equal(
    C.detalle(deLaCiudad('evento_nuevo', { texto: 'Teatro Lope de Vega' })),
    'En Teatro Lope de Vega',
  );
});

test('lo de la gente no se confunde con lo de la ciudad', () => {
  const C = cargar();
  assert.equal(C.esDeLaCiudad(entrada()), false);
  for (const tipo of DE_LA_CIUDAD) {
    assert.equal(C.esDeLaCiudad(deLaCiudad(tipo)), true, tipo);
  }
});
