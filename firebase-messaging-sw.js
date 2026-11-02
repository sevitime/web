/* Service worker de los avisos push en la web.
 *
 * Va aparte de `sw.js` porque Firebase Cloud Messaging busca este fichero por
 * su nombre y en la raíz: es el que recibe el aviso cuando la web está cerrada
 * o en segundo plano. `sw.js` sigue encargándose de abrir sin conexión.
 *
 * Los dos scripts de Firebase se cargan de gstatic.com, y solo aquí y en
 * `avisos.js`: quien no enciende los avisos no descarga nada de esto.
 *
 * La configuración se lee de `/avisos-config.json`, el mismo fichero que usa
 * `avisos.js`. Sin `apiKey` y sin `appId` no se registra nada y este worker se
 * queda quieto, que es lo que pasa mientras no se cree la app web en la
 * consola de Firebase.
 */
/* global importScripts, firebase */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

self.addEventListener('notificationclick', function (evento) {
  evento.notification.close();
  // A dónde lleva el aviso. Lo manda el servidor en `data.destino` —el mismo
  // campo que la app usa para abrir la pantalla que toca— y si no viene, a
  // la portada de Explorar.
  var datos = evento.notification.data || {};
  var destino = datos.destino || (datos.FCM_MSG && datos.FCM_MSG.data && datos.FCM_MSG.data.destino) || '/explorar/';
  if (destino.indexOf('http') !== 0 && destino.indexOf('/') !== 0) destino = '/' + destino;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ventanas) {
      // Si ya hay una ventana de SeviTime abierta, se reutiliza: abrir una
      // segunda pestaña de la misma web es lo que hace que parezca que el
      // aviso «no ha hecho nada».
      for (var i = 0; i < ventanas.length; i++) {
        if (ventanas[i].url.indexOf(self.location.origin) === 0 && 'focus' in ventanas[i]) {
          ventanas[i].navigate(destino);
          return ventanas[i].focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});

fetch('/avisos-config.json')
  .then(function (r) { return r.json(); })
  .then(function (cfg) {
    if (!cfg.apiKey || !cfg.appId) return;
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    // Con esto, un aviso que trae `notification` lo pinta el navegador solo.
    firebase.messaging();
  })
  .catch(function () { /* sin configuración no hay avisos, y no es un error */ });
