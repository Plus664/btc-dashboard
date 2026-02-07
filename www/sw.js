// --- Push通知 ---
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon.png',
      data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

// --- PWA用ライフサイクル ---
self.addEventListener("install", event => {
  console.log("Service Worker installed");
  event.waitUntil(self.skipWaiting()); // 古いSWを飛ばす
});

self.addEventListener("activate", event => {
  console.log("Service Worker activated");
  event.waitUntil(self.clients.claim()); // 新SWを即適用
});
