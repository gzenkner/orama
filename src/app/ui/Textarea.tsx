import React from "react";
import { cn } from "./cn";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Textarea({ className, ...props }: Props) {
  return (
    <textarea
      className={cn(
        "app-textarea min-h-24 w-full resize-y rounded-[0.6rem] px-3 py-2 text-sm focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
