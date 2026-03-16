import React from "react";
import { cn } from "./cn";
import { clampProgress, trafficLightToneFromProgress, trafficLightVar, type TrafficLightTone } from "./trafficLight";

type Props = {
  value: number; // 0..1
  className?: string;
  tone?: TrafficLightTone;
};

export default function Progress({ value, className, tone }: Props) {
  const v = clampProgress(value);
  const resolvedTone = tone ?? trafficLightToneFromProgress(v);

  return (
    <div className={cn("app-progress-track h-2.5 w-full overflow-hidden rounded-[0.4rem]", className)}>
      <div
        className="app-progress-fill h-full rounded-[0.4rem]"
        style={{ width: `${v * 100}%`, background: trafficLightVar(resolvedTone, "fill") }}
      />
    </div>
  );
}
