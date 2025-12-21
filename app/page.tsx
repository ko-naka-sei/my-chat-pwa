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

// ★時限ごとの時間定義
const PERIODS = [
  { id: 1, label: "1限", start: "09:10", end: "10:40" },
  { id: 2, label: "2限", start: "10:50", end: "12:20" },
  { id: 3, label: "昼休", start: "12:20", end: "13:10" }, 
  { id: 4, label: "3限", start: "13:10", end: "14:40" },
  { id: 5, label: "4限", start: "14:50", end: "16:20" },
  { id: 6, label: "5限", start: "16:30", end: "18:00" },
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
  
  // 最新のユーザー情報（アイコン用）
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  // 「今、暇な人」リスト
  const [freeFriends, setFreeFriends] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // 1. ユーザー情報（全件）を監視して、アイコン辞書を作る
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
      setFriendIds([user.uid, ...ids]); 
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

  // ★変更点：「今、暇な人」を計算するロジック（時間指定対応版）
  useEffect(() => {
    if (allTimetables.length === 0 || friendIds.length === 0) return;

    const now = new Date();
    const dayIndex = now.getDay(); // 0=日, 1=月...
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDayKey = days[dayIndex];
    const currentHour = now.getHours(); // 現在の「時」（例: 17）

    // 現在時刻を "HH:MM" 形式に
    const currentHmm = currentHour.toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    // 今が何限か判定
    let periodLabel = "時間外";

    if (dayIndex === 0 || dayIndex === 6) {
      periodLabel = "休日";
    } else {
      for (const p of PERIODS) {
        if (currentHmm >= p.start && currentHmm <= p.end) {
          periodLabel = p.label;
          break;
        }
      }
    }

    setCurrentStatus(`${periodLabel} (${currentHmm})`);

    // ★ヘルパー関数：テキスト内の時間指定（17-20など）を解析して、今が忙しいか判定
    const isBusyNowByTime = (text: string, currentH: number) => {
      // 正規表現：数字 + (区切り文字) + 数字 を探す
      // 例: "17-20", "17:00〜20:00", "9時~12時" などに対応
      const timeRangeRegex = /([0-9]{1,2})(?:[:時][0-9]{2})?\s*[〜~-]\s*([0-9]{1,2})(?:[:時][0-9]{2})?/g;
      
      let match;
      let hasTimeRange = false;

      // テキスト内のすべての時間範囲をチェック
      while ((match = timeRangeRegex.exec(text)) !== null) {
        hasTimeRange = true;
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);

        if (start >= 0 && start <= 24 && end >= 0 && end <= 24) {
          // 指定範囲内なら「忙しい」
          if (currentH >= start && currentH < end) {
            return { isBusy: true, hasRange: true };
          }
        }
      }
      // 時間指定は見つかったけど、今の時間は範囲外だった場合 -> 暇
      if (hasTimeRange) return { isBusy: false, hasRange: true };

      // 時間指定自体が書いてなかった場合
      return { isBusy: false, hasRange: false };
    };

    // 暇な人を抽出
    const freePeople = allTimetables.filter(tt => {
      // 1. 友達（または自分）である
      if (!friendIds.includes(tt.uid)) return false;

      // 2. 自分が計算対象なら除外
      if (tt.uid === user?.uid) return false;

      // 今日の予定テキストを取得
      const daySchedule = tt[currentDayKey] || "";

      // NGワード（時間指定がない場合の保険）
      const busyKeywords = ["バイト", "仕事", "用事", "部活", "サークル"];
      const hasBusyKeyword = busyKeywords.some(w => daySchedule.includes(w));

      // ★時間指定チェック！
      const timeCheck = isBusyNowByTime(daySchedule, currentHour);

      // パターンA：時間指定が見つかった場合（例：「17-20 バイト」）
      if (timeCheck.hasRange) {
        // 時間内なら「忙しい」、時間外なら「暇」
        if (timeCheck.isBusy) return false; 
        return true; 
      }

      // パターンB：時間指定はないけど、NGワードがある場合（例：「バイト」とだけある）
      if (hasBusyKeyword) {
        // 何時かわからないので、念のため非表示
        return false; 
      }

      // パターンC：授業時間の判定（平日で、かつ時間外・昼休み以外）
      if (periodLabel !== "休日" && periodLabel !== "時間外" && periodLabel !== "昼休") {
        const currentPeriodNum = PERIODS.find(p => p.label === periodLabel)?.id;
        if (currentPeriodNum) {
           // "2限" などの文字が含まれていたら授業中
           const hasClass = daySchedule.includes(`${currentPeriodNum}限`) || daySchedule.includes(`${currentPeriodNum}げん`);
           if (hasClass) return false;
        }
      }

      // ここまで引っかからなければ「暇」！
      return true;
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
        
        {/* 暇人レーダー（写真モードの時だけ表示） */}
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
              const profile = userProfiles[post.uid] || {};
              const currentAvatar = profile.avatarUrl; 

              return (
                <Card key={post.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center gap-3 bg-gray-50 px-4 py-3 border-b">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentAvatar} />
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