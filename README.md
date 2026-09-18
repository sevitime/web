# sevitime.com

Landing pública de SeviTime: qué es la app y el enlace a Google Play.

Sitio estático servido por GitHub Pages en el dominio `sevitime.com` (el
`CNAME` de este repositorio es el que reclama ese dominio).

## Por qué vive aquí y no en `sevitime.github.io`

Poner un dominio personalizado en el repositorio de usuario
(`sevitime/sevitime.github.io`) hace que GitHub redirija **todo** lo que cuelga
de `sevitime.github.io`, incluido `/.well-known/assetlinks.json`. La
verificación de App Links de Android no sigue redirecciones, así que eso rompe
la apertura de los enlaces de perfil y de ruta dentro de la app. Por eso el
dominio se reclama desde este repositorio aparte.

## Contenido

- `index.html` y `estilo.css` — la página.
- `capturas/` — capturas de la ficha de Google Play, redimensionadas a 540 px.
- `social.jpg` — imagen de 1200×630 para cuando se comparte el enlace.
- La política de privacidad **no** está aquí: sigue en `sevitime/privacidad`.
