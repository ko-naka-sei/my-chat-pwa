"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Loader2, Camera, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<"photos" | "timetables">("photos");
  const [loading, setLoading] = useState(true);

  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allTimetables, setAllTimetables] = useState<any[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // 1. 友達リスト取得（自分含む）
  useEffect(() => {
    if (!user) return;
    const qFriends = collection(db, "users", user.uid, "friends");
    const unsubFriends = onSnapshot(qFriends, (snapshot) => {
      const ids = snapshot.docs.map((doc) => doc.id);
      setFriendIds([user.uid, ...ids]);
    });
    return () => unsubFriends();
  }, [user]);

  // 2. データ取得
  useEffect(() => {
    setLoading(true);
    const qPosts = query(collection(db, "posts"), orderBy("updatedAt", "desc"));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      setAllPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      if (viewMode === "photos") setLoading(false);
    });

    const qTimetables = query(collection(db, "timetables"), orderBy("updatedAt", "desc"));
    const unsubTimetables = onSnapshot(qTimetables, (snapshot) => {
      setAllTimetables(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      if (viewMode === "timetables") setLoading(false);
    });

    return () => {
      unsubPosts();
      unsubTimetables();
    };
  }, [viewMode]);

  // 3. フィルタリング
  const visiblePosts = allPosts.filter((post) => friendIds.includes(post.uid));
  const visibleTimetables = allTimetables.filter((tt) => friendIds.includes(tt.uid));

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
    
    const hasAny = days.some(d => data[d.key]);
    if (!hasAny) return <p className="text-sm text-gray-400 text-center py-2">予定なし</p>;

    return (
      <div className="space-y-2 mt-2">
        {days.map((day) => {
          const text = data[day.key];
          if (!text) return null;
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

      <main className="container mx-auto max-w-md p-4 space-y-4">
        {viewMode === "photos" ? (
          visiblePosts.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>表示できる投稿がありません。</p>
              <p className="text-xs mt-2">友達を追加するか、自分で投稿してみよう！</p>
            </div>
          ) : (
            visiblePosts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-3 bg-gray-50 px-4 py-3 border-b">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.userAvatar} />
                    <AvatarFallback>{post.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 justify-between items-center">
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
          visibleTimetables.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>表示できる予定がありません。</p>
            </div>
          ) : (
            visibleTimetables.map((item) => (
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