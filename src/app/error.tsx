"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a] bg-grid-pattern p-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111827] p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        {/* Heading */}
        <h1 className="mb-2 text-2xl font-bold text-white">
          Something went wrong
        </h1>

        {/* Error message */}
        <p className="mb-8 text-sm text-slate-400">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-cyan-400 hover:to-cyan-500 active:translate-y-px"
          >
            Try Again
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white active:translate-y-px"
          >
            Go to Dashboard
          </Link>
        </div>

        {/* Digest (for debugging) */}
        {error.digest && (
          <p className="mt-6 font-mono text-xs text-slate-600">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
