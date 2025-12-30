"use client";

import { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// 型定義
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  seen: boolean;
}

interface ChatData {
  participants: string[];
  typing?: { [key: string]: boolean };
  lastMessage?: string;
  updatedAt?: any;
}

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [friendName, setFriendName] = useState("...");
  const [friendAvatar, setFriendAvatar] = useState<string | null>(null);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [isSending, setIsSending] = useState(false); // ★二重送信防止フラグ

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 相手の情報 & 入力中状態のリアルタイム監視
  useEffect(() => {
    if (!user || !chatId) return;

    const fetchChatInfo = async () => {
      const chatDocRef = doc(db, "chats", chatId as string);
      const chatDoc = await getDoc(chatDocRef);
      
      if (chatDoc.exists()) {
        const data = chatDoc.data() as ChatData;
        const otherUserId = data.participants?.find((id) => id !== user.uid);
        
        if (otherUserId) {
          // 相手のプロフィールを監視
          onSnapshot(doc(db, "users", otherUserId), (d) => {
            setFriendName(d.data()?.username || "名無し");
            setFriendAvatar(d.data()?.avatarUrl || null);
          });

          // チャットルーム全体の更新（入力中ステータスなど）を監視
          onSnapshot(doc(db, "chats", chatId as string), (d) => {
            const chatInfo = d.data() as ChatData;
            const typingStatus = chatInfo?.typing || {};
            setIsFriendTyping(typingStatus[otherUserId] || false);
          });
        }
      }
    };
    fetchChatInfo();
  }, [chatId, user]);

  // 2. メッセージ一覧の取得 & 「既読」処理
  useEffect(() => {
    if (!chatId || !user) return;

    const q = query(
      collection(db, "chats", chatId as string, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];

      setMessages(msgs);
      
      // ★既読処理: 相手が送った未読メッセージを「既読」に更新
      msgs.forEach(async (msg) => {
        if (msg.senderId !== user.uid && !msg.seen) {
          const msgRef = doc(db, "chats", chatId as string, "messages", msg.id);
          await updateDoc(msgRef, { seen: true });
        }
      });
      
      // 自動スクロール
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [chatId, user]);

  // 3. 自分の「入力中」状態をFirestoreに送る関数
  const updateMyTypingStatus = async (status: boolean) => {
    if (!user || !chatId) return;
    await updateDoc(doc(db, "chats", chatId as string), {
      [`typing.${user.uid}`]: status
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    // 入力中をONにする
    updateMyTypingStatus(true);

    // 2秒間入力がなければOFFにする
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => updateMyTypingStatus(false), 2000);
  };

  // 4. 送信処理（メッセージ保存 + 通知API呼び出し）
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // ★ガード: 入力なし、ユーザーなし、または送信中なら何もしない
    if (!input.trim() || !user || isSending) return;

    setIsSending(true); // 送信ロック
    const textToSend = input;
    setInput("");
    updateMyTypingStatus(false); // 送信したので入力中を解除

    try {
      // (1) メッセージをサブコレクションに保存
      await addDoc(collection(db, "chats", chatId as string, "messages"), {
        text: textToSend,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        seen: false,
      });

      // (2) 部屋の最終メッセージ情報を更新
      await updateDoc(doc(db, "chats", chatId as string), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp(),
      });

      // (3) 通知を送る相手のトークンを取得してAPIを叩く
      const chatDoc = await getDoc(doc(db, "chats", chatId as string));
      const otherUserId = chatDoc.data()?.participants?.find((id: string) => id !== user.uid);
      
      if (otherUserId) {
        const userDoc = await getDoc(doc(db, "users", otherUserId));
        const targetToken = userDoc.data()?.fcmToken;

        if (targetToken) {
          // 自作の中継API (/api/notify) を呼ぶ
          await fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: targetToken,
              title: (user.displayName || "友達") + "さんからメッセージ",
              body: textToSend,
            }),
          });
        }
      }
    } catch (error) {
      console.error("送信エラー:", error);
    } finally {
      setIsSending(false); // 送信ロック解除
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* ヘッダー部分 */}
      <div className="bg-white px-4 py-3 border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src={friendAvatar || undefined} />
          <AvatarFallback>{friendName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-bold text-sm truncate">{friendName}</p>
          {isFriendTyping && <p className="text-[10px] text-blue-500 animate-pulse font-medium">入力中...</p>}
        </div>
      </div>

      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user?.uid;
          const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <div className="w-8 mr-2">
                  {showAvatar && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friendAvatar || undefined} />
                      <AvatarFallback>{friendName[0]}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
              <div className="flex flex-col items-end max-w-[75%]">
                <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  isMe ? "bg-blue-500 text-white rounded-br-none" : "bg-white border text-gray-800 rounded-bl-none"
                }`}>
                  {msg.text}
                </div>
                {/* 既読表示（自分の最新メッセージが既読になったら表示） */}
                {isMe && msg.seen && (
                  <span className="text-[10px] text-gray-400 mt-1 mr-1 font-medium">既読</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* 入力エリア */}
      <div className="bg-white p-3 border-t pb-safe">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-2xl mx-auto">
          <Input 
            value={input} 
            onChange={handleInputChange} 
            placeholder="メッセージを入力..." 
            className="flex-1 bg-gray-50 border-none focus-visible:ring-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}