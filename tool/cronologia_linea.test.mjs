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

// El texto sin el icono, que es decorativo y va en su propio span.
const texto = (p) => p.hijos
  .filter((h) => (h.className || '') !== 'crono-icono')
  .map((h) => h.textContent).join('');

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

test('de un sitio de la provincia se dice el pueblo', () => {
  // Sin esto, «Nuevo en el mapa: Bar La Paz» hace creer que está en tu barrio
  // cuando está en Écija, a 76 km. Igual que en la app.
  const C = cargar();
  assert.equal(C.detalle(deLaCiudad('lugar_nuevo', { texto: 'Écija' })), 'En Écija');
  assert.equal(C.detalle(deLaCiudad('lugar_desaparecido', { texto: 'Utrera' })), 'En Utrera');
});

test('un sitio de la capital no dice pueblo', () => {
  const C = cargar();
  assert.equal(C.detalle(deLaCiudad('lugar_nuevo')), null);
});

test('cada suceso lleva su icono pegado al nombre del sitio', () => {
  // Lo pidió el usuario: «si añade un lugar, el suceso lleva una chincheta;
  // si se edita algo, un lápiz». Tiene que ser el mismo que el de la app.
  const C = cargar();
  const de = (tipo) => (C.icono({ tipo }) || {}).textContent;
  assert.equal(de('lugar'), '📍');
  assert.equal(de('lugar_nuevo'), '📍');
  assert.equal(de('dato'), '✏️');
  assert.equal(de('lugar_datos'), '✏️');
  assert.equal(de('resena'), '⭐');
  assert.equal(de('ruta'), '🧭');
  // Un tipo desconocido no inventa icono.
  assert.equal(C.icono({ tipo: 'loquesea' }), null);
});

test('el icono es decorativo para un lector de pantalla', () => {
  // Lo que dice ya está en la frase: leer «estrella» en cada línea es ruido.
  const C = cargar();
  const n = C.icono({ tipo: 'resena' });
  assert.equal(n.className, 'crono-icono');
});

test('los cambios del mapa se cuentan con sus palabras, no «ha participado»', () => {
  // Los iconos de los cambios del mapa se añadieron el 6-nov-2026 y las
  // frases no: en la web un cambio de nombre se leía «ha participado en Bar
  // Pepe» y encima no contaba como noticia de la ciudad. La app lo decía bien
  // desde el primer día; esto es la paridad que falta.
  const C = cargar();
  assert.equal(C.frase(deLaCiudad('lugar_renombrado', { texto: 'Taberna Pepe' })),
    'Ha cambiado de nombre:');
  assert.equal(C.detalle(deLaCiudad('lugar_renombrado', { texto: 'Taberna Pepe' })),
    'Ahora se llama Taberna Pepe');
  assert.ok(C.esDeLaCiudad({ tipo: 'lugar_renombrado' }));
  assert.ok(C.esDeLaCiudad({ tipo: 'lugar_datos' }));
});

test('lo que gana un sitio en el mapa se dice igual que en la app', () => {
  // Las mismas frases que `ItemCronologia._fraseDeLoQueGano`: si se cambia
  // una, se cambia la otra.
  const C = cargar();
  const frase = (texto) => C.frase(deLaCiudad('lugar_datos', { texto }));
  assert.equal(frase('horario'), 'Ya tiene horario:');
  assert.equal(frase('horario,telefono,web'), 'Ya tiene horario, teléfono y web:');
  assert.equal(frase('terraza'), 'Se ha añadido el dato de la terraza:');
  assert.equal(C.frase(deLaCiudad('lugar_datos', { texto: 'terraza', sitio: 'Albarama' })),
    'Ahora consta en el mapa que tiene terraza:');
  assert.equal(C.frase(deLaCiudad('lugar_datos', { texto: 'terraza', sitio: 'Boston' })),
    'Ya figura con terraza en el mapa:');
  assert.equal(frase('accesibilidad'), 'Ya se sabe que es accesible:');
  assert.equal(frase('cocina'), 'Ya se sabe qué se come allí:');
  assert.equal(frase('historia'), 'Ya se puede leer su historia:');
  assert.equal(frase(null), 'Hay más datos en el mapa:');
});

test('delante de «historia» la conjunción es «e», no «y»', () => {
  const C = cargar();
  const frase = (texto) => C.frase(deLaCiudad('lugar_datos', { texto }));
  assert.equal(frase('horario,historia'), 'Ya tiene horario e historia:');
  assert.equal(frase('horario,web,historia'), 'Ya tiene horario, web e historia:');
  assert.equal(frase('historia,web'), 'Ya tiene historia y web:');
});

test('un cambio del mapa no se enseña como cita de nadie', () => {
  // `texto` trae la lista de campos, que ya va dentro de la frase.
  const C = cargar();
  assert.equal(C.cita(deLaCiudad('lugar_datos', { texto: 'horario' })), null);
  assert.equal(C.cita(deLaCiudad('lugar_renombrado', { texto: 'Otro' })), null);
});
