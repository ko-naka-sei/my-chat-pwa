"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-xl font-bold mb-6">設定・プロフィール</h1>

      <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center space-y-4">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-2xl">
            {/* ユーザー名が取れれば表示したいですが、一旦メールの頭文字か「?」で */}
            {user?.email?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        
        <div className="text-center">
          <p className="font-bold text-lg">{user?.email}</p>
          <p className="text-sm text-gray-500">ID: {user?.uid.slice(0, 8)}...</p>
        </div>

        <Button 
          variant="outline" 
          className="w-full mt-4" 
          onClick={() => router.push("/timetable/edit")}
        >
          <Calendar className="mr-2 h-4 w-4" />
          時間割・予定を編集する
        </Button>
        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-400">
        <p>バージョン 1.0.0</p>
        <p>My Chat PWA</p>
      </div>
    </div>
  );
}