importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD7NMp66LLaZYi_5uqbrbU-SFCJRCRyTmY",
  authDomain: "emergency-app-f2850.firebaseapp.com",
  projectId: "emergency-app-f2850",
  storageBucket: "emergency-app-f2850.firebasestorage.app",
  messagingSenderId: "206775317622",
  appId: "1:206775317622:web:8b051ba2dfe92858ca1b57",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Campus Emergency Response", {
    body: notification.body || "An incident requires attention.",
    icon: "/favicon.ico",
    data: { url: "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});

