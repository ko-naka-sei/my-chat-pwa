// app/chat/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton"; // ★追加

export default function ChatListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const profiles: Record<string, any> = {};
      snapshot.docs.forEach(doc => { profiles[doc.id] = doc.data(); });
      setUserProfiles(profiles);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setThreads(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // ★スケルトン表示
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32 mb-6" />
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      <h1 className="text-xl font-bold mb-6">チャット一覧</h1>
      <div className="space-y-3">
        {threads.map((thread) => {
          const otherUserId = thread.participants?.find((id: string) => id !== user?.uid);
          const otherUser = userProfiles[otherUserId] || {};
          return (
            <Card key={thread.id} className="cursor-pointer hover:bg-gray-100" onClick={() => router.push(`/chat/${thread.id}`)}>
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={otherUser.avatarUrl} />
                  <AvatarFallback>{(otherUser.username || "?")[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h2 className="font-bold truncate">{otherUser.username || "読み込み中..."}</h2>
                    <span className="text-[10px] text-gray-400">
                      {thread.updatedAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{thread.lastMessage}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}