"use client";

import { useRouter } from "next/navigation";
import { LogOut, User, ChevronDown, Settings, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { CommandSearch } from "./command-search";
import { useSession, signOut } from "@/lib/auth/client";
import { trpc } from "@/lib/trpc/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { data: session } = useSession();
  const { data: profile } = trpc.users.me.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const userRole = (session?.user as any)?.role || "user";
  const avatarUrl = profile?.avatarUrl || profile?.image;

  const roleBadgeClass =
    userRole === "admin"
      ? "bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800"
      : userRole === "chairman"
      ? "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 border-stone-200 dark:border-stone-700";

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
      <CommandSearch />

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationsBell />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={session?.user?.name || "Avatar"}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full gradient-coral flex items-center justify-center
                  text-white text-sm font-semibold uppercase">
                  {session?.user?.name?.charAt(0) || "?"}
                </div>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session?.user?.name || "User"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleBadgeClass}`}>
                      {userRole.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {userRole === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/admin")} className="cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30">
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Admin Panel
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
