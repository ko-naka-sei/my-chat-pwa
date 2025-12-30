import { NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const { token, title, body, chatId } = await request.json();

    const message = {
      // notification を使わず data のみにすることで、勝手な自動表示を止めます
      data: {
        title: title,
        body: body,
        url: `/chat/${chatId}`, 
      },
      token: token,
    };

    const response = await admin.messaging().send(message);
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    console.error("FCM送信エラー:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}