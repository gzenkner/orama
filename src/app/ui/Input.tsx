import React from "react";
import { cn } from "./cn";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "app-input h-10 w-full rounded-[0.6rem] px-3 text-sm focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
