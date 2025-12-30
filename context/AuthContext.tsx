"use client";

import { auth, db, messaging } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { getToken } from "firebase/messaging"; // ★追加
import { doc, updateDoc } from "firebase/firestore"; // ★追加
import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // ★通知設定とトークン取得の関数
  const setupNotifications = async (currentUser: User) => {
    // ブラウザが通知をサポートしていない、またはmessagingが初期化されていない場合は終了
    if (typeof window === "undefined" || !messaging) return;

    try {
      // 1. 通知の許可を求める
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        // 2. FCMトークンを取得
        // ※ vapidKeyにはFirebaseコンソールで取得した「鍵ペア」の文字列を入れてください
        const token = await getToken(messaging, {
          vapidKey: "BHo14FNBcE55-NJe5YIHoqBa4dAVHbAn5XzrL_VSK7itWchZy4C88Yc33CzGo6IXg3ltiAOt02-PvlaZqd_c0Zs",
        });

        if (token) {
          console.log("FCMトークンを取得しました:", token);
          // 3. Firestoreのユーザー情報を更新（トークンを保存）
          await updateDoc(doc(db, "users", currentUser.uid), {
            fcmToken: token,
          });
        } else {
          console.log("トークンが取得できませんでした。");
        }
      }
    } catch (error) {
      console.error("通知のセットアップ中にエラーが発生しました:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // ログイン中の場合
        setupNotifications(currentUser); // ★通知のセットアップを実行

        if (pathname === "/login") {
          router.push("/");
        }
      } else {
        // ログアウト中の場合
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);