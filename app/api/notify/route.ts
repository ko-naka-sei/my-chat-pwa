// app/api/notify/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token, title, body } = await request.json();
    
    // ★ここをもう一度確認！「サーバーキー」を正しく貼ってください
    const SERVER_KEY = "BHo14FNBcE55-NJe5YIHoqBa4dAVHbAn5XzrL_VSK7itWchZy4C88Yc33CzGo6IXg3ltiAOt02-PvlaZqd_c0Zs"; 

    const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key=${SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: title,
          body: body,
          sound: "default",
        },
      }),
    });

    // ここでJSONとして解析する前に、中身が何かをチェックする
    const contentType = fcmResponse.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      const result = await fcmResponse.json();
      console.log("FCM送信成功:", result);
      return NextResponse.json(result);
    } else {
      // HTML（エラーページ）が返ってきた場合
      const errorText = await fcmResponse.text();
      console.error("FCMからHTMLエラーが返りました:", errorText);
      return NextResponse.json({ error: "Google API Error", details: errorText }, { status: fcmResponse.status });
    }

  } catch (error: any) {
    console.error("API内部エラー:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}