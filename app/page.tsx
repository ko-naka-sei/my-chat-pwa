"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Camera, Calendar, Coffee, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 

// ★時限ごとの時間定義（あなたの大学に合わせて調整してください）
const PERIODS = [
  { id: 1, label: "1限", start: "09:00", end: "10:30" },
  { id: 2, label: "2限", start: "10:40", end: "12:10" },
  { id: 3, label: "昼休", start: "12:10", end: "13:00" }, // 昼休みも定義
  { id: 4, label: "3限", start: "13:00", end: "14:30" },
  { id: 5, label: "4限", start: "14:40", end: "16:10" },
  { id: 6, label: "5限", start: "16:20", end: "17:50" },
];

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<"photos" | "timetables">("photos");
  const [loading, setLoading] = useState(true);

  // データ保持用
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allTimetables, setAllTimetables] = useState<any[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  
  // ★追加: 最新のユーザー情報（アイコン用）を保持する辞書
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  // ★追加: 「今、暇な人」リスト
  const [freeFriends, setFreeFriends] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // 1. ユーザー情報（全件）を監視して、アイコン辞書を作る
  // これで「画像を変えたら過去の投稿も変わる」ようになります
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

  // 2. 友達リスト取得
  useEffect(() => {
    if (!user) return;
    const qFriends = collection(db, "users", user.uid, "friends");
    const unsubFriends = onSnapshot(qFriends, (snapshot) => {
      const ids = snapshot.docs.map((doc) => doc.id);
      setFriendIds([user.uid, ...ids]); // 自分も含める
    });
    return () => unsubFriends();
  }, [user]);

  // 3. 投稿・時間割データの取得
  useEffect(() => {
    setLoading(true);
    const qPosts = query(collection(db, "posts"), orderBy("updatedAt", "desc"));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      setAllPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      if (viewMode === "photos") setLoading(false);
    });

    const qTimetables = query(collection(db, "timetables"), orderBy("updatedAt", "desc"));
    const unsubTimetables = onSnapshot(qTimetables, (snapshot) => {
      setAllTimetables(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      if (viewMode === "timetables") setLoading(false);
    });

    return () => {
      unsubPosts();
      unsubTimetables();
    };
  }, [viewMode]);

  // ★追加: 「今、暇な人」を計算するロジック
  useEffect(() => {
    if (allTimetables.length === 0 || friendIds.length === 0) return;

    const now = new Date();
    const dayIndex = now.getDay(); // 0=日, 1=月...
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDayKey = days[dayIndex];

    // 現在時刻を "HH:MM" 形式に
    const currentHmm = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    // 今が何限か判定
    let periodKey: string | null = null;
    let periodLabel = "時間外";

    // 休日判定
    if (dayIndex === 0 || dayIndex === 6) {
      periodLabel = "休日";
      // 休日は全員暇とする
      periodKey = "Holiday"; 
    } else {
      // 平日の場合、PERIODSと比較
      for (const p of PERIODS) {
        if (currentHmm >= p.start && currentHmm <= p.end) {
          periodLabel = p.label;
          // 昼休み(3)は特別扱い、それ以外は timetables のキーに対応させる
          // ※今回は簡易的に、昼休みは全員暇とします
          if (p.id === 3) periodKey = "Lunch"; 
          else periodKey = "now"; // 授業中
          break;
        }
      }
    }

    setCurrentStatus(`${periodLabel} (${currentHmm})`);

    // 暇な人を抽出
    const freePeople = allTimetables.filter(tt => {
      // 1. 友達（または自分）である
      if (!friendIds.includes(tt.uid)) return false;

      // 2. 自分が計算対象なら除外（友達を探したいので）
      if (tt.uid === user?.uid) return false;

      // 休日や昼休みなら全員暇
      if (periodLabel === "休日" || periodLabel === "昼休") return true;

      // 時間外（夜や朝）なら全員暇
      if (periodLabel === "時間外") return true;

      // 授業時間の場合、その人の時間割を見る
      // 現在の曜日の、現在の時限に対応するデータが「空文字」なら暇
      // ※注意：ここは「何限か」を特定して判定する必要がありますが、
      // 簡易実装として「時間割データを見て、その曜日に文字が入っていなければ暇」という単純化は難しいので、
      // 今回は【現在時刻が授業時間帯に含まれていて】かつ【その曜日の入力欄にその時限の記述がない】判定をします。
      
      // しかし、今のDB構造は "mon": "1限: 数学, 3限: 英語" のような自由入力テキストです。
      // なので、正確に判定するのは難しいです。
      // ★代案アプローチ： 「その曜日のテキストに、今の時限（例: '2限'）という文字が含まれていなければ暇」と判定します。
      const daySchedule = tt[currentDayKey] || "";
      
      // 例えば今が2限なら、"2限" という文字が含まれていれば授業あり、なければ暇。
      // ※ユーザーが "2限空き" と書くと誤判定しますが、そこは運用でカバー
      const currentPeriodNum = PERIODS.find(p => p.label === periodLabel)?.id;
      if (!currentPeriodNum) return true; // 特定できなければ暇扱い
      
      // "1限", "１限" などの表記揺れ対策
      const hasClass = daySchedule.includes(`${currentPeriodNum}限`) || daySchedule.includes(`${currentPeriodNum}げん`);
      
      return !hasClass; // 授業という文字がなければ「暇」
    });

    setFreeFriends(freePeople);

  }, [allTimetables, friendIds, user]);


  // フィルタリング（友達のみ）
  const visiblePosts = allPosts.filter((post) => friendIds.includes(post.uid));
  const visibleTimetables = allTimetables.filter((tt) => friendIds.includes(tt.uid));

  // 時間割レンダリング関数
  const renderTimetable = (data: any) => {
    const days = [
      { key: "mon", label: "月" }, { key: "tue", label: "火" }, { key: "wed", label: "水" },
      { key: "thu", label: "木" }, { key: "fri", label: "金" },
      { key: "sat", label: "土", weekend: true }, { key: "sun", label: "日", weekend: true },
    ];
    const hasAny = days.some(d => data[d.key]);
    if (!hasAny) return <p className="text-sm text-gray-400 text-center py-2">予定なし</p>;
    return (
      <div className="space-y-2 mt-2">
        {days.map((day) => {
          const text = data[day.key];
          if (!text) return null;
          return (
            <div key={day.key} className="flex items-center text-sm">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 shrink-0 ${day.weekend ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>{day.label}</span>
              <span className="truncate flex-1">{text}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight">My Chat PWA</h1>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5 text-gray-500" />
          </Button>
        </div>

        {/* タブ切り替え */}
        <div className="flex p-1 bg-gray-100 rounded-lg">
          <button onClick={() => setViewMode("photos")} className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-bold transition-all ${viewMode === "photos" ? "bg-white shadow text-black" : "text-gray-500"}`}>
            <Camera className="w-4 h-4 mr-2" /> 写真
          </button>
          <button onClick={() => setViewMode("timetables")} className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-bold transition-all ${viewMode === "timetables" ? "bg-white shadow text-black" : "text-gray-500"}`}>
            <Calendar className="w-4 h-4 mr-2" /> 予定
          </button>
        </div>
      </header>

      <main className="container mx-auto max-w-md p-4 space-y-4">
        
        {/* ★新機能：暇人レーダー（写真モードの時だけ表示） */}
        {viewMode === "photos" && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="font-bold text-gray-700 flex items-center">
                <Coffee className="w-4 h-4 mr-2 text-orange-500" />
                Now Free <span className="text-xs font-normal text-gray-400 ml-2">{currentStatus}</span>
              </h2>
            </div>
            
            {freeFriends.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {freeFriends.map((f) => {
                  const profile = userProfiles[f.uid] || {};
                  return (
                    <div key={f.uid} className="flex flex-col items-center min-w-[60px]">
                      <div className="relative">
                        <Avatar className="h-14 w-14 border-2 border-orange-400 shadow-sm">
                          <AvatarImage src={profile.avatarUrl} />
                          <AvatarFallback>{f.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
                      </div>
                      <span className="text-xs mt-1 font-medium truncate w-14 text-center">
                        {f.username}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-4 text-center text-sm text-gray-400 shadow-sm">
                今はみんな授業中か、予定があるみたい... 📚
              </div>
            )}
          </div>
        )}


        {/* コンテンツ表示エリア */}
        {viewMode === "photos" ? (
          visiblePosts.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>表示できる投稿がありません。</p>
            </div>
          ) : (
            visiblePosts.map((post) => {
              // ★修正ポイント: post内の古いデータではなく、userProfilesから最新情報を取得
              const profile = userProfiles[post.uid] || {};
              const currentAvatar = profile.avatarUrl; // 最新のアバター
              // 名前も最新にするなら profile.username を使いますが、今回はアバターのみ修正

              return (
                <Card key={post.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center gap-3 bg-gray-50 px-4 py-3 border-b">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentAvatar} /> {/* ★ここが最新になる */}
                      <AvatarFallback>{post.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 justify-between items-center">
                       <CardTitle className="text-base font-bold">{post.username}</CardTitle>
                       <span className="text-xs text-gray-400">Real.</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {post.photoUrl && (
                      <img src={post.photoUrl} alt="Post" className="w-full object-cover max-h-[500px]" />
                    )}
                    <div className="p-4">
                      <p className="text-gray-800">{post.message}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )
        ) : (
          // 予定モード
          visibleTimetables.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>表示できる予定がありません。</p>
            </div>
          ) : (
            visibleTimetables.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50 px-4 py-3 border-b">
                   <CardTitle className="text-base font-bold">{item.username} の予定</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {renderTimetable(item)}
                </CardContent>
              </Card>
            ))
          )
        )}
      </main>

      {/* FABボタン */}
      {viewMode === "photos" && (
        <div className="fixed bottom-20 right-6">
          <Button className="h-14 w-14 rounded-full shadow-lg bg-black hover:bg-gray-800 transition-all active:scale-95" onClick={() => router.push("/post")}>
            <Plus className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}
      {viewMode === "timetables" && (
        <div className="fixed bottom-20 right-6">
          <Button className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 transition-all active:scale-95" onClick={() => router.push("/timetable/edit")}>
            <Calendar className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}
    </div>
  );
}