import React from "react";
import { cn } from "./cn";
import type { AppTab } from "../types";

export type TabKey = AppTab;

type Props = {
  value: TabKey;
  onChange: (next: TabKey) => void;
};

const labels: Record<TabKey, string> = {
  overview: "Overview",
  plan: "Plan",
  calendar: "Calendar",
  backup: "Backup"
};

export default function Tabs({ value, onChange }: Props) {
  const keys = Object.keys(labels) as TabKey[];
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm transition",
              active ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 bg-transparent hover:bg-zinc-900"
            )}
            onClick={() => onChange(k)}
          >
            {labels[k]}
          </button>
        );
      })}
    </div>
  );
}
