"use client";

import { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { friendId } = useParams(); // URLから相手のIDを取得 ([friendId]の部分)
  const searchParams = useSearchParams();
  const friendName = searchParams.get("name") || "チャット"; // URLの?name=...から名前取得
  
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null); // 自動スクロール用

  // 部屋IDを作る（自分と相手のIDをソートして結合＝常に同じ部屋になる）
  const roomId = [user?.uid, friendId].sort().join("_");

  // メッセージの監視
  useEffect(() => {
    if (!user || !friendId) return;

    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "asc") // 古い順に表示
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      // 新着が来たら下にスクロール
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [roomId, user, friendId]);

  // 送信処理
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const textToSend = input;
    setInput(""); // 先に入力を消す（サクサク感のため）

    try {
      // 1. 部屋情報の更新（最新メッセージ日時など）
      await setDoc(doc(db, "rooms", roomId), {
        members: [user.uid, friendId],
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 2. メッセージ追加
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        text: textToSend,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("送信エラー", error);
    }
  };

  return (
    <div className="flex flex-col h-[100vh] bg-gray-100 pb-safe">
      {/* ヘッダー */}
      <div className="bg-white px-4 py-3 border-b flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarFallback>{friendName[0]}</AvatarFallback>
        </Avatar>
        <span className="font-bold truncate">{friendName}</span>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  isMe
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-white text-gray-800 border rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} /> {/* スクロール用ダミー要素 */}
      </div>

      {/* 入力エリア */}
      <div className="bg-white p-3 border-t">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-md mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージ..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
       
    </div>
  );
}