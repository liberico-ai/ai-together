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
  title: {
    template: "%s | Libe Aios",
    default: "Libe Aios — AI-First Project Management",
  },
  description:
    "Software project management platform designed for AI-Human collaboration. Manage projects, modules, tasks with AI Agent integration via MCP Server.",
  keywords: ["AI", "Project Management", "MCP", "Collaboration", "Task Tracking"],
  authors: [{ name: "Libe Aios Team" }],
  openGraph: {
    title: "Libe Aios — AI-First Project Management",
    description: "Manage projects, modules, tasks with AI Agent integration via MCP Server.",
    type: "website",
    siteName: "Libe Aios",
  },
  twitter: {
    card: "summary_large_image",
    title: "Libe Aios",
    description: "AI-First Project Management Platform",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" }, // stone-950
  ],
  width: "device-width",
  initialScale: 1,
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
