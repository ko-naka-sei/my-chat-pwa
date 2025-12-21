"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";

export default function ChatListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ★追加：最新のユーザー情報を保持する辞書
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  // 1. 全ユーザーの最新プロフィールを取得（ホーム画面と同じ仕組み）
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const profiles: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        profiles[doc.id] = doc.data();
      });
      setUserProfiles(profiles);
    });
    return () => unsub();
  }, []);

  // 2. 自分が参加しているチャットを取得
  useEffect(() => {
    if (!user) return;

    // "participants" 配列に自分のIDが含まれているチャットを探す
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threadList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setThreads(threadList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      <h1 className="text-xl font-bold mb-6">チャット一覧</h1>

      {threads.length === 0 ? (
        <div className="text-center mt-20 text-gray-400">
          <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>まだメッセージのやり取りはありません</p>
          <p className="text-sm mt-2">友達リストから話しかけてみよう！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            // 相手のIDを特定（自分じゃない方のID）
            const otherUserId = thread.participants.find((id: string) => id !== user?.uid);
            
            // ★修正：辞書から最新の相手情報を取得
            const otherUser = userProfiles[otherUserId] || {}; 
            const friendName = otherUser.username || "不明なユーザー";
            const friendAvatar = otherUser.avatarUrl; // 最新のアバター画像

            return (
              <Card 
                key={thread.id} 
                className="cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => router.push(`/chat/${thread.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* ★アバター表示部分 */}
                  <Avatar>
                    <AvatarImage src={friendAvatar} />
                    <AvatarFallback>{friendName[0]}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h2 className="font-bold truncate">{friendName}</h2>
                      <span className="text-xs text-gray-400">
                        {thread.updatedAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {thread.lastMessage || "画像が送信されました"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}