importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {

  apiKey: "AIzaSyAIixoZPImlu3MtL7zHm_9rkssceHYzqUw",

  authDomain: "class-share-app.firebaseapp.com",

  projectId: "class-share-app",

  storageBucket: "class-share-app.firebasestorage.app",

  messagingSenderId: "1363142310",

  appId: "1:1363142310:web:466c3c0434cb10907ef667",

  measurementId: "G-LQGMYZY21D"

};

const messaging = firebase.messaging();

// バックグラウンド通知の表示を自分でコントロール
messaging.onBackgroundMessage((payload) => {
  // data ペイロードから情報を取得
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/icon-192x192.png',
    data: {
      url: payload.data.url
    },
    // これを付けることで、同じタグの通知が複数重ならないようにします
    tag: 'chat-notification' 
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 通知クリック時の挙動
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
});