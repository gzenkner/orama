import React from "react";
import { cn } from "./cn";

export default function OramaLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center", className)} aria-label="Orama">
      <img
        src="/orama-logo-v4-horizontal.png"
        alt="Orama"
        className="h-[4.4rem] w-auto shrink-0 object-contain"
        style={{ aspectRatio: "1616 / 396" }}
      />
    </div>
  );
}
