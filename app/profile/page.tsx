//  app/profile/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Camera, Loader2, Save } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 初回読み込み：現在のアイコンを取得
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
        }
      }
    };
    fetchProfile();
  }, [user]);

  // 画像選択＆圧縮処理（投稿機能と同じロジック）
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // アイコンなので小さめでOK（200px）
        const size = 200;
        canvas.width = size;
        canvas.height = size; // 正方形にする

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // 画像を中央にトリミングして描画（object-cover的な処理）
          const minScale = Math.max(size / img.width, size / img.height);
          const w = img.width * minScale;
          const h = img.height * minScale;
          const x = (size - w) / 2;
          const y = (size - h) / 2;
          
          ctx.drawImage(img, x, y, w, h);
          
          // 低画質JPEGで保存
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setAvatarUrl(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 保存処理
  const handleSave = async () => {
    if (!user || !avatarUrl) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        avatarUrl: avatarUrl
      });
      alert("プロフィール画像を更新しました！");
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-xl font-bold mb-6">設定・プロフィール</h1>

      <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center space-y-6">
        
        {/* アバター画像エリア */}
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <Avatar className="h-28 w-28 border-4 border-white shadow-lg">
            <AvatarImage src={avatarUrl || ""} />
            <AvatarFallback className="text-4xl bg-gray-200">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          
          {/* カメラアイコンオーバーレイ */}
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="text-white h-8 w-8" />
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>

        <div className="text-center w-full">
          <p className="font-bold text-lg mb-4">{user?.email}</p>
          
          <Button onClick={handleSave} disabled={loading} className="w-full mb-4">
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            画像を保存する
          </Button>

          <Button variant="destructive" className="w-full" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center text-sm text-gray-400">
        <p>バージョン 1.1.0</p>
        <p>My Chat PWA</p>
      </div>
    </div>
  );
}