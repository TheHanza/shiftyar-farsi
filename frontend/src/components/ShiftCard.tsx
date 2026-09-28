import { Moon, MessageSquare } from "lucide-react";
import { Avatar, StatusChip } from "./ui";
import { duration, fa } from "@/lib/format";
import type { Channel, Shift } from "@/lib/types";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export default function ShiftCard({
  shift,
  channels,
  onClick,
  showUser,
  leading,
}: {
  shift: Shift;
  channels: Channel[];
  onClick?: () => void;
  showUser?: boolean;
  leading?: ReactNode;
}) {
  const ch = channels.find((c) => c.id === shift.channelId);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn("card flex w-full items-center gap-3 p-3 text-right transition", onClick && "hover:border-neutral-500 active:scale-[0.99]")}
    >
      {leading}
      {showUser && shift.user && <Avatar user={shift.user} size={40} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showUser && shift.user && <span className="truncate text-sm font-semibold">{shift.user.name}</span>}
          <span className={cn("ltr font-bold tracking-wide", showUser ? "text-sm text-muted" : "text-base")}>
            {fa(shift.startTime)} → {shift.end ? fa(shift.endTime) : "…"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {shift.end ? <span>{duration(shift.minutes)}</span> : <span className="text-mint">در حال کار</span>}
          {shift.bonusMinutes > 0 && (
            <span className="chip bg-primary-soft text-purple-light">
              <Moon size={10} /> {duration(shift.bonusMinutes)}
            </span>
          )}
          {ch && (
            <span className="flex items-center gap-1">
              <i className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
              {ch.name}
            </span>
          )}
          {shift.note && <MessageSquare size={12} className="text-subtle" aria-label="یادداشت دارد" />}
        </div>
      </div>
      <StatusChip status={shift.status} />
    </Tag>
  );
}
