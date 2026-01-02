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
      // dataのみにすることで、ブラウザの勝手な2重表示を防ぎます
      data: {
        title,
        body,
        url: `/chat/${chatId}`,
      },
      token: token,
    };

    const response = await admin.messaging().send(message);
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}