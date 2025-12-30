// friends/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
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

  // ★追加: 最新のユーザー情報を保持する辞書（名前表示用）
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  // ★追加: 自分のユーザー名
  const [myUsername, setMyUsername] = useState("");

  // 1. 全ユーザーの最新プロフィールを取得して辞書を作る
  // これで「登録時の古い名前（メール）」ではなく「現在の正しい名前」が表示されます
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

  // 2. 自分の最新情報を取得（申請を送るとき用）
  useEffect(() => {
    if (!user) return;
    const fetchMe = async () => {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        setMyUsername(docSnap.data().username || "名無し");
      }
    };
    fetchMe();
  }, [user]);

  // 3. 友達リストの監視
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users", user.uid, "friends"), (snap) => {
      setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // 4. 友達申請の監視
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
  const sendRequest = async (targetId: string) => {
    if (!user) return;
    
    // ★修正: 自分の正しい名前(myUsername)を送るようにしました
    const nameToSend = myUsername || user.email;

    await addDoc(collection(db, "users", targetId, "friendRequests"), {
      fromUid: user.uid,
      fromName: nameToSend, 
      status: "pending",
      createdAt: serverTimestamp(),
    });
    alert("申請を送りました");
  };

  // 申請を承認
  const acceptRequest = async (req: any) => {
    if (!user) return;
    
    await updateDoc(doc(db, "users", user.uid, "friendRequests", req.id), { status: "accepted" });
    
    // 自分 -> 相手
    await setDoc(doc(db, "users", user.uid, "friends", req.fromUid), {
      createdAt: serverTimestamp() // 名前は保存せず、表示時に辞書から引くので最低限でOK
    }, { merge: true });

    // 相手 -> 自分
    await setDoc(doc(db, "users", req.fromUid, "friends", user.uid), {
      createdAt: serverTimestamp()
    }, { merge: true });
    
    alert("友達になりました！");
  };

  // ★チャットを開始する（エラー修正版）
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
        // ★修正: data.participants が無い場合にエラーになるのを防ぐ (?をつける)
        if (data.participants?.includes(friendId)) {
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
      alert("エラーが発生しました。コンソールを確認してください。");
    } finally {
      setLoadingChat(false);
    }
  };

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
                     <AvatarImage src={u.avatarUrl} />
                     <AvatarFallback>{u.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <span>{u.username || "名無し"}</span>
                </div>
                <Button size="sm" onClick={() => sendRequest(u.id)}>
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
          {friends.map((friend) => {
            // ★重要: 保存されたデータではなく、最新の辞書から情報を取る
            // これにより、今メールアドレスで保存されていても、正しい名前に変換して表示します！
            const profile = userProfiles[friend.id] || {};
            const displayName = profile.username || "読み込み中...";
            const avatarUrl = profile.avatarUrl;

            return (
              <Card key={friend.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback>{displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{displayName}</span>
                  </div>
                  
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
            );
          })}
          {friends.length === 0 && (
            <p className="text-gray-400 text-sm">友達がいません。<br/>まずはユーザー検索から申請を送ってみましょう！</p>
          )}
        </div>
      </div>
    </div>
  );
}