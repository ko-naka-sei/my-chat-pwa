"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MessageCircle, User, Radar} from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  // ★修正：チャット詳細画面（/chat/xxxx）でもメニューを隠すように条件を追加
  if (
    pathname === "/login" || 
    pathname === "/post" || 
    pathname.startsWith("/chat/") // これを追加！
  ) {
    return null;
  }

  const menuItems = [
    { name: "ホーム", href: "/", icon: Home },
    { name: "すれ違い", href: "/streetpass", icon: Radar },
    { name: "友達", href: "/friends", icon: Search },
    { name: "チャット", href: "/chat", icon: MessageCircle },
    { name: "設定", href: "/profile", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-white pb-safe z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1",
                isActive ? "text-black" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}