import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Moon, Trash2 } from "lucide-react";
import { Sheet } from "./ui";
import { cn } from "@/lib/cn";
import { addDays, bonusMinutes, dayLabel, duration, fa, hmToMin, isoDay, relativeDay, weekdayShort, fmtDate } from "@/lib/format";
import { shiftApi, useAction, useMe, useShifts, useUsers } from "@/lib/queries";
import type { Shift } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shift?: Shift | null; // edit mode when set
  asAdmin?: boolean; // lets the admin pick whose shift it is
  defaultDate?: string;
}

export default function ShiftForm({ open, onOpenChange, shift, asAdmin, defaultDate }: Props) {
  const { data: me } = useMe();
  const cal = me?.settings.calendar ?? "gregorian";
  const channels = (me?.channels ?? []).filter((c) => c.active || c.id === shift?.channelId);
  const { data: users } = useUsers(!!asAdmin);
  const { data: recent } = useShifts({ limit: 30, userId: asAdmin ? undefined : me?.user.id });

  const [userId, setUserId] = useState<number>(0);
  const [date, setDate] = useState(isoDay(new Date()));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [channelId, setChannelId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (shift) {
      setUserId(shift.userId);
      setDate(shift.date);
      setStart(shift.startTime);
      setEnd(shift.endTime);
      setChannelId(shift.channelId);
      setNote(shift.note);
    } else {
      setUserId(0);
      setDate(defaultDate ?? isoDay(new Date()));
      setNote("");
      setChannelId(me?.user.channelId ?? channels[0]?.id ?? null);
      const last = recent?.find((s) => s.endTime && s.userId === me?.user.id);
      if (last) {
        setStart(last.startTime);
        setEnd(last.endTime);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shift]);

  // The employee's most used time ranges become one-tap presets.
  const presets = useMemo(() => {
    const count = new Map<string, number>();
    recent?.forEach((s) => s.endTime && count.set(`${s.startTime}-${s.endTime}`, (count.get(`${s.startTime}-${s.endTime}`) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k.split("-") as [string, string]);
  }, [recent]);

  const s = hmToMin(start || "0:0");
  const e = hmToMin(end || "0:0");
  const overnight = e <= s;
  const minutes = overnight ? 1440 - s + e : e - s;
  const nightMinutes = useMemo(() => bonusMinutes(date, s, minutes, me?.rules ?? []), [date, s, minutes, me?.rules]);

  const days = Array.from({ length: 7 }, (_, i) => isoDay(addDays(new Date(), -i)));
  const save = useAction(
    () => {
      const body = { date, start, end, channelId, note, ...(asAdmin && userId ? { userId } : {}) };
      return shift ? shiftApi.update(shift.id, body) : shiftApi.create(body);
    },
    {
      success: shift ? "شیفت به‌روز شد ✨" : me?.settings.requireApproval && !asAdmin ? "ثبت شد! منتظر تایید مدیر بمون 🙌" : "ثبت شد! 🙌",
      onSuccess: () => onOpenChange(false),
    },
  );
  const remove = useAction(() => shiftApi.remove(shift!.id), { success: "شیفت حذف شد", onSuccess: () => onOpenChange(false) });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={shift ? "ویرایش شیفت" : "ثبت شیفت جدید"}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          save.mutate(undefined);
        }}
      >
        {asAdmin && !shift && (
          <div>
            <span className="label">برای چه کسی؟</span>
            <select className="field" value={userId} onChange={(ev) => setUserId(+ev.target.value)} required>
              <option value={0} disabled>
                انتخاب کن…
              </option>
              {users
                ?.filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.avatar} {u.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <span className="label">کدوم روز؟</span>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {days.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDate(d)}
                className={cn(
                  "flex min-w-14 shrink-0 flex-col items-center rounded-xl border px-2.5 py-2 transition",
                  date === d ? "border-primary bg-primary-soft text-foreground" : "border-border bg-background text-muted",
                )}
              >
                <span className="text-[0.65rem]">{d === days[0] ? "امروز" : d === days[1] ? "دیروز" : weekdayShort(cal, d)}</span>
                <span className="text-lg font-bold">{fmtDate(cal, d, { day: "numeric" })}</span>
              </button>
            ))}
            <label
              className={cn(
                "relative flex min-w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border px-2.5 py-2",
                !days.includes(date) ? "border-primary bg-primary-soft" : "border-border bg-background text-muted",
              )}
            >
              <CalendarDays size={18} />
              <span className="mt-0.5 text-[0.65rem]">روز دیگه</span>
              <input
                type="date"
                className="absolute inset-0 opacity-0"
                value={date}
                max={asAdmin ? undefined : isoDay(new Date())}
                onChange={(ev) => ev.target.value && setDate(ev.target.value)}
              />
            </label>
          </div>
          <div className="mt-1.5 text-xs text-muted">{relativeDay(cal, date) === "امروز" || relativeDay(cal, date) === "دیروز" ? dayLabel(cal, date) : relativeDay(cal, date)}</div>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">شروع</span>
              <input type="time" className="field ltr text-center text-base" value={start} onChange={(ev) => setStart(ev.target.value)} required />
            </label>
            <label>
              <span className="label">پایان</span>
              <input type="time" className="field ltr text-center text-base" value={end} onChange={(ev) => setEnd(ev.target.value)} required />
            </label>
          </div>
          {presets.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {presets.map(([a, b]) => (
                <button
                  type="button"
                  key={`${a}-${b}`}
                  onClick={() => {
                    setStart(a);
                    setEnd(b);
                  }}
                  className={cn("chip border py-1", start === a && end === b ? "border-primary text-foreground" : "border-border text-muted")}
                >
                  ⚡ {fa(a)} تا {fa(b)}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-background px-3 py-2.5 text-sm">
            <span>
              ⏱️ <b>{duration(minutes)}</b>
            </span>
            {overnight && minutes > 0 && <span className="chip bg-primary-soft text-purple-light">از نیمه‌شب رد می‌شه</span>}
            {nightMinutes > 0 && (
              <span className="chip bg-primary-soft text-purple-light">
                <Moon size={11} /> {duration(nightMinutes)} با ضریب بیشتر
              </span>
            )}
          </div>
        </div>

        {channels.length > 0 && (
          <div>
            <span className="label">با کدوم تیم کار کردی؟</span>
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setChannelId(c.id)}
                  className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition", channelId === c.id ? "text-foreground" : "border-border text-muted")}
                  style={channelId === c.id ? { borderColor: c.color, background: `${c.color}22` } : undefined}
                >
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label>
          <span className="label">یادداشت (اختیاری)</span>
          <textarea className="field h-auto min-h-20 py-2.5" value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={500} placeholder="مثلاً: جای علی وایسادم" />
        </label>

        {shift?.reviewNote && <div className="rounded-xl bg-amber-soft px-3 py-2 text-xs text-amber">💬 {shift.reviewNote}</div>}

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary h-12 flex-1 text-base" disabled={save.isPending || minutes === 0 || (asAdmin && !shift && !userId)}>
            {shift ? "ذخیره تغییرات" : "ثبت کن"}
          </button>
          {shift && (
            <button
              type="button"
              className={cn("btn h-12", confirmDelete && "btn-danger")}
              onClick={() => (confirmDelete ? remove.mutate(undefined) : setConfirmDelete(true))}
              disabled={remove.isPending}
            >
              <Trash2 size={18} />
              {confirmDelete && "مطمئنی؟"}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
