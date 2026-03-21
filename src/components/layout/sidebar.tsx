"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Image,
  Megaphone,
  Zap,
  Settings,
  LogOut,
  Users,
  LayoutGrid,
  ClipboardList,
  Timer,
  SlidersHorizontal,
  Target,
  DollarSign,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/creatives", label: "Creatives", icon: Image },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/scaling", label: "Scaling", icon: Target },
  { href: "/assignments", label: "Assignments", icon: LayoutGrid },
  { href: "/my-work", label: "My Work", icon: ClipboardList },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/options", label: "Options", icon: SlidersHorizontal },
  { href: "/editors", label: "Editors", icon: Users },
  { href: "/trueprofit", label: "TrueProfit", icon: DollarSign },
  { href: "/rules", label: "Rules", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-56 flex-col bg-[#0f1629] border-r border-white/5">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
          <Megaphone className="h-4 w-4 text-white" />
        </div>
        <Link href="/dashboard" className="font-bold text-base text-white tracking-tight">
          MetaAds
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
              )}
            >
              <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-cyan-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t border-white/5">
        <button
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
