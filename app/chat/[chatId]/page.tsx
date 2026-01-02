"use client";

import { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, getDoc, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Image as ImageIcon, Lock } from "lucide-react";

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false); // ★アンロック状態
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. 今日の自分の投稿があるかチェック（アンロック判定）
  useEffect(() => {
    if (!user || !chatId) return;

    // 今日の0時0分のタイムスタンプを作成
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = Timestamp.fromDate(today);

    // 自分が今日投稿した画像メッセージを探すクエリ
    const q = query(
      collection(db, "chats", chatId as string, "messages"),
      where("senderId", "==", user.uid),
      where("imageUrl", "!=", null), // 画像がある
      where("createdAt", ">=", todayStart) // 今日以降
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsUnlocked(!snapshot.empty); // 1つでもあればアンロック！
    });

    return () => unsubscribe();
  }, [chatId, user]);

  // 2. メッセージ一覧取得
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId as string, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
  }, [chatId]);

  // 3. 送信処理（テキストも画像も同じ関数で対応）
  const sendMessage = async (imageUrl: string | null = null) => {
    if (!user || (!input.trim() && !imageUrl) || isSending) return;
    setIsSending(true);

    try {
      await addDoc(collection(db, "chats", chatId as string, "messages"), {
        text: input,
        imageUrl: imageUrl, // 画像URL（あれば）
        senderId: user.uid,
        createdAt: serverTimestamp(),
        seen: false,
      });
      setInput("");
      // 通知などの処理は以前と同様
    } finally {
      setIsSending(false);
    }
  };

  // ダミーの画像投稿（本来は Firebase Storage を使いますが、まずはURLでテスト）
  const postTestImage = () => {
    const testImageUrl = "https://picsum.photos/400/300"; // テスト用のランダム画像
    sendMessage(testImageUrl);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white p-3 border-b flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <div className="text-xs font-bold text-gray-500">
          {isUnlocked ? "✅ 今日のアンロック完了" : "🔒 投稿すると相手の画像が見れます"}
        </div>
        <div className="w-10"></div>
      </div>

      {/* メッセージ表示 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          const hasImage = !!msg.imageUrl;

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                
                {/* 画像メッセージの場合 */}
                {hasImage && (
                  <div className="relative overflow-hidden rounded-2xl mb-1 shadow-md">
                    <img 
                      src={msg.imageUrl} 
                      alt="shared" 
                      className={`w-full max-w-[250px] transition-all duration-700 ${!isMe && !isUnlocked ? "blur-2xl scale-110" : ""}`} 
                    />
                    {/* ロック中のオーバーレイ表示 */}
                    {!isMe && !isUnlocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-white p-4 text-center">
                        <Lock className="mb-2" />
                        <p className="text-[10px] font-bold">画像を投稿してアンロック</p>
                      </div>
                    )}
                  </div>
                )}

                {/* テキストメッセージの場合 */}
                {msg.text && (
                  <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-blue-500 text-white rounded-br-none" : "bg-white border rounded-bl-none"}`}>
                    {msg.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* 入力エリア */}
      <div className="p-3 bg-white border-t">
        <div className="flex gap-2 max-w-2xl mx-auto items-center">
          <Button type="button" variant="outline" size="icon" onClick={postTestImage} className="rounded-full">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="メッセージ..." 
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <Button onClick={() => sendMessage()} disabled={isSending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}