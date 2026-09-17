import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  full?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        className={`relative flex flex-col rounded-t-2xl border-t border-border bg-surface ${full ? "h-[92vh]" : "max-h-[85vh]"}`}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close sheet" className="rounded-full p-1 text-muted-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8">{children}</div>
      </div>
    </div>
  );
}
