"use client";

import { Bell, Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between h-16 px-6
        border-b backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-80
        bg-secondary/50 text-muted-foreground text-sm
        transition-all duration-200 focus-within:ring-2 focus-within:ring-ring/20"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search projects, tasks, members..."
          className="flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground/60"
        />
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5
          rounded text-xs bg-muted text-muted-foreground font-mono">
          ⌘K
        </kbd>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        {/* Notification Bell */}
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-lg
            bg-secondary hover:bg-secondary/80 transition-all duration-200
            text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {/* Unread badge */}
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center
            w-4 h-4 text-[10px] font-bold rounded-full
            bg-primary text-primary-foreground">
            3
          </span>
        </button>

        {/* User Avatar */}
        <button className="flex items-center gap-2 pl-3">
          <div className="w-8 h-8 rounded-full gradient-coral flex items-center justify-center
            text-white text-sm font-semibold">
            A
          </div>
        </button>
      </div>
    </header>
  );
}
