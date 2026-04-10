import React from "react";
import { cn } from "./cn";

export default function OramaLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} aria-label="Orama">
      <svg
        viewBox="0 0 34 34"
        className="h-[3.25rem] w-[3.25rem] shrink-0 text-[color:var(--outcome-ink)]"
        role="img"
        aria-hidden="true"
      >
        <circle cx="17" cy="17" r="10.5" fill="none" stroke="currentColor" strokeWidth="4.4" />
        <path d="M24.2 9.8 28 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="27.4" cy="6.5" r="2" fill="currentColor" />
      </svg>

      <div className="leading-none">
        <div className="font-display text-[1.45rem] font-semibold lowercase tracking-[0.08em]" style={{ color: "var(--outcome-ink)" }}>
          orama
        </div>
      </div>
    </div>
  );
}
