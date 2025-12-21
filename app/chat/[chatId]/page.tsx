//  app/chat/[chatId]/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ChatRoomPage() {
  const { user } = useAuth();   // ログイン中のユーザー情報
  const { chatId } = useParams(); // URLパラメータからチャットIDを取得
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  
  // ★追加: 相手の情報（名前・画像）
  const [friendName, setFriendName] = useState("...");
  const [friendAvatar, setFriendAvatar] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. 相手の情報を取得（最新の画像を表示するため）
  useEffect(() => {
    if (!user || !chatId) return;

    // チャット参加者のうち、自分以外のユーザーIDを取得
    const fetchFriendInfo = async () => {
      const chatDocRef = doc(db, "chats", chatId as string);
      const chatDoc = await getDoc(chatDocRef); 
      
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        // participants配列から「自分じゃない方」を探す
        const otherUserId = data.participants?.find((id: string) => id !== user.uid);

        
        if (otherUserId) {
          // 相手のユーザー情報をリアルタイム監視
          const unsubUser = onSnapshot(doc(db, "users", otherUserId), (doc) => {
            if (doc.exists()) {
              const userData = doc.data();
              setFriendName(userData.username || "名無し");  // 最新の名前をセット
              setFriendAvatar(userData.avatarUrl || null);  // 最新の画像URLをセット
            }
          });
          return () => unsubUser();
        }
      }
    };
    fetchFriendInfo();
  }, [chatId, user]);

  // 2. メッセージのリアルタイム取得
  useEffect(() => {
    if (!chatId) return;

    // クエリ作成: chatIdに紐づくメッセージを取得、作成日時順に並べる
    const q = query(
      collection(db, "chats", chatId as string, "messages"),
      orderBy("createdAt", "asc")
    );
    // リアルタイム監視
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);// メッセージ取得後にスクロール
    });

    return () => unsubscribe();
  }, [chatId]);

  // メッセージ送信処理
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const textToSend = input;// 送信前に変数に保存
    setInput("");// 送信後に入力欄をクリア

    try {
      // 1. メッセージ追加
      await addDoc(collection(db, "chats", chatId as string, "messages"), {
        text: textToSend,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });

      // 2. 部屋情報の更新（一覧画面での表示用）
      await updateDoc(doc(db, "chats", chatId as string), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp(),
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
        {/* ★修正: 最新の画像を表示 */}
        <Avatar className="h-8 w-8">
          <AvatarImage src={friendAvatar || undefined} />
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
              {/* 相手のメッセージならアイコンを表示 */}
              {!isMe && (
                <Avatar className="h-8 w-8 mr-2 mt-1">
                  <AvatarImage src={friendAvatar || undefined} />
                  <AvatarFallback>{friendName[0]}</AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  isMe
                    ? "bg-blue-500 text-white rounded-br-none" // 自分のメッセージ
                    : "bg-white text-gray-800 border rounded-bl-none" // 相手のメッセージ
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
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