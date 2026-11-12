// El horario de OpenStreetMap, dicho en castellano.
//
//   node --test tool/horario_legible.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const ctx = { console, window: {}, localStorage: { getItem: () => null, setItem() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync('lugares.js', 'utf8'), ctx);
const { horarioLegible } = ctx.window.sevitimeLugares;

test('días seguidos y un día cerrado', () => {
  assert.equal(horarioLegible('Mo-Fr 09:00-14:00; Sa off'),
    'Lunes a viernes, de 09:00 a 14:00. Sábado, cerrado');
});

test('horario partido', () => {
  assert.equal(horarioLegible('Mo-Sa 13:00-16:30,20:00-24:00'),
    'Lunes a sábado, de 13:00 a 16:30 y de 20:00 a 24:00');
});

test('días sueltos, tramos y festivos mezclados', () => {
  assert.equal(horarioLegible('Mo,We-Fr,PH 10:00-13:00'),
    'Lunes, miércoles a viernes y festivos, de 10:00 a 13:00');
});

test('sin días es todos los días a esa hora', () => {
  assert.equal(horarioLegible('08:00-23:00'), 'De 08:00 a 23:00');
});

test('abierto siempre', () => {
  assert.equal(horarioLegible('24/7'), 'Abierto las 24 horas');
});

test('lo que no se entiende entero se deja como viene', () => {
  for (const raro of [
    'Mo-Fr 09:00-14:00; Jul-Aug off',
    'sunrise-sunset',
    'Mo-Fr 09:00-14:00 "previa cita"',
    'week 1-26 Mo 10:00-12:00',
    'Mo-Fr 09:00-14:00 || Sa 10:00-12:00',
  ]) {
    assert.equal(horarioLegible(raro), raro);
  }
});

test('vacío sigue vacío', () => {
  assert.equal(horarioLegible(''), '');
  assert.equal(horarioLegible(null), '');
});
