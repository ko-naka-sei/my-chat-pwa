import { NextResponse } from "next/server";
import admin from "firebase-admin";

// サーバー起動時に一度だけ初期化
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const { token, title, body } = await request.json();

    const message = {
      notification: { title, body },
      token: token, // 送信先トークン
    };

    // 新しい v1 API を使って送信
    const response = await admin.messaging().send(message);
    
    console.log("通知送信成功:", response);
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    console.error("FCM送信エラー:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}