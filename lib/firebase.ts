// src/lib/firebase.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getStorage } from "firebase/storage"; // 画像保存用（必要なら）
import { getMessaging, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAIixoZPImlu3MtL7zHm_9rkssceHYzqUw",
  authDomain: "class-share-app.firebaseapp.com",
  projectId: "class-share-app",
  storageBucket: "class-share-app.firebasestorage.app",
  messagingSenderId: "1363142310",
  appId: "1:1363142310:web:466c3c0434cb10907ef667",
  measurementId: "G-LQGMYZY21D"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

// ブラウザ環境（windowが存在する）の時だけ初期化
let messaging: Messaging | undefined;
if (typeof window !== "undefined") {
  messaging = getMessaging(app);
}

export { db, auth, messaging };