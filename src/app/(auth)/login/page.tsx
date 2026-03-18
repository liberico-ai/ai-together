"use client";

import { useState } from "react";
import { Flame, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl gradient-coral shadow-lg mb-4">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Libe Aios</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-First Project Management</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-card border border-border shadow-xl p-8">
          <h2 className="text-xl font-semibold mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in to your account</p>

          <form className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background
                  text-sm placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary
                  transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-input bg-background
                    text-sm placeholder:text-muted-foreground/50
                    focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary
                    transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground
                    hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg gradient-coral text-white font-semibold
                text-sm shadow-md hover:shadow-lg
                transition-all duration-300 hover:-translate-y-0.5
                active:translate-y-0 active:shadow-md"
            >
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by AI-Human Collaboration
        </p>
      </div>
    </div>
  );
}
