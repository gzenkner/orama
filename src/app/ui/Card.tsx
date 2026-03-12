import React from "react";
import { cn } from "./cn";

export default function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("app-card rounded-[0.85rem]", className)} {...props} />;
}
