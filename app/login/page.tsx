"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore"; // serverTimestampを推奨
import { auth, db, messaging } from "@/lib/firebase"; // messagingをインポート
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getToken } from "firebase/messaging"; // トークン取得用

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // === デバイスの通知トークンを取得して保存する関数 ===
  const saveFcmToken = async (uid: string) => {
    try {
      if (!messaging) return;
      const token = await getToken(messaging, {
        vapidKey: "BHo14FNBcE55-NJe5YIHoqBa4dAVHbAn5XzrL_VSK7itWchZy4C88Yc33CzGo6IXg3ltiAOt02-PvlaZqd_c0Zs"
      });
      if (token) {
        await updateDoc(doc(db, "users", uid), { fcmToken: token });
      }
    } catch (err) {
      console.error("トークン取得失敗:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLoginMode) {
        // === ログイン ===
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await saveFcmToken(userCredential.user.uid); // ログイン時もトークンを更新
      } else {
        // === 新規登録 ===
        if (!username) throw new Error("ユーザー名を入力してください");
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestoreにユーザー情報を初期保存
        // new Date() よりも serverTimestamp() を使うのがエンジニアの標準です
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          username: username,
          email: email,
          createdAt: serverTimestamp(), 
          fcmToken: "", // 最初は空で作成
          friends: [],
        });

        // 登録直後に通知トークンを取得して保存
        await saveFcmToken(user.uid);
      }
      // 成功したらトップページへ
      router.push("/");
    } catch (e: any) {
      console.error(e);
      // エラーメッセージを日本語で分かりやすく
      let message = e.message;
      if (e.code === "auth/email-already-in-use") message = "このメールアドレスは既に使われています";
      if (e.code === "auth/weak-password") message = "パスワードが短すぎます（6文字以上必要です）";
      alert("エラー: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center font-bold">
            {isLoginMode ? "おかえりなさい！" : "チャットを始めよう！"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLoginMode ? "ログインして友達と話そう" : "アカウントを作成して通知を受け取ろう"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="username">ユーザー名</Label>
                <Input
                  id="username"
                  placeholder="例: たろう"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "通信中..." : (isLoginMode ? "ログイン" : "新規登録して開始")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              {isLoginMode
                ? "アカウントを持っていない方はこちら（新規登録）"
                : "すでにアカウントをお持ちの方はこちら（ログイン）"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}