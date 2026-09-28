import { Link } from "react-router-dom";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { useLive, useMe, useReport } from "@/lib/queries";
import { fa, greeting, hm, money, periodLabel } from "@/lib/format";
import { Avatar, Loading, SectionTitle } from "@/components/ui";
import { CoverageCard } from "../Team";

function since(iso: string) {
  return hm((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function AdminHome() {
  const { data: me } = useMe();
  const { data: live } = useLive();
  const week = useReport("week", 0);
  const month = useReport("month", 0);
  if (!me || !live || !week.data || !month.data) return <Loading />;

  const sum = (rows: typeof week.data.rows, f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const weekMinutes = sum(week.data.rows, (r) => r.minutes + r.pendingMinutes);
  const monthPay = sum(month.data.rows, (r) => r.estimatedPay);
  // Compare with where each person "should" be by now in the week, with some slack.
  const weekStart = new Date(week.data.period.start).getTime();
  const elapsed = Math.min(1, Math.max(0, (Date.now() - weekStart) / (7 * 86400000)));
  const behind = week.data.rows.filter((r) => r.goalMinutes > 0 && r.minutes + r.pendingMinutes < r.goalMinutes * elapsed * 0.7);

  return (
    <div className="rise">
      <h1 className="text-2xl font-black">
        {greeting()}، {me.user.name} {me.user.avatar}
      </h1>
      <p className="mt-1 text-sm text-muted">یه نگاه سریع به وضعیت تیم.</p>

      {live.pendingCount > 0 ? (
        <Link to="/shifts" className="card mt-4 flex items-center gap-3 border-amber/40 bg-amber-soft p-4">
          <span className="text-2xl">⏳</span>
          <span className="flex-1">
            <span className="block font-bold text-amber">{fa(live.pendingCount)} شیفت منتظر تایید</span>
            <span className="text-xs text-muted">بزن تا بررسی کنی</span>
          </span>
          <ArrowLeft size={18} className="text-amber" />
        </Link>
      ) : (
        <div className="card mt-4 flex items-center gap-3 p-4 text-sm text-muted">
          <CheckCheck size={20} className="text-mint" /> همه شیفت‌ها بررسی شده‌اند.
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="card hero-gradient p-4">
          <div className="text-xs text-muted">ساعت تیم این هفته</div>
          <div className="mt-1 text-2xl font-black">{hm(weekMinutes)}</div>
          <div className="text-[0.7rem] text-subtle">{periodLabel(me.settings.calendar, week.data.period)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">حقوق تخمینی ماه</div>
          <div className="mt-1 text-xl font-black text-mint">{money(monthPay)}</div>
          <div className="text-[0.7rem] text-subtle">
            {me.settings.currency}، {periodLabel(me.settings.calendar, month.data.period)}
          </div>
        </div>
      </div>

      <SectionTitle action={<span className="chip bg-mint-soft text-mint">{fa(live.online.length)} نفر</span>}>الان سر کار</SectionTitle>
      <div className="card p-2">
        {live.online.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">فعلاً کسی شیفت فعال نداره 😴</div>
        ) : (
          live.online.map((o) => {
            const ch = me.channels.find((c) => c.id === o.channelId);
            return (
              <div key={o.shiftId} className="flex items-center gap-3 rounded-xl p-2">
                <Avatar user={o.user} size={38} online />
                <span className="flex-1 text-sm font-medium">{o.user.name}</span>
                {ch && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <i className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
                    {ch.name}
                  </span>
                )}
                <span className="text-xs text-mint">{since(o.start)}</span>
              </div>
            );
          })
        )}
      </div>

      <SectionTitle>پوشش شیفت‌ها</SectionTitle>
      <CoverageCard />

      {behind.length > 0 && (
        <>
          <SectionTitle>عقب از هدف هفته</SectionTitle>
          <div className="card divide-y divide-border">
            {behind.map((r) => (
              <div key={r.user.id} className="flex items-center gap-3 p-3">
                <Avatar user={r.user} size={34} />
                <span className="flex-1 text-sm">{r.user.name}</span>
                <span className="text-xs text-muted">
                  {hm(r.minutes + r.pendingMinutes)} از {fa(r.goalMinutes / 60)} ساعت
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
