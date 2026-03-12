import React from "react";
import { cn } from "./cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export default function Button({ className, variant = "secondary", size = "md", ...props }: Props) {
  const base = "app-button px-3 py-2 focus:outline-none";
  const sizes = size === "sm" ? "h-9 rounded-[0.55rem] text-[13px]" : "h-10";
  const variants: Record<NonNullable<Props["variant"]>, string> = {
    primary: "app-button-primary",
    secondary: "app-button-secondary",
    ghost: "app-button-ghost",
    danger: "app-button-danger"
  };

  return <button className={cn(base, sizes, variants[variant], className)} {...props} />;
}
