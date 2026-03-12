import React from "react";
import { cn } from "./cn";
import type { AppTab } from "../types";

export type TabKey = AppTab;

type Props = {
  value: TabKey;
  onChange: (next: TabKey) => void;
};

export const TAB_META: Record<TabKey, { label: string; hint: string }> = {
  overview: { label: "Overview", hint: "today and progress" },
  plan: { label: "Plan", hint: "month to day" },
  calendar: { label: "Calendar", hint: "whole-range check-ins" },
  settings: { label: "Settings", hint: "theme, prefs, and backup" }
};

export default function Tabs({ value, onChange }: Props) {
  const keys = Object.keys(TAB_META) as TabKey[];
  return (
    <div className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4">
      {keys.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            className={cn(
              "app-tab rounded-[0.7rem] px-3 py-3 text-left transition",
              active ? "app-tab-active" : "hover:bg-[color:var(--app-nav-hover)]"
            )}
            onClick={() => onChange(k)}
          >
            <div className="text-sm font-semibold">{TAB_META[k].label}</div>
            <div className="mt-1 text-[11px] app-muted">{TAB_META[k].hint}</div>
          </button>
        );
      })}
    </div>
  );
}
