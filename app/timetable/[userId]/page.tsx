//  app/timetable/[userId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ViewTimetablePage() {
  const { userId } = useParams();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "ユーザー"; // URLから名前も受け取る
  const router = useRouter();
  
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const days = [
    { key: "mon", label: "月" },
    { key: "tue", label: "火" },
    { key: "wed", label: "水" },
    { key: "thu", label: "木" },
    { key: "fri", label: "金" },
    { key: "sat", label: "土", isWeekend: true },
    { key: "sun", label: "日", isWeekend: true },
  ];

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!userId) return;
      try {
        const docSnap = await getDoc(doc(db, "timetables", userId as string));
        if (docSnap.exists()) {
          setSchedule(docSnap.data());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTimetable();
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">{name} の予定</h1>
      </div>

      {loading ? (
        <p className="text-center mt-10">読み込み中...</p>
      ) : !schedule ? (
        <div className="text-center mt-20 text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>まだ予定が登録されていません</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-base text-gray-500">週間スケジュール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y">
            {days.map((day) => {
              const text = schedule[day.key];
              if (!text) return null; // 予定がない日は表示しない（または「なし」と表示）

              return (
                <div key={day.key} className="flex py-4">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold mr-4 shrink-0
                    ${day.isWeekend ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-700"}
                  `}>
                    {day.label}
                  </div>
                  <div className="flex-1 flex items-center">
                    <p className="text-gray-800 leading-relaxed">{text}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}