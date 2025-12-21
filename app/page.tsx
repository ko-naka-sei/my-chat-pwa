"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, getDocs, where, documentId } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Loader2, Camera, Calendar } from "lucide-react";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<"photos" | "timetables">("photos");
  const [posts, setPosts] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // データ取得
  useEffect(() => {
    setLoading(true);

    // 1. 写真（投稿）の取得
    const qPosts = query(collection(db, "posts"), orderBy("updatedAt", "desc"));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      // 写真モードならここでローディング完了
      if (viewMode === "photos") setLoading(false);
    });

    // 2. 時間割の取得（全件取得して表示）
    // ※本来はフォロー中のみに絞るべきですが、まずは全件表示で動かします
    const qTimetables = query(collection(db, "timetables"), orderBy("updatedAt", "desc"));
    const unsubTimetables = onSnapshot(qTimetables, (snapshot) => {
      setTimetables(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      // 予定モードならここでローディング完了
      if (viewMode === "timetables") setLoading(false);
    });

    return () => {
      unsubPosts();
      unsubTimetables();
    };
  }, [viewMode]);

  // 時間割表示用のヘルパー関数
  const renderTimetable = (data: any) => {
    const days = [
      { key: "mon", label: "月" },
      { key: "tue", label: "火" },
      { key: "wed", label: "水" },
      { key: "thu", label: "木" },
      { key: "fri", label: "金" },
      { key: "sat", label: "土", weekend: true },
      { key: "sun", label: "日", weekend: true },
    ];
    
    // 予定が1つでもあるかチェック
    const hasAny = days.some(d => data[d.key]);
    if (!hasAny) return <p className="text-sm text-gray-400 text-center py-2">予定なし</p>;

    return (
      <div className="space-y-2 mt-2">
        {days.map((day) => {
          const text = data[day.key];
          if (!text) return null; // 予定がない曜日は表示しない
          return (
            <div key={day.key} className="flex items-center text-sm">
              <span className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0
                ${day.weekend ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}
              `}>
                {day.label}
              </span>
              <span className="truncate flex-1">{text}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight">My Chat PWA</h1>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5 text-gray-500" />
          </Button>
        </div>

        {/* ★タブ切り替えボタン */}
        <div className="flex p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setViewMode("photos")}
            className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-bold transition-all ${
              viewMode === "photos" ? "bg-white shadow text-black" : "text-gray-500"
            }`}
          >
            <Camera className="w-4 h-4 mr-2" />
            写真
          </button>
          <button
            onClick={() => setViewMode("timetables")}
            className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-bold transition-all ${
              viewMode === "timetables" ? "bg-white shadow text-black" : "text-gray-500"
            }`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            予定
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto max-w-md p-4 space-y-4">
        {viewMode === "photos" ? (
          // === 写真モード ===
          posts.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>まだ投稿がありません。</p>
            </div>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50 px-4 py-3 border-b">
                  <div className="flex justify-between items-center">
                     <CardTitle className="text-base font-bold">{post.username}</CardTitle>
                     <span className="text-xs text-gray-400">Real.</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {post.photoUrl && (
                    <img src={post.photoUrl} alt="Post" className="w-full object-cover max-h-[500px]" />
                  )}
                  <div className="p-4">
                    <p className="text-gray-800">{post.message}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )
        ) : (
          // === 予定モード ===
          timetables.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>まだ誰も予定を登録していません。</p>
            </div>
          ) : (
            timetables.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50 px-4 py-3 border-b">
                   <CardTitle className="text-base font-bold">{item.username} の予定</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {renderTimetable(item)}
                </CardContent>
              </Card>
            ))
          )
        )}
      </main>

      {/* 投稿ボタン（写真モードの時だけ表示） */}
      {viewMode === "photos" && (
        <div className="fixed bottom-20 right-6">
          <Button
            className="h-14 w-14 rounded-full shadow-lg bg-black hover:bg-gray-800 transition-all active:scale-95"
            onClick={() => router.push("/post")}
          >
            <Plus className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}
      
      {/* 予定編集ボタン（予定モードの時だけ表示） */}
      {viewMode === "timetables" && (
        <div className="fixed bottom-20 right-6">
          <Button
            className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 transition-all active:scale-95"
            onClick={() => router.push("/timetable/edit")}
          >
            <Calendar className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}
    </div>
  );
}