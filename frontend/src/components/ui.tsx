import { Drawer } from "vaul";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useToasts } from "@/stores/toast";
import type { ShiftStatus, UserBrief } from "@/lib/types";

/**
 * Renders fixed-position UI (action bars, floating buttons) into <body>. Pages
 * animate in with a transform, which would otherwise make `fixed` relative to
 * the page content instead of the screen.
 */
export function Floating({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/** Bottom sheet in the style of the website's vaul drawers. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <Drawer.Content
          dir="rtl"
          className="fixed bottom-0 left-1/2 z-50 flex max-h-[92dvh] w-full max-w-3xl -translate-x-1/2 flex-col rounded-t-3xl border-t border-border bg-popover outline-none"
        >
          <div className="mx-auto mt-3 h-1 w-24 shrink-0 rounded-full bg-border" />
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <Drawer.Title className="text-lg font-bold">{title}</Drawer.Title>
            <Drawer.Description className="sr-only">{title}</Drawer.Description>
            <button onClick={() => onOpenChange(false)} className="rounded-full p-1.5 text-muted hover:bg-white/5" aria-label="بستن">
              <X size={20} />
            </button>
          </div>
          <div className="h-px bg-border" />
          <div className="overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-border")}
      >
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "right-6" : "right-1")} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-xl border border-border bg-background p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-primary text-white shadow-[0_0_0_1px_var(--purple400)_inset]" : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ user, size = 40, online }: { user: Pick<UserBrief, "avatar" | "color" | "name">; size?: number; online?: boolean }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-2xl"
      style={{ width: size, height: size, background: `${user.color || "#a855f7"}2e`, boxShadow: `0 0 0 1px ${user.color || "#a855f7"}66 inset` }}
      aria-hidden
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{user.avatar || user.name.slice(0, 1)}</span>
      {online && <span className="pulse-dot absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-surface bg-mint" />}
    </span>
  );
}

const STATUS: Record<ShiftStatus, { label: string; cls: string }> = {
  approved: { label: "تایید شده", cls: "bg-mint-soft text-mint" },
  pending: { label: "در انتظار تایید", cls: "bg-amber-soft text-amber" },
  rejected: { label: "رد شده", cls: "bg-danger-soft text-danger" },
};

export function StatusChip({ status }: { status: ShiftStatus }) {
  return <span className={cn("chip", STATUS[status].cls)}>{STATUS[status].label}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin text-primary", className)} size={22} />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-5xl">{emoji}</div>
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Prev / label / next navigator for weeks and months. Arrows follow RTL reading order. */
export function PeriodNav({ label, offset, setOffset }: { label: string; offset: number; setOffset: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button className="btn btn-ghost h-9 w-9 px-0" onClick={() => setOffset(offset - 1)} aria-label="قبلی">
        <ChevronRight size={20} />
      </button>
      <div className="flex flex-col items-center">
        <span className="text-sm font-semibold">{label}</span>
        {offset !== 0 && (
          <button className="text-[0.7rem] text-primary" onClick={() => setOffset(0)}>
            برگرد به الان
          </button>
        )}
      </div>
      <button className="btn btn-ghost h-9 w-9 px-0" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="بعدی">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "rise pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur",
            t.tone === "error" && "border-danger/40 bg-[#2a1215]/95 text-red-200",
            t.tone === "success" && "border-mint/30 bg-[#0f231e]/95 text-emerald-100",
            t.tone === "info" && "border-border bg-popover/95",
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string }) {
  return (
    <div className="card p-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[0.7rem] text-subtle">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between">
      <h2 className="text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}
