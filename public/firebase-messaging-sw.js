// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAIixoZPImlu3MtL7zHm_9rkssceHYzqUw",
  authDomain: "class-share-app.firebaseapp.com",
  projectId: "class-share-app",
  storageBucket: "class-share-app.firebasestorage.app",
  messagingSenderId: "1363142310",
  appId: "1:1363142310:web:466c3c0434cb10907ef667",
  measurementId: "G-LQGMYZY21D"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// バックグラウンド通知のハンドリング
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 通知を受信しました ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png' // あなたのアイコンパス
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});