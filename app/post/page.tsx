"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Camera, ArrowLeft } from "lucide-react";

export default function PostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Real."); // デフォルトメッセージ
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 画像を選択して圧縮する処理
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像読み込みと圧縮
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // 幅を600pxにリサイズ（Expo版と同じ）
        const scale = 600 / img.width;
        canvas.width = 600;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        // JPEG, 品質0.5でBase64化
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.5);
        setImage(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!user || !image) return;
    setLoading(true);

    try {
      // ユーザー名を取得
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.exists() ? userDoc.data().username : "名無し";

      // Firestoreに保存
      // Expo版と同じくドキュメントIDをuidにして「1人1投稿」の仕様なら doc(db, 'posts', user.uid)
      // 履歴を残すなら addDoc ですが、Expo版に合わせて上書き仕様にします
      await setDoc(doc(db, "posts", user.uid), {
        uid: user.uid,
        username: username,
        photoUrl: image,
        message: message,
        updatedAt: serverTimestamp(),
      });

      alert("投稿しました！");
      router.push("/"); // ホームに戻る
    } catch (e: any) {
      alert("エラー: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <CardTitle>投稿する</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* プレビューエリア */}
          <div 
            className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-gray-200 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {image ? (
              <img src={image} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-gray-500">
                <Camera className="mb-2 h-12 w-12" />
                <span>写真を撮る / 選択</span>
              </div>
            )}
            
            {/* 隠しファイル入力 */}
            <input
              type="file"
              accept="image/*"
              capture="environment" // スマホでカメラを直接起動する属性
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {/* メッセージ入力 */}
          <Input 
            value={message} 
            onChange={(e) => setMessage(e.target.value)} 
            placeholder="ひとこと..."
          />

          {/* アクションボタン */}
          <div className="flex gap-4">
            {image && (
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => {
                  setImage(null);
                  if(fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                撮り直す
              </Button>
            )}
            <Button 
              className="flex-1" 
              disabled={!image || loading} 
              onClick={handleUpload}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              投稿する 🚀
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}