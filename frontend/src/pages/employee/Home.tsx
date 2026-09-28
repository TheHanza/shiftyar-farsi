import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { Flame, Moon, Plus, Wallet } from "lucide-react";
import { useMe, useShifts, useSummary } from "@/lib/queries";
import { duration, fa, greeting, hm, money, periodLabel, relativeDay } from "@/lib/format";
import { GoalRing, DayBars } from "@/components/charts";
import ClockCard from "@/components/ClockCard";
import ShiftForm from "@/components/ShiftForm";
import ShiftCard from "@/components/ShiftCard";
import { Loading, SectionTitle } from "@/components/ui";
import type { Summary } from "@/lib/types";

/** Fires confetti once per period when a goal is reached. */
function useGoalCelebration(s?: Summary) {
  useEffect(() => {
    if (!s || !s.goalMinutes) return;
    if (s.minutes + s.pendingMinutes < s.goalMinutes) return;
    const key = `goal-${s.user.id}-${s.period.kind}-${s.period.start}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.3 }, colors: ["#a855f7", "#2ee6b6", "#c084fc", "#fbbf24"] });
  }, [s]);
}

export default function EmployeeHome() {
  const { data: me } = useMe();
  const week = useSummary("week");
  const month = useSummary("month");
  const recent = useShifts({ limit: 3 });
  const [formOpen, setFormOpen] = useState(false);
  useGoalCelebration(week.data);
  useGoalCelebration(month.data);

  if (!me || !week.data || !month.data) return <Loading />;
  const cal = me.settings.calendar;
  const w = week.data;
  const m = month.data;
  const currency = me.settings.currency;
  const weekTotal = w.minutes + w.pendingMinutes;
  const remaining = w.goalMinutes - weekTotal;

  return (
    <div className="rise flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-black">
          {greeting()}، {me.user.name} {me.user.avatar}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {w.goalMinutes > 0
            ? remaining > 0
              ? `تا هدف این هفته ${duration(remaining)} مونده. تو می‌تونی!`
              : "هدف این هفته رو زدی! 🔥 ایول"
            : "امروز هم بترکون 💜"}
        </p>
      </div>

      <ClockCard />

      <div className="card hero-gradient mt-3 flex items-center justify-around p-4">
        <GoalRing value={weekTotal} goal={w.goalMinutes} label="هدف هفته" />
        <div className="h-16 w-px bg-border" />
        <GoalRing value={m.minutes + m.pendingMinutes} goal={m.goalMinutes} label="هدف ماه" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <div className="card p-3">
          <Wallet size={16} className="text-mint" />
          <div className="mt-2 text-[0.7rem] text-muted">درآمد این ماه</div>
          <div className="mt-0.5 text-sm font-bold">{money(m.estimatedPay)}</div>
          <div className="text-[0.6rem] text-subtle">{currency}{m.pendingMinutes > 0 && "، تخمینی"}</div>
        </div>
        <div className="card p-3">
          <Moon size={16} className="text-purple-light" />
          <div className="mt-2 text-[0.7rem] text-muted">ساعت ضریب‌دار</div>
          <div className="mt-0.5 text-sm font-bold">{hm(m.bonusMinutes)}</div>
          <div className="text-[0.6rem] text-subtle">این ماه</div>
        </div>
        <div className="card p-3">
          <Flame size={16} className="text-amber" />
          <div className="mt-2 text-[0.7rem] text-muted">روزهای پشت‌سرهم</div>
          <div className="mt-0.5 text-sm font-bold">{fa(w.streak ?? 0)} روز</div>
          <div className="text-[0.6rem] text-subtle">{(w.streak ?? 0) >= 3 ? "داغ داغی! 🔥" : "ادامه بده"}</div>
        </div>
      </div>

      {m.pendingMinutes > 0 && (
        <div className="mt-3 rounded-xl bg-amber-soft px-3.5 py-2.5 text-xs text-amber">
          ⏳ {duration(m.pendingMinutes)} از ساعت‌هات منتظر تایید مدیره.
        </div>
      )}

      <SectionTitle action={<span className="text-xs text-muted">{periodLabel(cal, w.period)}</span>}>این هفته</SectionTitle>
      <div className="card p-4">
        <DayBars days={w.days ?? []} calendar={cal} />
      </div>

      <SectionTitle
        action={
          <Link to="/shifts" className="text-xs text-primary">
            همه ←
          </Link>
        }
      >
        آخرین شیفت‌ها
      </SectionTitle>
      <div className="flex flex-col gap-2">
        {recent.data?.length ? (
          recent.data.map((s) => (
            <div key={s.id}>
              <div className="mb-1 text-[0.7rem] text-subtle">{relativeDay(cal, s.date)}</div>
              <ShiftCard shift={s} channels={me.channels} />
            </div>
          ))
        ) : (
          <div className="card p-6 text-center text-sm text-muted">هنوز شیفتی ثبت نکردی. اولین‌شو ثبت کن! ✌️</div>
        )}
      </div>

      <button
        onClick={() => setFormOpen(true)}
        className="btn btn-primary glow fixed bottom-24 left-[max(1rem,calc(50%-24rem+1rem))] z-20 h-14 rounded-2xl px-5 text-base"
      >
        <Plus size={20} /> ثبت ساعت
      </button>
      <ShiftForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
