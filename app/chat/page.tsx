"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";

export default function ChatListPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    // 自分の「友達リスト」を監視
    const q = collection(db, "users", user.uid, "friends");
    // ※本当は最終メッセージ順などでソートしたいですが、まずは単純なリストで
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedFriends = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFriends(loadedFriends);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-screen bg-white pb-24 p-4">
      <h1 className="text-xl font-bold mb-6">チャット</h1>

      <div className="space-y-2">
        {friends.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">
            まだ友達がいません。<br />
            下の「友達」メニューから探してみよう！
          </p>
        ) : (
          friends.map((friend) => (
            <Card
              key={friend.id}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => router.push(`/chat/${friend.id}?name=${friend.username}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-bold">{friend.username}</p>
                  <p className="text-xs text-gray-400">タップしてメッセージを送る</p>
                </div>
                <MessageCircle className="text-gray-300 h-5 w-5" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}