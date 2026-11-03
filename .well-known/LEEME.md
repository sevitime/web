# `assetlinks.json`

Lo que permite que un enlace de `sevitime.com` **abra la app** en vez del
navegador, en un móvil que la tenga instalada (App Links de Android).

Es **el mismo fichero** que sirve `sevitime.github.io`, porque es la misma
app: las tres huellas son la del certificado de depuración, la del subido a
Play y la que Google usa al firmar (Play App Signing). Si alguna vez cambian,
se copian de Play Console → Integridad de la app → Certificado de la clave de
firma.

**No basta con esto.** Android solo verifica los dominios que la app
reclama en su `AndroidManifest.xml` con `autoVerify="true"`. Este fichero es
la otra mitad del apretón de manos: sin él, la app pide el dominio y Android
se lo niega.

Hasta el 3-nov-2026 solo existía en `sevitime.github.io`, así que los enlaces
de sitios que comparte la app —`sevitime.com/lugar/?k=…`— abrían el
navegador aunque tuvieras la app puesta.
