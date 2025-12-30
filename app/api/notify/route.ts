import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token, title, body } = await request.json();

    // ★重要: Firebaseコンソール > プロジェクト設定 > クラウドメッセージング
    // 「Cloud Messaging API (従来の方式)」を有効にして表示される「サーバーキー」をここに貼る
    const SERVER_KEY = "BHo14FNBcE55-NJe5YIHoqBa4dAVHbAn5XzrL_VSK7itWchZy4C88Yc33CzGo6IXg3ltiAOt02-PvlaZqd_c0Zs";

    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
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
          icon: "/icon-192x192.png", // 先ほど作成したアイコン
          click_action: "https://my-chat-pwa-ashy.vercel.app/", // 自分のアプリURL
        },
        priority: "high",
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Internal API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}