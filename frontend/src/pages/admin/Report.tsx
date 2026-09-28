import { useState } from "react";
import { Download, Moon, Trash2 } from "lucide-react";
import { download } from "@/lib/api";
import { adminApi, useAction, useAdjustments, useMe, useReport, useSummary } from "@/lib/queries";
import { fa, hm, money, periodLabel, toLatinDigits } from "@/lib/format";
import { DayBars, GoalRing } from "@/components/charts";
import { Avatar, Empty, Loading, PeriodNav, Segmented, Sheet } from "@/components/ui";
import { toast } from "@/stores/toast";
import type { PeriodKind, Summary } from "@/lib/types";

function PersonSheet({ row, period, offset, onClose }: { row: Summary | null; period: PeriodKind; offset: number; onClose: () => void }) {
  const { data: me } = useMe();
  const detail = useSummary(period, offset, row?.user.id);
  const p = row?.period;
  const adjustments = useAdjustments(period === "month" && p ? p.year : 0, p?.month ?? 0, row?.user.id);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [sign, setSign] = useState<"+" | "-">("+");
  const add = useAction(
    () =>
      adminApi.addAdjustment({ userId: row!.user.id, year: p!.year, month: p!.month, amount: (sign === "-" ? -1 : 1) * Number(toLatinDigits(amount).replace(/[^\d]/g, "")), reason }),
    {
      success: "ثبت شد",
      invalidate: ["adjustments", "report", "summary"],
      onSuccess: () => {
        setAmount("");
        setReason("");
      },
    },
  );
  const del = useAction((id: number) => adminApi.deleteAdjustment(id), { invalidate: ["adjustments", "report", "summary"] });
  if (!me) return null;
  const d = detail.data;
  const cur = me.settings.currency;

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()} title={row ? `${row.user.avatar} ${row.user.name}` : ""}>
      {detail.isError ? (
        <div className="py-10 text-center text-sm text-danger">{(detail.error as Error).message}</div>
      ) : !d ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-around rounded-2xl bg-background p-3">
            <GoalRing value={d.minutes + d.pendingMinutes} goal={d.goalMinutes} label="هدف" size={84} />
            <div className="flex flex-col gap-1 text-sm">
              <span>
                <span className="text-muted">تایید شده: </span>
                <b>{hm(d.minutes)}</b>
              </span>
              <span>
                <span className="text-muted">با ضریب: </span>
                <b>{hm(d.weightedMinutes)}</b>
              </span>
              <span>
                <span className="text-muted">در انتظار: </span>
                <b className={d.pendingMinutes ? "text-amber" : ""}>{hm(d.pendingMinutes)}</b>
              </span>
            </div>
          </div>
          <DayBars days={d.days ?? []} calendar={me.settings.calendar} />

          <div className="rounded-2xl bg-background p-3.5 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted">
                {hm(d.weightedMinutes)} × {money(d.hourlyRate)}
              </span>
              <span>{money(d.basePay)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">پاداش / کسر</span>
              <span className={d.adjustments < 0 ? "text-danger" : d.adjustments > 0 ? "text-mint" : ""}>{money(d.adjustments)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-bold">
              <span>قابل پرداخت</span>
              <span className="text-mint">
                {money(d.pay)} {cur}
              </span>
            </div>
          </div>

          {period === "month" && (
            <div>
              <div className="label">پاداش و کسورات این ماه</div>
              <div className="flex flex-col gap-1.5">
                {adjustments.data?.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 text-sm">
                    <span className={a.amount < 0 ? "text-danger" : "text-mint"}>
                      {a.amount > 0 && "+"}
                      {money(a.amount)}
                    </span>
                    <span className="flex-1 truncate text-muted">{a.reason}</span>
                    <button className="p-1 text-subtle hover:text-danger" onClick={() => del.mutate(a.id)} aria-label="حذف">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <form
                className="mt-2 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  add.mutate(undefined);
                }}
              >
                <div className="flex gap-2">
                  <Segmented value={sign} onChange={setSign} options={[{ value: "+", label: "پاداش" }, { value: "-", label: "کسر" }]} className="w-40" />
                  <input className="field ltr flex-1 text-left" inputMode="numeric" placeholder={`مبلغ (${cur})`} value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <input className="field" placeholder="بابت…" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="btn" disabled={add.isPending || !amount}>
                  افزودن
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default function Report() {
  const { data: me } = useMe();
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<Summary | null>(null);
  const { data } = useReport(period, offset);
  if (!me || !data) return <Loading />;
  const cal = me.settings.calendar;
  const totals = data.rows.reduce(
    (t, r) => ({ minutes: t.minutes + r.minutes, pending: t.pending + r.pendingMinutes, pay: t.pay + r.pay, bonus: t.bonus + r.bonusMinutes }),
    { minutes: 0, pending: 0, pay: 0, bonus: 0 },
  );

  return (
    <div className="rise">
      <div className="flex items-center gap-2">
        <Segmented
          className="flex-1"
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setOffset(0);
          }}
          options={[
            { value: "week", label: "هفتگی" },
            { value: "month", label: "ماهانه" },
          ]}
        />
        <button
          className="btn h-11"
          onClick={() => download(`/admin/report.csv?period=${period}&offset=${offset}`, `report-${period}-${data.period.start.slice(0, 10)}.csv`).catch((e) => toast.error(e.message))}
        >
          <Download size={17} /> اکسل
        </button>
      </div>
      <div className="mt-3">
        <PeriodNav label={periodLabel(cal, data.period)} offset={offset} setOffset={setOffset} />
      </div>

      <div className="card hero-gradient mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-border p-4 text-center">
        <div>
          <div className="text-[0.7rem] text-muted">ساعت تایید شده</div>
          <div className="mt-1 font-black">{hm(totals.minutes)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-muted">در انتظار</div>
          <div className="mt-1 font-black text-amber">{hm(totals.pending)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-muted">جمع پرداختی</div>
          <div className="mt-1 font-black text-mint">{money(totals.pay)}</div>
        </div>
      </div>
      {totals.pending > 0 && <p className="mt-2 text-xs text-muted">ساعت‌های در انتظار تا تایید نشن توی حقوق حساب نمی‌شن.</p>}

      <div className="mt-4 flex flex-col gap-2">
        {data.rows.length === 0 && <Empty emoji="📭" title="گزارشی برای این بازه نیست" />}
        {data.rows.map((r) => {
          const pct = r.goalMinutes ? Math.min(1, (r.minutes + r.pendingMinutes) / r.goalMinutes) : 0;
          return (
            <button key={r.user.id} className="card w-full p-3.5 text-right transition hover:border-neutral-500" onClick={() => setOpen(r)}>
              <div className="flex items-center gap-3">
                <Avatar user={r.user} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold">{r.user.name}</span>
                    <span className="font-bold text-mint">{money(r.pay)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>⏱️ {hm(r.minutes)}</span>
                    {r.bonusMinutes > 0 && (
                      <span className="flex items-center gap-1">
                        <Moon size={11} /> {hm(r.bonusMinutes)}
                      </span>
                    )}
                    {r.pendingMinutes > 0 && <span className="text-amber">⏳ {hm(r.pendingMinutes)}</span>}
                    {r.adjustments !== 0 && <span className={r.adjustments > 0 ? "text-mint" : "text-danger"}>{r.adjustments > 0 ? "🎁" : "➖"} {money(Math.abs(r.adjustments))}</span>}
                  </div>
                </div>
              </div>
              {r.goalMinutes > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: pct >= 1 ? "var(--mint)" : "var(--primary)" }} />
                  </div>
                  <span className="text-[0.65rem] text-subtle">
                    {fa(Math.round(pct * 100))}٪ از {fa(r.goalMinutes / 60)} ساعت
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <PersonSheet row={open} period={period} offset={offset} onClose={() => setOpen(null)} />
    </div>
  );
}
