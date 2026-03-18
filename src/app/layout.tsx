import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Geist } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TRPCProvider } from "@/lib/trpc/client";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Libe Aios — AI-First Project Management",
  description:
    "Software project management platform designed for AI-Human collaboration. Manage projects, modules, tasks with AI Agent integration via MCP Server.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
