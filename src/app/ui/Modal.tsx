import React from "react";
import { cn } from "./cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export default function Modal({ open, onClose, title, children, footer, className }: Props) {
  const ref = React.useRef<HTMLDialogElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "app-modal w-[min(720px,92vw)] rounded-[0.95rem]",
        className
      )}
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-5 py-4">
        <div>
          <div className="font-display text-lg font-semibold">{title}</div>
          <div className="mt-1 text-xs app-muted">{"Outcome -> monthly -> weekly -> daily"}</div>
        </div>
        <button
          className="app-ghost-outline rounded-[0.45rem] px-2 py-1 text-xs transition"
          onClick={onClose}
        >
          Esc
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--app-border)] px-5 py-4">{footer}</div>
      ) : null}
    </dialog>
  );
}
