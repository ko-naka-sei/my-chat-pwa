//  app/timetable/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EditTimetablePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 型定義付きでStateを初期化（これでエラーを防ぎます）
  const [schedule, setSchedule] = useState<Record<string, string>>({
    mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: ""
  });

  const days = [
    { key: "mon", label: "月曜日" },
    { key: "tue", label: "火曜日" },
    { key: "wed", label: "水曜日" },
    { key: "thu", label: "木曜日" },
    { key: "fri", label: "金曜日" },
    { key: "sat", label: "土曜日", color: "text-blue-500" },
    { key: "sun", label: "日曜日", color: "text-red-500" },
  ];

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const docSnap = await getDoc(doc(db, "timetables", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          // データが存在する場合はセット
          setSchedule(prev => ({
            ...prev,
            mon: data.mon || "",
            tue: data.tue || "",
            wed: data.wed || "",
            thu: data.thu || "",
            fri: data.fri || "",
            sat: data.sat || "",
            sun: data.sun || "",
          }));
        }
      } catch (e) {
        console.error("読み込みエラー:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // 保存処理
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // ユーザー名も取得して保存（表示用）
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.exists() ? userDoc.data().username : "名無し";

      await setDoc(doc(db, "timetables", user.uid), {
        uid: user.uid,
        username: username,
        ...schedule, // スケジュールデータを展開して保存
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert("保存しました！");
      router.back();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      {/* ヘッダーエリア */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-gray-50 z-10 py-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold">予定を編集</h1>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {days.map((day) => (
            <div key={day.key}>
              <label className={`block text-sm font-bold mb-2 ${day.color || "text-gray-700"}`}>
                {day.label}
              </label>
              <Input
                value={schedule[day.key]}
                onChange={(e) => {
                  // ここで確実に入力を反映させる
                  const val = e.target.value;
                  setSchedule((prev) => ({ ...prev, [day.key]: val }));
                }}
                placeholder="例: 3限空き、18時からバイト"
                className="bg-white"
              />
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* 下の余白（キーボードで隠れないように） */}
      <div className="h-40" />
    </div>
  );
}