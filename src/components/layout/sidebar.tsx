"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Trophy,
  BarChart3,
  Users,
  ChevronLeft,
  LifeBuoy,
  Flame,
  LayoutGrid,
  Gauge,
  Wallet,
  Banknote,
} from "lucide-react";
import { useState } from "react";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/bu-board", label: "BU Board", icon: LayoutGrid },
  { href: "/operations", label: "Operations", icon: LifeBuoy },
  { href: "/my-tasks", label: "My Tasks", icon: ClipboardList },
  { href: "/workload", label: "Workload", icon: Users },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/kpi", label: "KPI", icon: Gauge },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/finance", label: "Tài chính", icon: Wallet },
  { href: "/payroll", label: "Bảng lương", icon: Banknote },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen flex flex-col
        border-r transition-all duration-300
        ${collapsed ? "w-[70px]" : "w-[250px]"}
      `}
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-3 px-4 h-16 border-b hover:bg-secondary/30 transition-colors"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-coral">
          <Flame className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Libe Aios
          </span>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group
                ${isActive ? "" : "hover:translate-x-0.5"}
              `}
              style={{
                backgroundColor: isActive ? "var(--sidebar-item-active-bg)" : "transparent",
                color: isActive ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--sidebar-item-hover-bg)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }
              }}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Collapse Toggle only */}
      <div className="px-3 pt-2 pb-3 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-sm transition-all duration-200"
          style={{ color: "var(--sidebar-text)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--sidebar-item-hover-bg)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span className="ml-2">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
