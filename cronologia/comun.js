// Lo que comparten la pantalla de la cronología y la tira de la portada.
//
// Son dos presentaciones de lo mismo —una lista entera y un resumen de tres
// líneas—, y lo que no puede diferir es cómo se nombra a la gente, cómo se
// dicen las fechas y cómo se pinta un avatar. El resto lo pone cada una.
(function () {
  'use strict';

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function haceCuanto(iso) {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 60) return min <= 1 ? 'ahora mismo' : 'hace ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return h === 1 ? 'hace 1 hora' : 'hace ' + h + ' horas';
    const d = Math.round(h / 24);
    if (d < 7) return d === 1 ? 'ayer' : 'hace ' + d + ' días';
    const sem = Math.round(d / 7);
    if (sem < 5) return sem === 1 ? 'hace 1 semana' : 'hace ' + sem + ' semanas';
    // El año solo cuando no es el de ahora, igual que `timeAgo` en la app
    // (`lib/utils/date_utils.dart`): «Qué pasa» mezcla cosas de hace meses y
    // en enero habría dos años diciendo «4 de septiembre».
    const f = new Date(iso);
    const opciones = { day: 'numeric', month: 'long' };
    if (f.getFullYear() !== new Date().getFullYear()) opciones.year = 'numeric';
    return f.toLocaleDateString('es-ES', opciones);
  }

  function estrellas(n) {
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    return '★'.repeat(v) + '☆'.repeat(5 - v);
  }

  // Los avatares no son URLs: la mayoría son `preset:<id>`, un dibujo de los
  // doce que ofrece la app. Pintarlos como imagen daba un error de esquema
  // desconocido y dejaba el hueco en blanco. Mismas tablas que `perfil.js`.
  const COLOR_PRESET = {
    giralda: '#00897B', catedral: '#5E7A8A', azahar: '#7CB342', ceramica: '#1E88E5',
    rebujito: '#C0A020', barco: '#00838F', flamenco: '#AD1457', abanico: '#6D4C9F',
    farol: '#E65100', sol: '#F9A825', madruga: '#37474F', cafe: '#6D4C41',
  };
  const EMOJI_PRESET = {
    giralda: '🏛️', catedral: '⛪', azahar: '🌸', ceramica: '🔷',
    rebujito: '🍷', barco: '⛵', flamenco: '🎵', abanico: '🎐',
    farol: '💡', sol: '☀️', madruga: '🌙', cafe: '☕',
  };

  // El icono que va donde iría el avatar cuando no hay autor. Deja claro de
  // un vistazo que esto no lo ha puesto una persona.
  const ICONO_CIUDAD = {
    lugar_nuevo: '📍', lugar_desaparecido: '🚫', evento_nuevo: '📅',
  };

  function avatar(item) {
    if (esDeLaCiudad(item)) {
      const d = el('span', 'crono-avatar crono-inicial crono-ciudad',
        ICONO_CIUDAD[item.tipo] || '📍');
      // Gris y no rojo en lo que desaparece: no decimos que haya cerrado, y
      // el rojo se lee como una alarma.
      d.style.background = item.tipo === 'lugar_desaparecido' ? '#78909C' : '#00897B';
      return d;
    }
    const guardado = item.avatar || '';
    if (guardado.indexOf('preset:') === 0) {
      const id = guardado.slice(7);
      const d = el('span', 'crono-avatar crono-inicial', EMOJI_PRESET[id] || '📍');
      d.style.background = COLOR_PRESET[id] || '#00897B';
      return d;
    }
    if (guardado) {
      const img = document.createElement('img');
      img.className = 'crono-avatar';
      img.src = guardado;
      img.alt = '';
      img.width = 40;
      img.height = 40;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      return img;
    }
    // Sin nada, la inicial sobre un disco, como en el cuadro de honor.
    return el('span', 'crono-avatar crono-inicial',
      (item.apodo || '?').trim().charAt(0).toUpperCase());
  }


  // Qué hizo cada persona, en palabras. La misma tabla que
  // `ItemCronologia.frase` en la app (`lib/models/item_cronologia.dart`): si
  // cambia una, cambian las dos, o la web y la app dejan de contar lo mismo.
  //
  // Todas llevan el sitio detrás, así que piden sustantivo: «ha avisado del
  // cierre de El Ambigú» y no «ha avisado de que El Ambigú ha cerrado».
  const FRASES = {
    lugar: 'ha añadido',
    resena: 'ha reseñado',
    resena_foto: 'ha reseñado',
    aviso_cerrado: 'ha avisado del cierre de',
    aviso_no_existe: 'ha avisado de la desaparición de',
    aviso_renombrado: 'ha avisado del nuevo nombre de',
    ruta: 'ha publicado la ruta',
    evento: 'ha propuesto',
    comentario_evento: 'ha comentado en',
    // De la ciudad: no las ha hecho nadie, así que no llevan apodo delante.
    // La frase ES el principio de la línea y acaba en dos puntos: «Nuevo en
    // el mapa: Bar Pepe». Ver docs/sql/cronologia_ciudad.sql en el repo de
    // la app.
    lugar_nuevo: 'Nuevo en el mapa:',
    // NUNCA «ha cerrado»: que un sitio desaparezca de OpenStreetMap no
    // demuestra que haya cerrado, y decirlo de un negocio real que sigue
    // abierto es el fallo que no se perdona.
    lugar_desaparecido: 'Ya no aparece en el mapa:',
    // El sitio ha cambiado de nombre en el mapa: el negocio ha cambiado de
    // manos. `sitio` es el nombre VIEJO, que es el que la gente reconoce; el
    // nuevo va en el detalle.
    lugar_renombrado: 'Ha cambiado de nombre:',
    // El servidor NO manda `evento_nuevo` desde el 6-nov-2026: «Qué pasa» es
    // el registro de lo que le pasa a los SITIOS, y los eventos tienen
    // pantalla propia. Se queda escrito por si se decide al revés.
    evento_nuevo: 'Nuevo evento:',
  };

  // Lo que le pasa a la ciudad y no ha hecho nadie. Mismo criterio que
  // `ItemCronologia.esDeLaCiudad` en la app: por el tipo, no por si falta el
  // apodo, para que una entrada de la gente mal formada no se cuele
  // disfrazada de noticia del mapa.
  //
  // `lugar_renombrado` y `lugar_datos` faltaban aquí y en FRASES: los iconos
  // sí se añadieron el 6-nov-2026 y las frases no, así que un cambio del mapa
  // se leía en la web como «ha participado en Bar Pepe» y encima no contaba
  // como noticia de la ciudad. La app lo decía bien desde el primer día.
  const DE_LA_CIUDAD = [
    'lugar_nuevo', 'lugar_desaparecido', 'lugar_renombrado', 'lugar_datos',
    'evento_nuevo',
  ];
  function esDeLaCiudad(item) {
    return DE_LA_CIUDAD.indexOf(item.tipo) >= 0;
  }

  const ARTICULOS = { horario: 'el', 'teléfono': 'el', web: 'la' };

  // La conjunción que toca delante de una palabra: la «y» se convierte en «e»
  // ante sonido /i/ («horario e historia»), salvo `hie-`, que suena /je/ y
  // mantiene la «y» («agua y hielo»). Igual que `ItemCronologia._conjuncion`.
  function conjuncion(palabra) {
    const p = String(palabra || '').toLowerCase();
    if (p.indexOf('i') === 0 || p.indexOf('í') === 0) return 'e';
    if (p.indexOf('hi') === 0 && p.indexOf('hie') !== 0) return 'e';
    return 'y';
  }

  // «horario, teléfono e historia».
  function enumerar(cosas) {
    if (!cosas.length) return '';
    const partes = cosas.slice();
    const ultimo = partes.pop();
    if (!partes.length) return ultimo;
    return partes.join(', ') + ' ' + conjuncion(ultimo) + ' ' + ultimo;
  }

  function trozos(texto) {
    return String(texto || '')
      .split(',')
      .map(function (d) { return d.trim(); })
      .filter(function (d) { return d; });
  }

  // «ha añadido el horario y el teléfono de». `texto` trae lo aportado
  // separado por comas, tal como lo monta `fn_cronologia`.
  function fraseDelDato(texto) {
    const datos = trozos(texto).map(function (d) {
      return (ARTICULOS[d] || 'el') + ' ' + d;
    });

    if (!datos.length) return 'ha completado la ficha de';
    return 'ha añadido ' + enumerar(datos) + ' de';
  }

  // Cómo se escribe cada campo del mapa: `texto` trae las claves tal cual las
  // manda el servidor (CAMPOS en osm-novedades/parseo.ts), y esas claves son
  // identificadores, sin tilde. Igual que `ItemCronologia._comoSeEscribe`.
  const COMO_SE_ESCRIBE = { telefono: 'teléfono' };

  // «Ya tiene horario y teléfono:», con lo que el sitio ha ganado en el mapa.
  // Igual que `ItemCronologia._fraseDeLoQueGano`.
  function fraseDeLoQueGano(texto, sitio) {
    const cosas = trozos(texto);
    if (!cosas.length) return 'Hay más datos en el mapa:';
    // Estas no se «tienen» de repente: se saben. El sitio ya era así; lo que
    // ha cambiado es que ahora consta.
    if (cosas.length === 1) {
      if (cosas[0] === 'terraza') {
        let suma = 0;
        for (let i = 0; i < sitio.length; i++) suma += (i + 1) * sitio.charCodeAt(i);
        return [
          'Ahora consta en el mapa que tiene terraza:',
          'Se ha añadido el dato de la terraza:',
          'Ya figura con terraza en el mapa:',
        ][suma % 3];
      }
      const sueltas = {
        accesibilidad: 'Ya se sabe que es accesible:',
        cocina: 'Ya se sabe qué se come allí:',
        historia: 'Ya se puede leer su historia:',
      };
      if (sueltas[cosas[0]]) return sueltas[cosas[0]];
    }
    return 'Ya tiene ' + enumerar(cosas.map(function (c) {
      return COMO_SE_ESCRIBE[c] || c;
    })) + ':';
  }

  // Lo que dijo esta persona, para enseñarlo entre comillas. Igual que
  // `ItemCronologia.cita` en la app: en una aportación `texto` trae el dato
  // («horario»), que ya va en la frase, y en un renombrado el nombre nuevo.
  function cita(item) {
    // Lo de la ciudad no está en esta lista: su `texto` es el lugar del
    // evento, no algo que haya dicho nadie.
    const citables = ['resena', 'resena_foto', 'comentario_evento', 'ruta'];
    return citables.indexOf(item.tipo) >= 0 ? (item.texto || null) : null;
  }

  // El nombre nuevo de un sitio renombrado, que no cabe en la frase porque
  // esta acaba en el nombre viejo.
  function detalle(item) {
    if (item.tipo === 'aviso_renombrado' && item.texto) {
      return 'Ahora se llama ' + item.texto;
    }
    // Dónde es el evento: `texto` trae el lugar tal como lo da la fuente.
    if (item.tipo === 'evento_nuevo' && item.texto) return 'En ' + item.texto;
    // El pueblo, en los sitios de la provincia. La capital no lo lleva: el
    // servidor manda `texto` solo cuando NO es Sevilla.
    if ((item.tipo === 'lugar_nuevo' || item.tipo === 'lugar_desaparecido')
        && item.texto) {
      return 'En ' + item.texto;
    }
    // El nombre nuevo de un sitio renombrado en el mapa: `sitio` es el viejo.
    if (item.tipo === 'lugar_renombrado' && item.texto) {
      return 'Ahora se llama ' + item.texto;
    }
    return null;
  }

  function frase(item) {
    if (item.tipo === 'dato') return fraseDelDato(item.texto);
    if (item.tipo === 'lugar_datos') return fraseDeLoQueGano(item.texto, item.sitio || '');
    // Un tipo que esta versión de la web no conoce: mejor decir poco que
    // llamar reseña a un aviso de cierre.
    return FRASES[item.tipo] || 'ha participado en';
  }

  // El icono de lo que ha pasado, pegado al nombre del sitio. La misma tabla
  // que `iconoDeCronologia` en la app (`lib/utils/icono_cronologia.dart`): si
  // cambia una, cambia la otra, o el mismo suceso se dibuja distinto en cada
  // sitio.
  //
  // Aquí son emoji y allí iconos de Material. No es un descuido: la web no
  // carga una tipografía de iconos solo para esto, y el emoji lo pinta el
  // sistema sin pedir nada.
  const ICONOS = {
    resena: '⭐', resena_foto: '📷', lugar: '📍', dato: '✏️',
    aviso_cerrado: '⛔', aviso_no_existe: '🚫', aviso_renombrado: '🏷️',
    ruta: '🧭', comentario_evento: '💬',
    lugar_nuevo: '📍', lugar_desaparecido: '🚫',
    lugar_renombrado: '🏷️', lugar_datos: '✏️',
    evento_nuevo: '📅',
  };

  function icono(item) {
    // Un tipo que esta versión no conoce: mejor nada que un icono que diga
    // algo falso.
    const e = ICONOS[item.tipo];
    if (!e) return null;
    const n = el('span', 'crono-icono', e);
    // Decorativo: lo que dice ya está en la frase, y un lector de pantalla
    // leyendo «estrella» en cada línea es ruido.
    n.setAttribute('aria-hidden', 'true');
    return n;
  }

  // A dónde lleva la entrada, o null si no lleva a ninguna página.
  //
  // Los eventos van a la lista y no al evento: la web no tiene todavía una
  // página por evento, así que enlazar a una clave daría un 404.
  function destino(item) {
    if (item.place_key) return '/lugar/?k=' + encodeURIComponent(item.place_key);
    if (item.ruta_id) return '/rutas/?id=' + encodeURIComponent(item.ruta_id);
    if (item.evento_clave) return '/eventos/';
    return null;
  }

  /// «Fulano ha reseñado Tal sitio», con el sitio enlazando a donde toque.
  function linea(item, clase) {
    const p = el('p', clase || 'crono-linea');

    // Cada nombre lleva a lo que nombra: el apodo al perfil de quien lo hizo
    // y el sitio a su ficha. Antes el apodo era solo texto en negrita, así
    // que de la persona no se podía llegar a ninguna parte.
    //
    // Sin apodo (lo de la ciudad) no hay perfil al que ir: la línea empieza
    // por la frase, que ya acaba en dos puntos. Antes esto pintaba un enlace
    // vacío a /perfil/?n= y daba una página de perfil inexistente.
    const apodo = (item.apodo || '').trim();
    if (apodo) {
      const quien = el('a', 'crono-apodo', apodo);
      quien.href = '/perfil/?n=' + encodeURIComponent(apodo);
      p.appendChild(quien);
      p.appendChild(document.createTextNode(' ' + frase(item) + ' '));
    } else {
      p.appendChild(document.createTextNode(frase(item) + ' '));
    }
    const ico = icono(item);
    if (ico) p.appendChild(ico);

    const url = destino(item);
    if (url) {
      const a = el('a', 'crono-sitio', item.sitio);
      a.href = url;
      p.appendChild(a);
    } else {
      p.appendChild(el('span', 'crono-sitio', item.sitio));
    }
    return p;
  }

  const API = 'https://kdqiwhvtovafugpcrumf.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_sBgKboeZMNaMLZWDekEW6A_1kG8JH8l';

  // --- Novedades desde la última visita -------------------------------------
  //
  // Local y por dispositivo, igual que en la app: no es una tabla ni se
  // sincroniza. Solo sirve para el contador de «Qué pasa»; la cronología se
  // ve entera siempre.
  const CLAVE_VISTO = 'sevi-crono-visto';

  function leerVisto() {
    try { return localStorage.getItem(CLAVE_VISTO); } catch (_) { return null; }
  }

  function marcarVisto(cuando) {
    const t = new Date(cuando).getTime();
    if (isNaN(t)) return;
    try {
      const previo = new Date(localStorage.getItem(CLAVE_VISTO) || '').getTime();
      if (!isNaN(previo) && !(t > previo)) return;
      localStorage.setItem(CLAVE_VISTO, new Date(t).toISOString());
    } catch (_) { /* almacenamiento lleno o bloqueado: sin contador */ }
  }

  // Dos horas por entrada (6-nov-2026, igual que la app): `cuando` es cuándo
  // lo hizo la persona —lo que se enseña y lo que ordena la lista— y
  // `publicado`, cuándo se aprobó. Lo nuevo se decide por `publicado`: algo
  // aprobado hoy pero hecho hace dos días cae dos días más abajo, y sin esto
  // nadie se enteraría de que acaba de salir. Sin `publicado` (servidor
  // antiguo) vale `cuando`.
  function publicado(f) {
    return new Date(f.publicado || f.cuando).getTime();
  }

  // Lo último publicado de la lista, que con la lista por hora real no tiene
  // por qué ser lo primero.
  function ultimaPublicacion(filas) {
    if (!Array.isArray(filas)) return null;
    let max = NaN;
    filas.forEach(function (f) {
      const t = publicado(f);
      if (!isNaN(t) && (isNaN(max) || t > max)) max = t;
    });
    return isNaN(max) ? null : new Date(max).toISOString();
  }

  function esNueva(f, visto) {
    const desde = new Date(visto || '').getTime();
    const t = publicado(f);
    return !isNaN(desde) && !isNaN(t) && t > desde;
  }

  // La primera vez se siembra con lo último publicado, para no enseñar
  // como nuevas las que ya estaban antes de que nadie abriera la página.
  function inicializarVisto(filas) {
    if (leerVisto()) return;
    const ultima = ultimaPublicacion(filas);
    if (ultima) marcarVisto(ultima);
  }

  function nuevas(filas) {
    const visto = leerVisto();
    if (!visto || !Array.isArray(filas)) return 0;
    return filas.reduce(function (total, f) {
      return esNueva(f, visto) ? total + 1 : total;
    }, 0);
  }

  function pedir(limite, desde) {
    return fetch(API + 'rpc/fn_cronologia', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      // `p_ampliada` trae además las correcciones, las rutas, los eventos
      // propuestos y los comentarios. La función no los manda por defecto
      // para no romper las versiones de la app que no los conocen; la web se
      // actualiza con el repositorio, así que aquí siempre se piden.
      body: JSON.stringify({
        p_limite: limite,
        p_ampliada: true,
        // Desplazamiento, para poder llegar al final de la lista: pidiendo
        // solo 40 quedaban 52 entradas sin forma de verse.
        p_desde: desde || 0,
      }),
    })
      // Un fallo se propaga, no se disfraza de lista vacía: con `[]` la
      // página decía «Todavía no hay nada que contar» sin red, y su mensaje
      // de error no salía nunca. Lo mismo que la app (`ultimasOFallo`).
      .then(function (r) {
        if (!r.ok) throw new Error('fn_cronologia ' + r.status);
        return r.json();
      });
  }

  window.SeviCrono = {
    el: el,
    avatar: avatar,
    haceCuanto: haceCuanto,
    estrellas: estrellas,
    linea: linea,
    frase: frase,
    cita: cita,
    detalle: detalle,
    esDeLaCiudad: esDeLaCiudad,
    icono: icono,
    pedir: pedir,
    leerVisto: leerVisto,
    marcarVisto: marcarVisto,
    inicializarVisto: inicializarVisto,
    ultimaPublicacion: ultimaPublicacion,
    esNueva: esNueva,
    nuevas: nuevas,
  };
}());
