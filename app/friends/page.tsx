"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Check, MessageCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FriendsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // 1. 友達リストの監視
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users", user.uid, "friends"), (snap) => {
      setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // 2. 友達申請の監視
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "friendRequests"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // ユーザー検索
  const handleSearch = async () => {
    if (!keyword.trim()) return;
    const q = query(collection(db, "users")); 
    const snapshot = await getDocs(q);
    const found = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((u: any) => u.username?.includes(keyword) && u.id !== user?.uid);
    setSearchResults(found);
  };

  // 申請を送る
  const sendRequest = async (targetId: string, targetName: string) => {
    if (!user) return;
    await addDoc(collection(db, "users", targetId, "friendRequests"), {
      fromUid: user.uid,
      fromName: user.email, // usernameがあればそちら推奨
      status: "pending",
      createdAt: serverTimestamp(),
    });
    alert("申請を送りました");
  };

  // 申請を承認
  const acceptRequest = async (req: any) => {
    if (!user) return;
    // 申請ステータス更新
    await updateDoc(doc(db, "users", user.uid, "friendRequests", req.id), { status: "accepted" });
    
    // 自分 -> 相手 を友達登録
    await setDoc(doc(db, "users", user.uid, "friends", req.fromUid), {
      username: req.fromName,
      createdAt: serverTimestamp()
    }, { merge: true });

    // 相手 -> 自分 を友達登録
    // (※本来は相手側の処理ですが、簡易的にここで両方やっちゃいます)
    // 注意: 本番環境ではセキュリティルールで弾かれる可能性がありますが、開発中はこれでOK
    await setDoc(doc(db, "users", req.fromUid, "friends", user.uid), {
      username: user.email,
      createdAt: serverTimestamp()
    }, { merge: true });
    
    alert("友達になりました！");
  };

  // ★チャットを開始する機能
  const handleStartChat = async (friendId: string) => {
    if (!user || loadingChat) return;
    setLoadingChat(true);

    try {
      // 1. すでにチャットルームが存在するか探す
      const q = query(
        collection(db, "chats"), 
        where("participants", "array-contains", user.uid)
      );
      const snapshot = await getDocs(q);
      
      let existingChatId = null;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.participants.includes(friendId)) {
          existingChatId = doc.id;
        }
      });

      if (existingChatId) {
        // 2. あればその部屋に移動
        router.push(`/chat/${existingChatId}`);
      } else {
        // 3. なければ新しく作る
        const newChatRef = await addDoc(collection(db, "chats"), {
          participants: [user.uid, friendId],
          updatedAt: serverTimestamp(),
          lastMessage: "チャットが開始されました",
        });
        router.push(`/chat/${newChatRef.id}`);
      }

    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setLoadingChat(false);
    }
  };

  // setDocを使うためのインポート追加忘れ防止
  const { setDoc } = require("firebase/firestore");

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      <h1 className="text-xl font-bold mb-4">友達</h1>

      {/* 検索エリア */}
      <div className="flex gap-2 mb-6">
        <Input 
          placeholder="ユーザー名で検索..." 
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button onClick={handleSearch} size="icon"><Search className="h-4 w-4" /></Button>
      </div>

      {/* 検索結果 */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 mb-2">検索結果</h2>
          {searchResults.map((u) => (
            <Card key={u.id} className="mb-2">
              <CardContent className="p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                     <AvatarFallback>{u.username?.[0]}</AvatarFallback>
                     <AvatarImage src={u.avatarUrl} />
                  </Avatar>
                  <span>{u.username || "名無し"}</span>
                </div>
                <Button size="sm" onClick={() => sendRequest(u.id, u.username)}>
                  <UserPlus className="h-4 w-4 mr-1" /> 申請
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 申請リスト */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-red-500 mb-2">届いているリクエスト</h2>
          {requests.map((req) => (
            <Card key={req.id} className="mb-2 border-red-200 bg-red-50">
              <CardContent className="p-3 flex justify-between items-center">
                <span>{req.fromName}</span>
                <Button size="sm" onClick={() => acceptRequest(req)}>
                  <Check className="h-4 w-4 mr-1" /> 承認
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 友達リスト */}
      <div>
        <h2 className="text-lg font-bold mb-4">友達リスト ({friends.length})</h2>
        <div className="space-y-2">
          {friends.map((friend) => (
            <Card key={friend.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                    <AvatarImage src={friend.avatarUrl} />
                  </Avatar>
                  <span className="font-medium">{friend.username}</span>
                </div>
                
                {/* チャット開始ボタン */}
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => handleStartChat(friend.id)}
                  disabled={loadingChat}
                >
                  {loadingChat ? <Loader2 className="animate-spin h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
          {friends.length === 0 && (
            <p className="text-gray-400 text-sm">友達がいません。<br/>まずはユーザー検索から申請を送ってみましょう！</p>
          )}
        </div>
      </div>
    </div>
  );
}