//  app/streetpass/page.tsx
"use client";

import { useState } from "react";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Radar, MapPin, Loader2 } from "lucide-react";

// 2点間の距離（メートル）を計算する関数（三平方の定理の地球版）
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // 地球の半径 (m)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function StreetPassPage() {
  const { user } = useAuth();
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = () => {
    if (!user) return;
    setLoading(true);
    setScanned(false);
    setNearbyUsers([]);

    // 1. ブラウザの現在地を取得
    if (!navigator.geolocation) {
      alert("お使いのブラウザは位置情報に対応していません");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // 2. 自分の位置をFirebaseに保存
          await updateDoc(doc(db, "users", user.uid), {
            location: {
              latitude,
              longitude,
              updatedAt: serverTimestamp(),
            },
          });

          // 3. 全ユーザーの位置情報を取得して距離を計算
          // ※ユーザー数が多い場合はGeoFireなどを使いますが、今回は簡易的に全件取得で計算します
          const snapshot = await getDocs(collection(db, "users"));
          const found: any[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            // 自分自身は除外
            if (doc.id === user.uid) return;
            // 位置情報がない人は除外
            if (!data.location) return;

            const dist = getDistance(
              latitude,
              longitude,
              data.location.latitude,
              data.location.longitude
            );

            // ★半径 2000m (2km) 以内なら「近くにいる」と判定
            if (dist < 2000) {
              found.push({
                id: doc.id,
                username: data.username,
                distance: Math.round(dist), // 小数点を四捨五入
              });
            }
          });

          // 近い順に並び替え
          found.sort((a, b) => a.distance - b.distance);
          setNearbyUsers(found);
        } catch (e: any) {
          console.error(e);
          alert("エラーが発生しました: " + e.message);
        } finally {
          setLoading(false);
          setScanned(true);
        }
      },
      (error) => {
        setLoading(false);
        alert("位置情報の取得に失敗しました。\n端末の設定で位置情報を許可してください。");
        console.error(error);
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 p-4">
      <h1 className="text-xl font-bold mb-2 text-center">すれ違い通信</h1>
      <p className="text-sm text-gray-500 text-center mb-8">
        ボタンを押して、近くにいる友達を探そう
      </p>

      {/* レーダー風アニメーション（スキャン中のみ回転） */}
      <div className="flex justify-center mb-8">
        <div className={`
          bg-blue-100 p-8 rounded-full border-4 border-blue-500
          ${loading ? "animate-spin" : ""}
        `}>
          <Radar className="h-16 w-16 text-blue-600" />
        </div>
      </div>

      {/* スキャンボタン */}
      <div className="flex justify-center mb-10">
        <Button 
          size="lg" 
          className="rounded-full px-8 h-12 text-lg shadow-lg" 
          onClick={handleScan}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 探しています...
            </>
          ) : (
            "スキャン開始"
          )}
        </Button>
      </div>

      {/* 結果表示 */}
      <div className="space-y-3">
        {scanned && nearbyUsers.length === 0 && (
          <p className="text-center text-gray-400">
            近く（2km以内）に友達は見つかりませんでした。<br />
            ※相手も位置情報を登録している必要があります。
          </p>
        )}

        {nearbyUsers.map((person) => (
          <Card key={person.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>{person.username?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">{person.username}</p>
                  <p className="text-xs text-gray-500 flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    ここから {person.distance}m
                  </p>
                </div>
              </div>
              <div className="text-blue-500 font-bold text-sm">発見!</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}