import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCoverage, useLeaderboard, useMe } from "@/lib/queries";
import { addDays, fa, hm, isoDay, parseDay, relativeDay } from "@/lib/format";
import { CoverageTimeline } from "@/components/charts";
import { Avatar, Empty, Loading, Segmented, SectionTitle } from "@/components/ui";
import type { PeriodKind } from "@/lib/types";
import { cn } from "@/lib/cn";

export function CoverageCard() {
  const { data: me } = useMe();
  const [date, setDate] = useState(isoDay(new Date()));
  const { data } = useCoverage(date);
  if (!me) return null;
  const isToday = date === isoDay(new Date());
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button className="btn btn-ghost h-8 w-8 px-0" onClick={() => setDate(isoDay(addDays(parseDay(date), -1)))} aria-label="روز قبل">
          <ChevronRight size={18} />
        </button>
        <span className="text-sm font-semibold">{relativeDay(me.settings.calendar, date)}</span>
        <button className="btn btn-ghost h-8 w-8 px-0" disabled={isToday} onClick={() => setDate(isoDay(addDays(parseDay(date), 1)))} aria-label="روز بعد">
          <ChevronLeft size={18} />
        </button>
      </div>
      {!data ? (
        <Loading />
      ) : data.items.length ? (
        <CoverageTimeline items={data.items} channels={me.channels} date={date} />
      ) : (
        <Empty emoji="🌙" title="کسی این روز شیفت نبوده" />
      )}
    </div>
  );
}

const medals = ["🥇", "🥈", "🥉"];

export default function Team() {
  const { data: me } = useMe();
  const [period, setPeriod] = useState<PeriodKind>("week");
  const board = useLeaderboard(period);
  if (!me) return <Loading />;
  const max = Math.max(1, ...(board.data ?? []).map((r) => r.minutes));

  return (
    <div className="rise">
      <h1 className="text-xl font-black">تیم 👥</h1>
      <p className="mt-1 text-sm text-muted">ببین کی کی سر کار بوده و کجاها خالیه.</p>

      <SectionTitle>پوشش شیفت‌ها</SectionTitle>
      <CoverageCard />

      {(me.settings.showLeaderboard || me.user.role === "admin") && (
        <>
          <SectionTitle
            action={
              <Segmented
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "week", label: "هفته" },
                  { value: "month", label: "ماه" },
                ]}
                className="w-36"
              />
            }
          >
            جدول پرتلاش‌ها
          </SectionTitle>
          <div className="card divide-y divide-border">
            {!board.data ? (
              <Loading />
            ) : board.data.length === 0 ? (
              <Empty emoji="🏁" title="هنوز کسی ثبت نکرده" />
            ) : (
              board.data.map((r, i) => (
                <div key={r.user.id} className={cn("flex items-center gap-3 px-3.5 py-3", r.user.id === me.user.id && "bg-primary-soft")}>
                  <span className="w-6 text-center text-lg">{medals[i] ?? <span className="text-sm text-subtle">{fa(i + 1)}</span>}</span>
                  <Avatar user={r.user} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">
                        {r.user.name}
                        {r.user.id === me.user.id && <span className="text-xs text-primary"> (تو)</span>}
                      </span>
                      <span className="font-bold">{hm(r.minutes)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(r.minutes / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
