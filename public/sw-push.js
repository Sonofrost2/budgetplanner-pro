// Push notification handler for service worker
self.addEventListener('push', (event) => {
  let data = { title: 'Budget Planner', body: 'Nouvelle notification', icon: '/icons/icon-192.png' };

  try {
    if (event.data) {
      const text = event.data.text();
      try {
        data = { ...data, ...JSON.parse(text) };
      } catch {
        data.body = text;
      }
    }
  } catch (e) {
    console.error('Push parse error:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    tag: data.tag || 'budget-planner-' + Date.now(),
    renotify: true,
    requireInteraction: true,  // Keep visible on desktop until user interacts
    actions: [
      { action: 'open', title: '📊 Ouvrir', icon: '/icons/icon-192.png' },
      { action: 'dismiss', title: '✕ Fermer' },
    ],
    // Desktop-specific improvements
    timestamp: data.timestamp || Date.now(),
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Determine target URL from notification data
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          // Navigate to specific page if needed
          if (targetUrl !== '/dashboard') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(targetUrl);
    })
  );
});

// Handle notification close (for analytics)
self.addEventListener('notificationclose', (event) => {
  // Could send analytics here
  console.log('Notification closed:', event.notification.tag);
});
