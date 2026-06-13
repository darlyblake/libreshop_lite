self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Error parsing push data', e);
  }

  const title = data.title || 'LibreShop';
  const options = {
    body: data.body || 'Vous avez une nouvelle notification',
    icon: '/favicon.ico', // Assurez-vous d'avoir une icône ou un logo dans le dossier public
    badge: '/favicon.ico', // Petite icône pour la barre de statut Android
    data: data.data || {}, // Les données supplémentaires pour le clic
    vibrate: [200, 100, 200, 100, 200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Par défaut on ouvre l'url de base
  let url = self.location.origin;
  
  // Si on a des données de navigation (targetRole ou context), on pourrait adapter l'URL
  if (event.notification.data) {
    const payloadData = event.notification.data;
    if (payloadData.orderId) {
      if (payloadData.targetRole === 'seller') {
        url = url + '/seller/orders/' + payloadData.orderId; // Exemple d'URL profonde si elle existe
      } else {
        url = url + '/client/orders/' + payloadData.orderId;
      }
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Cherche une fenêtre déjà ouverte
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon on en ouvre une nouvelle
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
