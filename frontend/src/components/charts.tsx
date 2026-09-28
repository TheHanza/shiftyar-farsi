import { useState } from "react";
import { Moon } from "lucide-react";
import type { Calendar, Channel, CoverageItem, DayRow } from "@/lib/types";
import { fa, hm, hours, isoDay, minToHM, parseDay, shortDay, weekdayShort, fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Progress ring for a goal. Turns mint once the goal is reached. */
export function GoalRing({ value, goal, size = 92, label }: { value: number; goal: number; size?: number; label: string }) {
  const pct = goal > 0 ? value / goal : 0;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label}: ${Math.round(pct * 100)}٪`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--popover)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={done ? "var(--mint)" : "var(--primary)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(pct, 1))}
            style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {goal > 0 ? (
            <>
              <span className="text-lg font-extrabold leading-none">{done ? "🎉" : `${fa(Math.round(pct * 100))}٪`}</span>
              <span className="mt-1 text-[0.65rem] text-muted">
                {hours(value)} از {fa(Math.round(goal / 60))}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold">{hm(value)}</span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

/**
 * Daily hours as bars: approved (solid) with pending stacked on top (striped).
 * Tap or hover a bar to read its exact value.
 */
export function DayBars({ days, calendar }: { days: DayRow[]; calendar: Calendar }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(60, ...days.map((d) => d.minutes + d.pendingMinutes));
  const scaleMax = Math.ceil(max / 120) * 120; // round to 2h
  const hasPending = days.some((d) => d.pendingMinutes > 0);
  const isWeek = days.length <= 7;
  const today = isoDay(new Date());
  const active = sel !== null ? days[sel] : null;

  return (
    <div>
      <div className="mb-2 flex min-h-5 items-center justify-between text-xs">
        {active ? (
          <span>
            <span className="text-muted">{fmtDate(calendar, active.date, { weekday: "long", day: "numeric", month: "long" })}: </span>
            <b>{hm(active.minutes)}</b>
            {active.pendingMinutes > 0 && <span className="text-muted"> + {hm(active.pendingMinutes)} در انتظار</span>}
          </span>
        ) : (
          <span className="text-subtle">روی ستون‌ها بزن تا جزئیات را ببینی</span>
        )}
        {hasPending && (
          <span className="flex items-center gap-3 text-muted">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> تایید شده
            </span>
            <span className="flex items-center gap-1">
              <i className="stripes inline-block h-2.5 w-2.5 rounded-sm" /> در انتظار
            </span>
          </span>
        )}
      </div>
      <div className="relative h-36">
        {/* recessive gridlines at half and full scale */}
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-white/[0.07]" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-surface pr-1 text-[0.6rem] text-subtle">{fa(Math.round((scaleMax * f) / 60))}س</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pl-6">
          {days.map((d, i) => {
            const a = (d.minutes / scaleMax) * 100;
            const p = (d.pendingMinutes / scaleMax) * 100;
            return (
              <button
                key={d.date}
                className={cn("group flex h-full flex-1 flex-col justify-end rounded-t", sel === i && "bg-white/[0.04]")}
                onMouseEnter={() => setSel(i)}
                onClick={() => setSel(sel === i ? null : i)}
                aria-label={`${shortDay(calendar, d.date)}: ${hm(d.minutes)}`}
              >
                {p > 0 && <div className={cn("stripes w-full", a > 0 ? "mb-[2px] rounded-t-[4px]" : "rounded-t-[4px]")} style={{ height: `${p}%` }} />}
                {a > 0 && <div className={cn("w-full bg-primary transition-[height]", p > 0 ? "" : "rounded-t-[4px]")} style={{ height: `${a}%` }} />}
                {a + p === 0 && <div className="h-[2px] w-full rounded-full bg-white/10" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pl-6">
        {days.map((d, i) => (
          <span key={d.date} className={cn("flex-1 text-center text-[0.6rem]", d.date === today ? "font-bold text-primary" : "text-subtle")}>
            {isWeek ? weekdayShort(calendar, d.date) : i % 5 === 0 ? fmtDate(calendar, d.date, { day: "numeric" }) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function merge(intervals: [number, number][]) {
  const s = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([...iv]);
  }
  return out;
}

/** Who covered which part of a day, like the old half-hour sheet but readable. */
export function CoverageTimeline({
  items,
  channels,
  date,
}: {
  items: CoverageItem[];
  channels: Channel[];
  date: string;
}) {
  const [sel, setSel] = useState<CoverageItem | null>(null);
  const channelColor = (id: number | null) => channels.find((c) => c.id === id)?.color ?? "#737373";
  const pos = (m: number) => `${(m / 1440) * 100}%`;

  const now = new Date();
  const isToday = parseDay(date).toDateString() === now.toDateString();
  const horizon = isToday ? now.getHours() * 60 + now.getMinutes() : parseDay(date) < now ? 1440 : 0;
  const covered = merge(items.map((i) => [i.startMin, i.endMin]));
  const gaps: [number, number][] = [];
  let cursor = 0;
  for (const [a, b] of covered) {
    if (a > cursor) gaps.push([cursor, Math.min(a, horizon)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < horizon) gaps.push([cursor, horizon]);
  const realGaps = gaps.filter(([a, b]) => b - a >= 15);
  const gapMinutes = realGaps.reduce((s, [a, b]) => s + b - a, 0);

  const rows = new Map<number, CoverageItem[]>();
  items.forEach((i) => rows.set(i.user.id, [...(rows.get(i.user.id) ?? []), i]));
  const usedChannels = channels.filter((c) => items.some((i) => i.channelId === c.id));

  const Track = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={cn("relative h-7 flex-1 overflow-hidden rounded-lg bg-background", className)}>
      <div className="absolute inset-y-0 bg-white/[0.035]" style={{ right: 0, width: pos(360) }} />
      {[360, 720, 1080].map((m) => (
        <div key={m} className="absolute inset-y-0 w-px bg-white/[0.06]" style={{ right: pos(m) }} />
      ))}
      {isToday && <div className="absolute inset-y-0 z-10 w-[2px] bg-mint/80" style={{ right: pos(horizon) }} />}
      {children}
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex min-h-5 items-center justify-between text-xs">
        {sel ? (
          <span>
            <b>{sel.user.name}</b>
            <span className="text-muted">
              ، {fa(minToHM(sel.startMin))} تا {sel.open ? "الان" : sel.endMin >= 1440 ? "۲۴:۰۰" : fa(minToHM(sel.endMin))}،{" "}
              {hm(sel.endMin - sel.startMin)}
            </span>
          </span>
        ) : horizon > 0 ? (
          gapMinutes > 0 ? (
            <span className="text-danger">⚠️ {hm(gapMinutes)} ساعت بدون پوشش</span>
          ) : (
            <span className="text-mint">✅ همه ساعت‌ها پوشش داده شده</span>
          )
        ) : (
          <span className="text-subtle">روز هنوز شروع نشده</span>
        )}
        {usedChannels.length > 1 && (
          <span className="flex gap-2.5 text-muted">
            {usedChannels.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                {c.name}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[0.7rem] text-muted">پوشش</span>
        <Track className="h-4">
          {covered.map(([a, b]) => (
            <div key={a} className="absolute inset-y-0 bg-mint/70" style={{ right: pos(a), width: pos(b - a) }} />
          ))}
          {realGaps.map(([a, b]) => (
            <div key={a} className="absolute inset-y-0 bg-danger/60" style={{ right: pos(a), width: pos(b - a) }} />
          ))}
        </Track>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {[...rows.values()].map((list) => (
          <div key={list[0].user.id} className="flex items-center gap-2">
            <span className="flex w-16 shrink-0 items-center gap-1 truncate text-xs">
              <span>{list[0].user.avatar}</span>
              <span className="truncate">{list[0].user.name}</span>
            </span>
            <Track>
              {list.map((i) => (
                <button
                  key={i.shiftId}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => setSel(sel?.shiftId === i.shiftId ? null : i)}
                  className={cn(
                    "absolute inset-y-[3px] rounded-[4px] ring-2 ring-background",
                    i.status === "pending" && "opacity-60",
                    i.open && "animate-pulse",
                  )}
                  style={{ right: pos(i.startMin), width: `max(${pos(i.endMin - i.startMin)}, 4px)`, background: channelColor(i.channelId) }}
                  aria-label={`${i.user.name} ${minToHM(i.startMin)} تا ${minToHM(i.endMin)}`}
                />
              ))}
            </Track>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex gap-2">
        <span className="w-16 shrink-0" />
        <div className="relative h-4 flex-1 text-[0.6rem] text-subtle">
          {[0, 6, 12, 18, 24].map((h) => (
            <span
              key={h}
              className={cn("absolute", h > 0 && h < 24 && "translate-x-1/2")}
              style={h === 24 ? { left: 0 } : { right: pos(h * 60) }}
            >
              {fa(h)}
            </span>
          ))}
          <Moon size={10} className="absolute top-0.5 text-subtle" style={{ right: pos(170) }} />
        </div>
      </div>
    </div>
  );
}
