"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, setDoc, doc, updateDoc, arrayUnion, onSnapshot, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, Check, Calendar} from "lucide-react";
import { useRouter } from "next/navigation";

export default function FriendsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [myUsername, setMyUsername] = useState("");

  // 自分の名前を取得
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setMyUsername(snap.data().username);
    });
  }, [user]);

  // 自分宛てのリクエストをリアルタイム監視
  useEffect(() => {
    if (!user) return;
    const q = collection(db, "users", user.uid, "friendRequests");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // ユーザー検索
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    
    // ※Firestoreは全文検索が苦手なので、今回は「完全一致」か「前方一致（工夫が必要）」になりますが
    // 簡易的に全件取得してフィルタリングするか、正確な名前検索にします。
    // ここではExpo版と同じく「クライアントサイドフィルタリング」で実装します（ユーザー数が少ない想定）
    const q = collection(db, "users");
    const snapshot = await getDocs(q);
    
    const found: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // 自分以外 かつ 名前が部分一致
      if (doc.id !== user?.uid && data.username?.includes(searchText)) {
        found.push({ id: doc.id, ...data });
      }
    });
    setSearchResults(found);
  };

  // リクエスト送信
  const sendRequest = async (targetId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", targetId, "friendRequests", user.uid), {
        username: myUsername,
        uid: user.uid,
        createdAt: new Date()
      });
      alert("リクエストを送りました！");
    } catch (e) {
      alert("エラー: 送信できませんでした");
    }
  };

  // リクエスト承認
  const approveRequest = async (requesterId: string, requesterName: string) => {
    if (!user) return;
    try {
      // 1. お互いの friends サブコレクションに追加
      await setDoc(doc(db, "users", user.uid, "friends", requesterId), {
        username: requesterName,
        connectedAt: new Date()
      });
      await setDoc(doc(db, "users", requesterId, "friends", user.uid), {
        username: myUsername,
        connectedAt: new Date()
      });

      // 2. お互いの following 配列に追加 (これで投稿が見れるようになる！)
      await updateDoc(doc(db, "users", user.uid), {
        following: arrayUnion(requesterId)
      });
      await updateDoc(doc(db, "users", requesterId), {
        following: arrayUnion(user.uid)
      });

      // 3. リクエストを削除
      await deleteDoc(doc(db, "users", user.uid, "friendRequests", requesterId));
      
      alert(`${requesterName}さんと友達になりました！`);
    } catch (e) {
      console.error(e);
      alert("承認エラー");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      <h1 className="text-xl font-bold mb-4">友達を探す</h1>

      {/* 検索エリア */}
      <div className="flex gap-2 mb-6">
        <Input 
          placeholder="ユーザー名で検索..." 
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Button onClick={handleSearch} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* リクエスト受信リスト */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 mb-2">届いているリクエスト</h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{req.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{req.username}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveRequest(req.id, req.username)}>
                      <Check className="h-4 w-4 mr-1" /> 承認
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 検索結果リスト */}
      <div className="space-y-2">
        {searchResults.map((person) => (
          <Card key={person.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{person.username?.[0]}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{person.username}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => sendRequest(person.id)}>
                <UserPlus className="h-4 w-4 mr-1" /> 追加
              </Button>
            </CardContent>
          </Card>
        ))}
        {searchResults.length === 0 && searchText && (
          <p className="text-center text-gray-400 text-sm">ユーザーが見つかりません</p>
        )}
      </div>
    </div>
  );
}