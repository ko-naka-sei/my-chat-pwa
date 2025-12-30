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

// --- 1. 型定義 (TypeScriptのビルドエラーを防ぐ) ---
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  seen: boolean;
}

interface UserProfile {
  username?: string;
  avatarUrl?: string | null;
  fcmToken?: string;
}

// --- 2. 通知送信関数 (コンポーネントの外に定義して hoisting エラーを回避) ---
// ※ この方式は Google の旧 API を使用した簡易版です
async function sendPushNotification(token: string, title: string, body: string) {
  console.log("通知送信を試行中...", token);
  try {
    // 【注意】本来はサーバー側で行う処理です。セキュリティキーの扱いに注意してください。
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Firebaseコンソール > プロジェクト設定 > クラウドメッセージング の「サーバーキー」を貼り付け
        "Authorization": "key=YOUR_LEGACY_SERVER_KEY_HERE", 
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: title,
          body: body,
          sound: "default",
        },
        priority: "high",
      }),
    });
  } catch (error) {
    console.error("FCM送信エラー:", error);
  }
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- 3. 相手の情報 & 入力中状態の監視 ---
  useEffect(() => {
    if (!user || !chatId) return;

    const fetchChatInfo = async () => {
      const chatDocRef = doc(db, "chats", chatId as string);
      const chatDoc = await getDoc(chatDocRef);
      
      if (chatDoc.exists()) {
        const otherUserId = chatDoc.data().participants?.find((id: string) => id !== user.uid);
        if (otherUserId) {
          // 相手のプロフィール監視
          onSnapshot(doc(db, "users", otherUserId), (d) => {
            const data = d.data() as UserProfile;
            setFriendName(data?.username || "名無し");
            setFriendAvatar(data?.avatarUrl || null);
          });
          // チャットルーム内の入力状態監視
          onSnapshot(doc(db, "chats", chatId as string), (d) => {
            const typingData = d.data()?.typing || {};
            setIsFriendTyping(typingData[otherUserId] || false);
          });
        }
      }
    };
    fetchChatInfo();
  }, [chatId, user]);

  // --- 4. メッセージ取得 & 既読処理 ---
  useEffect(() => {
    if (!chatId || !user) return;

    const q = query(collection(db, "chats", chatId as string, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(msgs);
      
      // 既読更新
      msgs.forEach(async (msg) => {
        if (msg.senderId !== user.uid && !msg.seen) {
          await updateDoc(doc(db, "chats", chatId as string, "messages", msg.id), { seen: true });
        }
      });
      
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [chatId, user]);

  // --- 5. 送信・入力イベントハンドラ ---
  const setTypingStatus = async (status: boolean) => {
    if (!user || !chatId) return;
    await updateDoc(doc(db, "chats", chatId as string), {
      [`typing.${user.uid}`]: status
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingStatus(false), 2000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const textToSend = input;
    setInput("");
    setTypingStatus(false);

    try {
      // メッセージ追加
      await addDoc(collection(db, "chats", chatId as string, "messages"), {
        text: textToSend,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        seen: false,
      });

      // 最終メッセージ更新
      await updateDoc(doc(db, "chats", chatId as string), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp(),
      });

      // --- 通知送信ロジック ---
      const chatDoc = await getDoc(doc(db, "chats", chatId as string));
      const otherUserId = chatDoc.data()?.participants?.find((id: string) => id !== user.uid);
      
      if (otherUserId) {
        const userDoc = await getDoc(doc(db, "users", otherUserId));
        const targetToken = userDoc.data()?.fcmToken;
        if (targetToken) {
          // 相手に通知を飛ばす
          await sendPushNotification(targetToken, user.email?.split('@')[0] || "新着メッセージ", textToSend);
        }
      }
    } catch (error) {
      console.error("送信エラー", error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-white px-4 py-3 border-b flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={friendAvatar || undefined} />
          <AvatarFallback>{friendName[0]}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold text-sm truncate max-w-[150px]">{friendName}</p>
          {isFriendTyping && <p className="text-[10px] text-blue-500 animate-pulse">入力中...</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <Avatar className="h-8 w-8 mr-2 mt-1">
                  <AvatarImage src={friendAvatar || undefined} />
                  <AvatarFallback>{friendName[0]}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col items-end">
                <div className={`max-w-[250px] rounded-2xl px-4 py-2 text-sm ${isMe ? "bg-blue-500 text-white rounded-br-none" : "bg-white border rounded-bl-none shadow-sm text-gray-800"}`}>
                  {msg.text}
                </div>
                {isMe && msg.seen && <span className="text-[10px] text-gray-400 mt-1">既読</span>}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <div className="bg-white p-3 border-t pb-safe">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-md mx-auto">
          <Input value={input} onChange={handleInputChange} placeholder="メッセージ..." className="flex-1" />
          <Button type="submit" size="icon" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}