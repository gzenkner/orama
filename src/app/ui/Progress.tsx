import React from "react";
import { cn } from "./cn";

type Props = {
  value: number; // 0..1
  className?: string;
};

export default function Progress({ value, className }: Props) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div className={cn("app-progress-track h-2.5 w-full overflow-hidden rounded-[0.4rem]", className)}>
      <div className="app-progress-fill h-full rounded-[0.4rem]" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
