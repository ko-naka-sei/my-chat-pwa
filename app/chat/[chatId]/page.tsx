// app/chat/[chatId]/page.tsx
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

export default function ChatRoomPage() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [friendName, setFriendName] = useState("...");
  const [friendAvatar, setFriendAvatar] = useState<string | null>(null);
  const [isFriendTyping, setIsFriendTyping] = useState(false); // ★入力中状態

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 相手の情報 & 入力中状態の監視
  useEffect(() => {
    if (!user || !chatId) return;
    const fetchChatInfo = async () => {
      const chatDocRef = doc(db, "chats", chatId as string);
      const chatDoc = await getDoc(chatDocRef);
      if (chatDoc.exists()) {
        const otherUserId = chatDoc.data().participants?.find((id: string) => id !== user.uid);
        if (otherUserId) {
          onSnapshot(doc(db, "users", otherUserId), (d) => {
            setFriendName(d.data()?.username || "名無し");
            setFriendAvatar(d.data()?.avatarUrl || null);
          });
          // ★チャットルーム内の相手の入力状態を監視
          const unsubChat = onSnapshot(doc(db, "chats", chatId as string), (d) => {
            const typingData = d.data()?.typing || {};
            setIsFriendTyping(typingData[otherUserId] || false);
          });
          return () => unsubChat();
        }
      }
    };
    fetchChatInfo();
  }, [chatId, user]);

  // 2. メッセージ取得 & 既読処理
  useEffect(() => {
    if (!chatId || !user) return;
    const q = query(collection(db, "chats", chatId as string, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      
      // ★既読処理: 相手からの未読メッセージを既読にする
      msgs.forEach(async (msg) => {
        if (msg.senderId !== user.uid && !msg.seen) {
          await updateDoc(doc(db, "chats", chatId as string, "messages", msg.id), { seen: true });
        }
      });
      
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [chatId, user]);

  // ★入力中状態を送信する関数
  const setTypingStatus = async (status: boolean) => {
    if (!user || !chatId) return;
    await updateDoc(doc(db, "chats", chatId as string), {
      [`typing.${user.uid}`]: status
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setTypingStatus(true); // 入力開始

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false); // 2秒間止まったら停止
    }, 2000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const textToSend = input;
    setInput("");
    setTypingStatus(false); // 送信したら入力中をオフ

    await addDoc(collection(db, "chats", chatId as string, "messages"), {
      text: textToSend,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      seen: false, // ★初期値は未読
    });
    await updateDoc(doc(db, "chats", chatId as string), {
      lastMessage: textToSend,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-white px-4 py-3 border-b flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={friendAvatar || undefined} />
          <AvatarFallback>{friendName[0]}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold text-sm">{friendName}</p>
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
                <div className={`max-w-[250px] rounded-2xl px-4 py-2 text-sm ${isMe ? "bg-blue-500 text-white rounded-br-none" : "bg-white border rounded-bl-none"}`}>
                  {msg.text}
                </div>
                {/* ★既読表示 */}
                {isMe && msg.seen && <span className="text-[10px] text-gray-400 mt-1">既読</span>}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <div className="bg-white p-3 border-t">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-md mx-auto">
          <Input value={input} onChange={handleInputChange} placeholder="メッセージ..." className="flex-1" />
          <Button type="submit" size="icon" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}