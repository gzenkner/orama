import React from "react";
import { cn } from "./cn";

const ORAMA_LOGO_SRC = `${import.meta.env.BASE_URL}orama-logo-v6-horizontal.png`;

export default function OramaLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center", className)} aria-label="Orama">
      <img
        src={ORAMA_LOGO_SRC}
        alt="Orama"
        className="h-[5.6rem] w-auto shrink-0 object-contain"
        style={{ aspectRatio: "1257 / 330" }}
      />
    </div>
  );
}
