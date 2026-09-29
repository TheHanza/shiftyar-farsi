import { useState } from "react";
import { Plus } from "lucide-react";
import { useMe, useShifts, useSummary } from "@/lib/queries";
import { addDays, hm, isoDay, money, parseDay, periodLabel, relativeDay } from "@/lib/format";
import ShiftForm from "@/components/ShiftForm";
import ShiftCard from "@/components/ShiftCard";
import { Empty, Loading, PeriodNav, Stat } from "@/components/ui";
import { toast } from "@/stores/toast";
import type { Shift } from "@/lib/types";

export function groupByDate(shifts: Shift[]) {
  const groups = new Map<string, Shift[]>();
  shifts.forEach((s) => groups.set(s.date, [...(groups.get(s.date) ?? []), s]));
  return [...groups.entries()];
}

/** Opens an employee's own shift for editing, or explains why it can't be edited. */
export function editOwnShift(sh: Shift, edit: (s: Shift) => void) {
  if (!sh.end) return toast.info("این شیفت هنوز در جریانه");
  if (!sh.editable) return toast.info(sh.status === "approved" ? "مدیر این شیفت رو تایید کرده و قفله 🔒" : "مهلت ویرایش این شیفت تموم شده");
  edit(sh);
}

export default function MyShifts() {
  const { data: me } = useMe();
  const [offset, setOffset] = useState(0);
  const summary = useSummary("month", offset);
  const p = summary.data?.period;
  const shifts = useShifts(p ? { from: p.start.slice(0, 10), to: isoDay(addDays(parseDay(p.end.slice(0, 10)), -1)), limit: 1000 } : {}, !!p);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [open, setOpen] = useState(false);

  if (!me || !summary.data) return <Loading />;
  const cal = me.settings.calendar;
  const s = summary.data;

  return (
    <div className="rise">
      <PeriodNav label={periodLabel(cal, s.period)} offset={offset} setOffset={setOffset} />
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Stat label="تایید شده" value={hm(s.minutes)} hint="ساعت" />
        <Stat label="در انتظار" value={hm(s.pendingMinutes)} hint="ساعت" accent={s.pendingMinutes ? "var(--amber)" : undefined} />
        <Stat label="درآمد" value={money(s.pay)} hint={me.settings.currency} accent="var(--mint)" />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {shifts.isLoading ? (
          <Loading />
        ) : shifts.data?.length ? (
          groupByDate(shifts.data).map(([date, list]) => (
            <div key={date}>
              <div className="mb-1.5 text-xs font-medium text-muted">{relativeDay(cal, date)}</div>
              <div className="flex flex-col gap-2">
                {list.map((sh) => (
                  <ShiftCard
                    key={sh.id}
                    shift={sh}
                    channels={me.channels}
                    showEditHint
                    onClick={() =>
                      editOwnShift(sh, (s) => {
                        setEditing(s);
                        setOpen(true);
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <Empty emoji="🗓️" title="این ماه شیفتی نداری" text="هر وقت کار کردی از دکمه پایین ساعت‌هات رو ثبت کن." />
        )}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
        className="btn btn-primary glow fixed bottom-24 left-[max(1rem,calc(50%-24rem+1rem))] z-20 h-14 w-14 rounded-2xl px-0"
        aria-label="ثبت ساعت"
      >
        <Plus size={24} />
      </button>
      <ShiftForm open={open} onOpenChange={setOpen} shift={editing} />
    </div>
  );
}
