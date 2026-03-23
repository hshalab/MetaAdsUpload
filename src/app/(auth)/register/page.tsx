"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Loader2, Video, Lightbulb } from "lucide-react";

type UserType = "video_editor" | "creative_strategist" | null;

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!userType) {
      setError("Please select your role");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, userType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Success - redirect to login
      router.push("/login?registered=true");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a] bg-grid-pattern px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/20">
            <Megaphone className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MetaAds</h1>
          <p className="text-sm text-slate-500 mt-1">Create your account</p>
        </div>

        {/* Register Card */}
        <div className="rounded-xl border border-white/10 bg-[#111827] p-6 shadow-2xl shadow-black/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            {/* User Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Video Editor Card */}
                <button
                  type="button"
                  onClick={() => setUserType("video_editor")}
                  className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                    userType === "video_editor"
                      ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                      userType === "video_editor"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-white/5 text-slate-500 group-hover:text-slate-400"
                    }`}
                  >
                    <Video className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-sm font-semibold transition-colors ${
                        userType === "video_editor" ? "text-white" : "text-slate-300"
                      }`}
                    >
                      Video Editor
                    </p>
                    <p
                      className={`text-xs mt-0.5 transition-colors ${
                        userType === "video_editor" ? "text-cyan-400/70" : "text-slate-600"
                      }`}
                    >
                      Edit and create video content
                    </p>
                  </div>
                  {/* Selected indicator */}
                  {userType === "video_editor" && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  )}
                </button>

                {/* Creative Strategist Card */}
                <button
                  type="button"
                  onClick={() => setUserType("creative_strategist")}
                  className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                    userType === "creative_strategist"
                      ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                      userType === "creative_strategist"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-white/5 text-slate-500 group-hover:text-slate-400"
                    }`}
                  >
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-sm font-semibold transition-colors ${
                        userType === "creative_strategist" ? "text-white" : "text-slate-300"
                      }`}
                    >
                      Creative Strategist
                    </p>
                    <p
                      className={`text-xs mt-0.5 transition-colors ${
                        userType === "creative_strategist" ? "text-cyan-400/70" : "text-slate-600"
                      }`}
                    >
                      Plan and review creative strategy
                    </p>
                  </div>
                  {/* Selected indicator */}
                  {userType === "creative_strategist" && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Sign in link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
