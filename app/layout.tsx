import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext"; // ★追加
import { BottomNav } from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My Chat PWA",
  description: "Next.jsで作った最新PWA",
  manifest: "/manifest.json", // ★後でPWA化する時に使います
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {/* ★AuthProviderで囲むことで、全ページでログイン情報を共有 */}
        <AuthProvider>
          {children}
          <BottomNav /> 
        </AuthProvider>
      </body>
    </html>
  );
}