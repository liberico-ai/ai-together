import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { users } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatWidget } from "@/components/chat/chat-widget";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) {
    redirect("/login");
  }

  // Check if user is banned
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { banned: true },
  });
  if (user?.banned) {
    redirect("/login?error=disabled");
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 ml-[250px] transition-all duration-300">
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <ChatProvider>
        <ChatWidget />
      </ChatProvider>
    </div>
  );
}

