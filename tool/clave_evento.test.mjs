// Pruebas de eventos/clave.js. Son los MISMOS casos que
// test/clave_evento_test.dart en la app: si cambias uno, cambia el otro.
//
//   node --test tool/clave_evento.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../eventos/clave.js');
const { claveEvento, diaEnMadrid, nombreParaClave } = globalThis.SeviClave;

const dias = {
  '2026-09-25T22:30:00Z': '2026-09-26',
  '2026-09-25T21:59:00Z': '2026-09-25',
  '2026-12-31T23:30:00Z': '2027-01-01',
  '2026-12-31T22:59:00Z': '2026-12-31',
  '2026-03-28T23:30:00Z': '2026-03-29',
  '2026-03-29T00:59:00Z': '2026-03-29',
  '2026-03-29T22:30:00Z': '2026-03-30',
  '2026-10-24T22:30:00Z': '2026-10-25',
  '2026-10-25T22:30:00Z': '2026-10-25',
  '2026-10-25T23:30:00Z': '2026-10-26',
};
for (const [instante, dia] of Object.entries(dias)) {
  test(`diaEnMadrid ${instante} → ${dia}`, () => assert.equal(diaEnMadrid(instante), dia));
}

const nombres = {
  'I Love Reggaeton y Nostalgia Milenial Fest': 'i love reggaeton y nostalgia milenial fest',
  "Love The 90's Sevilla 2026": 'love the 90 s sevilla 2026',
  'Papá Levante': 'papa levante',
  'CONCIERTO ÑANDÚ – Sala X!': 'concierto nandu sala x',
  'Çava   Über': 'cava uber',
  '🎸🎸': 'evento',
  '': 'evento',
};
for (const [nombre, esperado] of Object.entries(nombres)) {
  test(`nombreParaClave «${nombre}»`, () => assert.equal(nombreParaClave(nombre), esperado));
}

test('corta a 150 caracteres', () => assert.equal(nombreParaClave('a'.repeat(400)).length, 150));

test('con id de la tabla, manda el id', () => {
  assert.equal(claveEvento({ ref: 'eventos:10', nombre: 'x', inicio: '2026-10-22T20:00:00Z' }), 'eventos:10');
});

test('sin id, día de Madrid y nombre', () => {
  assert.equal(claveEvento({ nombre: 'The Lemon Twigs', inicio: '2026-10-22T20:00:00Z' }),
    'n:2026-10-22:the lemon twigs');
});

const { instanteDesdeMadrid } = globalThis.SeviClave;
test('instanteDesdeMadrid en verano (+2)', () => {
  assert.equal(instanteDesdeMadrid(2026, 10, 22, 22, 0).toISOString(), '2026-10-22T20:00:00.000Z');
});
test('instanteDesdeMadrid en invierno (+1)', () => {
  assert.equal(instanteDesdeMadrid(2026, 11, 20, 21, 0).toISOString(), '2026-11-20T20:00:00.000Z');
});
test('instanteDesdeMadrid y diaEnMadrid se deshacen', () => {
  assert.equal(diaEnMadrid(instanteDesdeMadrid(2026, 12, 31, 23, 30)), '2026-12-31');
});
