//  app/login/page.tsx
"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); // フォーム送信によるリロードを防ぐ
    setLoading(true);

    try {
      if (isLoginMode) {
        // === ログイン ===
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // === 新規登録 ===
        if (!username) throw new Error("ユーザー名を入力してください");
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestoreにユーザー情報保存
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          username: username,
          email: email,
          createdAt: new Date(),
          following: [],
          friends: [],
        });
      }
      // 成功したら AuthContext が自動検知してトップページへ飛ばしてくれます
    } catch (e: any) {
      alert("エラー: " + e.message); // とりあえずシンプルにalert
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isLoginMode ? "おかえりなさい！" : "はじめまして！"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLoginMode ? "ログインして友達の投稿を見よう" : "アカウントを作成して始めよう"}
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
              {loading ? "処理中..." : (isLoginMode ? "ログイン" : "新規登録")}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-sm text-blue-600 hover:underline"
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