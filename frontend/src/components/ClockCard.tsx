import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { shiftApi, useAction, useActiveShift, useMe } from "@/lib/queries";
import { fa } from "@/lib/format";
import { cn } from "@/lib/cn";

function elapsed(since: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return fa(`${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
}

/** One-tap clock in / out with a live timer. */
export default function ClockCard() {
  const { data: me } = useMe();
  const { data: active } = useActiveShift();
  const channels = (me?.channels ?? []).filter((c) => c.active);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setChannelId(me?.user.channelId ?? channels[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.user.channelId, channels.length]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const clockIn = useAction(() => shiftApi.clockIn(channelId), { success: "شیفتت شروع شد، قوی باشی! 💪" });
  const clockOut = useAction(() => shiftApi.clockOut(""), { success: "خسته نباشی! ثبت شد ✨" });
  const ch = channels.find((c) => c.id === active?.channelId);

  return (
    <div className={cn("card relative overflow-hidden p-4", active && "border-mint/40")}>
      {active && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(46,230,182,0.14),transparent_60%)]" />}
      <div className="relative flex items-center justify-between gap-3">
        <div>
          {active ? (
            <>
              <div className="flex items-center gap-2 text-xs text-mint">
                <span className="pulse-dot h-2 w-2 rounded-full bg-mint" /> در حال کار {ch && `، ${ch.name}`}
              </div>
              <div className="ltr mt-1 text-right text-3xl font-black tabular-nums tracking-wider">{elapsed(active.start)}</div>
              <div className="mt-0.5 text-xs text-muted">از ساعت {fa(active.startTime)}</div>
            </>
          ) : (
            <>
              <div className="font-bold">الان سر کاری؟</div>
              <div className="mt-0.5 text-xs text-muted">شروع رو بزن، آخرش هم پایان. بقیه‌اش با ما.</div>
            </>
          )}
        </div>
        {active ? (
          <button className="btn btn-danger h-14 w-14 shrink-0 rounded-2xl px-0" onClick={() => clockOut.mutate(undefined)} disabled={clockOut.isPending} aria-label="پایان شیفت">
            <Square size={20} fill="currentColor" />
          </button>
        ) : (
          <button className="btn btn-primary glow h-14 w-14 shrink-0 rounded-2xl px-0" onClick={() => clockIn.mutate(undefined)} disabled={clockIn.isPending} aria-label="شروع شیفت">
            <Play size={22} fill="currentColor" />
          </button>
        )}
      </div>
      {!active && channels.length > 1 && (
        <div className="relative mt-3 flex gap-1.5">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setChannelId(c.id)}
              className={cn("chip border py-1", channelId === c.id ? "text-foreground" : "border-border text-muted")}
              style={channelId === c.id ? { borderColor: c.color, background: `${c.color}22` } : undefined}
            >
              <i className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
