"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth/client";

const orbAnimationCSS = `
@keyframes float1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -40px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(40px, 30px) scale(1.02); }
}
@keyframes float2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, 30px) scale(1.08); }
  66% { transform: translate(30px, -20px) scale(0.96); }
}
@keyframes float3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  20% { transform: translate(50px, 20px) scale(1.03); }
  40% { transform: translate(-30px, -30px) scale(0.97); }
  60% { transform: translate(20px, 50px) scale(1.06); }
  80% { transform: translate(-40px, -10px) scale(0.98); }
}
@keyframes float4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-50px, 40px) scale(1.1); }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 0.8; transform: scale(1); }
}
@keyframes shimmer {
  0% { opacity: 0.02; }
  50% { opacity: 0.06; }
  100% { opacity: 0.02; }
}
`;

const sparkles = [
  { top: "15%", left: "20%", delay: "0s", dur: "4s" },
  { top: "25%", left: "45%", delay: "1.2s", dur: "3.5s" },
  { top: "70%", left: "12%", delay: "2.5s", dur: "5s" },
  { top: "40%", left: "65%", delay: "0.8s", dur: "4.2s" },
  { top: "80%", left: "55%", delay: "3s", dur: "3.8s" },
  { top: "10%", left: "75%", delay: "1.5s", dur: "4.5s" },
  { top: "55%", left: "30%", delay: "2s", dur: "3.2s" },
  { top: "35%", left: "85%", delay: "0.5s", dur: "5.2s" },
  { top: "90%", left: "40%", delay: "3.5s", dur: "4s" },
  { top: "50%", left: "10%", delay: "1.8s", dur: "3.6s" },
  { top: "20%", left: "60%", delay: "2.8s", dur: "4.8s" },
  { top: "65%", left: "80%", delay: "0.3s", dur: "3.4s" },
];

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styleRef = useRef<boolean>(false);

  useEffect(() => {
    if (searchParams.get("error") === "disabled") {
      setError("Your account has been disabled. Contact an administrator.");
    }
  }, [searchParams]);

  // Inject animation CSS once
  useEffect(() => {
    if (styleRef.current) return;
    styleRef.current = true;
    const style = document.createElement("style");
    style.textContent = orbAnimationCSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const inputStyle = {
    background: "hsla(20, 10%, 100%, 0.05)",
    border: "1px solid hsla(20, 10%, 100%, 0.08)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "hsla(350, 70%, 55%, 0.4)";
    e.currentTarget.style.boxShadow = "0 0 0 3px hsla(350, 70%, 55%, 0.08), 0 0 20px hsla(350, 70%, 55%, 0.05)";
    e.currentTarget.style.background = "hsla(20, 10%, 100%, 0.07)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "hsla(20, 10%, 100%, 0.08)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "hsla(20, 10%, 100%, 0.05)";
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden"
      style={{ background: "hsl(20, 10%, 6%)" }}
    >
      {/* ===== Animated Orbs ===== */}
      {/* Large coral orb — top-left */}
      <div className="absolute rounded-full blur-3xl"
        style={{
          width: 500, height: 500, top: "-10%", left: "-5%",
          background: "radial-gradient(circle, hsla(15, 90%, 55%, 0.18), hsla(350, 80%, 50%, 0.08), transparent 70%)",
          animation: "float1 20s ease-in-out infinite",
        }}
      />
      {/* Rose-pink orb — center-right */}
      <div className="absolute rounded-full blur-3xl"
        style={{
          width: 400, height: 400, top: "20%", right: "5%",
          background: "radial-gradient(circle, hsla(340, 80%, 55%, 0.15), hsla(350, 70%, 45%, 0.06), transparent 70%)",
          animation: "float2 25s ease-in-out infinite",
        }}
      />
      {/* Warm amber orb — bottom-left */}
      <div className="absolute rounded-full blur-3xl"
        style={{
          width: 450, height: 450, bottom: "-5%", left: "15%",
          background: "radial-gradient(circle, hsla(30, 85%, 50%, 0.16), hsla(20, 80%, 45%, 0.07), transparent 70%)",
          animation: "float3 30s ease-in-out infinite",
        }}
      />
      {/* Small coral orb — center accent */}
      <div className="absolute rounded-full blur-2xl"
        style={{
          width: 200, height: 200, top: "60%", right: "25%",
          background: "radial-gradient(circle, hsla(15, 85%, 55%, 0.12), transparent 70%)",
          animation: "float4 18s ease-in-out infinite",
        }}
      />
      {/* Medium rose orb — bottom-right */}
      <div className="absolute rounded-full blur-3xl"
        style={{
          width: 350, height: 350, bottom: "10%", right: "-5%",
          background: "radial-gradient(circle, hsla(350, 75%, 50%, 0.1), transparent 70%)",
          animation: "float2 22s ease-in-out infinite reverse",
        }}
      />
      {/* Small amber orb — top-center */}
      <div className="absolute rounded-full blur-2xl"
        style={{
          width: 250, height: 250, top: "5%", left: "40%",
          background: "radial-gradient(circle, hsla(35, 80%, 50%, 0.1), transparent 70%)",
          animation: "float1 28s ease-in-out infinite reverse",
        }}
      />

      {/* Sparkle particles */}
      {sparkles.map((p, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: 3, height: 3, top: p.top, left: p.left,
            background: "white",
            animation: `sparkle ${p.dur} ease-in-out ${p.delay} infinite`,
            opacity: 0,
          }}
        />
      ))}

      {/* Shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, transparent 30%, hsla(350, 60%, 50%, 0.04) 50%, transparent 70%)",
          animation: "shimmer 8s ease-in-out infinite",
        }}
      />

      {/* ===== Left Side — Logo + Slogan ===== */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-center pl-16 pr-12 pt-12 pb-16 z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl gradient-coral"
            style={{ boxShadow: "0 4px 20px hsla(15, 80%, 50%, 0.3)" }}
          >
            <Flame className="w-7 h-7 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white/90">
            Libe AI Os
          </span>
        </div>

        <h1 className="text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">
          AI Together.
          <br />
          Build Faster.
        </h1>


      </div>

      {/* ===== Right Side — Login Form ===== */}
      <div className="flex-1 flex items-center justify-start p-8 lg:pl-16 lg:pr-12 z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl gradient-coral shadow-lg mb-4"
              style={{ boxShadow: "0 4px 20px hsla(15, 80%, 50%, 0.3)" }}
            >
              <Flame className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Libe AI Os</h1>
            <p className="text-sm mt-1" style={{ color: "hsl(15, 10%, 45%)" }}>AI Together. Build Faster.</p>
          </div>

          {/* Welcome */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-base" style={{ color: "hsl(15, 10%, 45%)" }}>
              Sign in to your account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm p-3 rounded-lg mb-5"
              style={{
                background: "hsla(0, 70%, 50%, 0.12)",
                color: "hsl(0, 80%, 65%)",
                border: "1px solid hsla(0, 70%, 50%, 0.2)",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              setError(null);
              const email = `${userId.trim()}@libe.aios`;
              const result = await signIn.email({ email, password, callbackURL: "/projects" });
              if (result?.error) {
                setError("Invalid User ID or password");
              }
              setIsLoading(false);
            }}
          >
            <div>
              <label htmlFor="userId" className="block text-base font-medium mb-2.5"
                style={{ color: "hsl(15, 10%, 55%)" }}
              >
                User ID
              </label>
              <input
                id="userId"
                type="text"
                placeholder="e.g. admin"
                autoComplete="username"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="w-full px-5 py-3.5 rounded-xl text-base text-white placeholder:opacity-30
                  focus:outline-none transition-all duration-300"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-base font-medium mb-2.5"
                style={{ color: "hsl(15, 10%, 55%)" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-5 py-3.5 pr-12 rounded-xl text-base text-white placeholder:opacity-30
                    focus:outline-none transition-all duration-300"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "hsl(15, 10%, 35%)" }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl gradient-coral text-white font-semibold
                text-base disabled:opacity-70 flex justify-center items-center
                transition-all duration-300 hover:-translate-y-0.5
                active:translate-y-0 mt-1"
              style={{
                boxShadow: "0 4px 25px hsla(15, 80%, 50%, 0.25), 0 0 40px hsla(350, 70%, 50%, 0.1)",
              }}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: "hsl(15, 10%, 28%)" }}>
            Powered by AI-Human Collaboration
          </p>
        </div>
      </div>
    </div>
  );
}
