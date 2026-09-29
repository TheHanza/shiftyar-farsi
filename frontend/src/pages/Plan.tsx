import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarCheck, Check, Plus, Trash2 } from "lucide-react";
import { planApi, useAction, useMe, usePlan, usePlans, useTeammates, useUsers } from "@/lib/queries";
import { WEEKDAYS, duration, fa, hmToMin, isoDay, minToHM, relativeDay } from "@/lib/format";
import { Avatar, Empty, Loading, SectionTitle, Segmented, Sheet, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Channel, Plan, PlanItem, UserBrief } from "@/lib/types";

const planKeys = ["plan", "plans"];

/** Open cover requests the viewer could take. */
export function requestsFor(items: PlanItem[], meId: number) {
  return items.filter((i) => i.request?.status === "open" && i.owner.id !== meId && (!i.request.target || i.request.target.id === meId));
}

function ChannelTag({ id, channels }: { id: number | null; channels: Channel[] }) {
  const ch = channels.find((c) => c.id === id);
  if (!ch) return null;
  return (
    <span className="flex items-center gap-1">
      <i className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
      {ch.name}
    </span>
  );
}

function RequestBadge({ item, meId, admin }: { item: PlanItem; meId: number; admin: boolean }) {
  const r = item.request;
  if (!r) return null;
  if (r.status === "covered") return <span className="chip bg-mint-soft text-mint">جای {item.owner.name}</span>;
  if (r.status === "open")
    return <span className="chip bg-amber-soft text-amber">{r.target ? `از ${r.target.name} خواسته` : "دنبال جایگزین"}</span>;
  if (r.status === "declined" && (admin || item.owner.id === meId))
    return <span className="chip bg-danger-soft text-danger">{r.target?.name} نتونست</span>;
  return null;
}

function PlanRow({ item, channels, meId, admin, onClick }: { item: PlanItem; channels: Channel[]; meId: number; admin: boolean; onClick: () => void }) {
  const mine = item.assignee.id === meId;
  return (
    <button onClick={onClick} className={cn("card flex w-full items-center gap-3 p-3 text-right transition hover:border-neutral-500", mine && "border-primary/50")}>
      <Avatar user={item.assignee} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {item.assignee.name}
            {mine && <span className="text-xs text-primary"> (تو)</span>}
          </span>
          <span className="ltr text-sm font-bold text-muted">
            {fa(item.startTime)} → {fa(item.endTime)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{duration(item.minutes)}</span>
          <ChannelTag id={item.channelId} channels={channels} />
          <RequestBadge item={item} meId={meId} admin={admin} />
          {item.logged && (
            <span className="flex items-center gap-0.5 text-mint">
              <Check size={12} /> ثبت شد
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function PersonPicker({ people, value, onChange, anyone }: { people: UserBrief[]; value: number; onChange: (id: number) => void; anyone?: string }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(+e.target.value)}>
      {anyone ? <option value={0}>{anyone}</option> : <option value={0} disabled>انتخاب کن…</option>}
      {people.map((u) => (
        <option key={u.id} value={u.id}>
          {u.avatar} {u.name}
        </option>
      ))}
    </select>
  );
}

/** What the viewer can do with one planned shift: ask for cover, take it, back out, or (admin) reassign. */
function ItemSheet({ item, onOpenChange }: { item: PlanItem | null; onOpenChange: (o: boolean) => void }) {
  const { data: me } = useMe();
  const { data: team } = useTeammates();
  const [personId, setPersonId] = useState(0);
  const [note, setNote] = useState("");
  useEffect(() => {
    setPersonId(0);
    setNote("");
  }, [item]);

  const close = { onSuccess: () => onOpenChange(false), invalidate: planKeys };
  const ask = useAction(() => planApi.requestCover({ planId: item!.planId, date: item!.date, targetId: personId || null, note }), {
    ...close,
    success: "درخواست فرستاده شد 🙏",
  });
  const assign = useAction(
    async () => {
      if (item!.request && item!.request.status !== "declined") await planApi.cancel(item!.request.id);
      return planApi.requestCover({ planId: item!.planId, date: item!.date, coverId: personId });
    },
    { ...close, success: "جابه‌جا شد ✅" },
  );
  const accept = useAction(() => planApi.accept(item!.request!.id), { ...close, success: "مرسی که هوای تیم رو داری 💜" });
  const decline = useAction(() => planApi.decline(item!.request!.id), { ...close, success: "بهش خبر می‌دیم" });
  const cancel = useAction(() => planApi.cancel(item!.request!.id), { ...close, success: "لغو شد" });

  if (!me || !item) return null;
  const cal = me.settings.calendar;
  const meId = me.user.id;
  const admin = me.user.role === "admin";
  const r = item.request;
  const active = r && r.status !== "declined" ? r : null;
  const isOwner = item.owner.id === meId;
  const canTake = !isOwner && r?.status === "open" && (!r.target || r.target.id === meId);
  const others = (team ?? []).filter((u) => u.id !== item.owner.id);
  const busy = ask.isPending || assign.isPending || accept.isPending || decline.isPending || cancel.isPending;

  return (
    <Sheet open={!!item} onOpenChange={onOpenChange} title={`${relativeDay(cal, item.date)}، ${fa(item.startTime)} تا ${fa(item.endTime)}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm">
          <Avatar user={item.owner} size={36} />
          <div className="flex-1">
            <div>
              برنامه‌ی <b>{item.owner.name}</b>
            </div>
            {r?.status === "covered" && r.cover && <div className="text-xs text-mint">{r.cover.name} جاش وایمیسه</div>}
            {r?.status === "open" && (
              <div className="text-xs text-amber">
                {r.requester.id === meId ? "درخواست دادی" : `${r.requester.name} دنبال جایگزینه`}
                {r.target && `، از ${r.target.name}`}
              </div>
            )}
            {r?.status === "declined" && <div className="text-xs text-danger">{r.target?.name} نتونست قبول کنه</div>}
          </div>
        </div>
        {r?.note && <div className="rounded-xl bg-amber-soft px-3 py-2 text-xs text-amber">💬 {r.note}</div>}

        {canTake && (
          <div className="flex gap-2">
            <button className="btn btn-primary h-12 flex-1" disabled={busy} onClick={() => accept.mutate(undefined)}>
              <Check size={18} /> من وایمیسم
            </button>
            {r?.target?.id === meId && (
              <button className="btn h-12" disabled={busy} onClick={() => decline.mutate(undefined)}>
                نمی‌تونم
              </button>
            )}
          </div>
        )}

        {r?.status === "covered" && r.cover?.id === meId && !isOwner && (
          <button className="btn h-12" disabled={busy} onClick={() => cancel.mutate(undefined)}>
            دیگه نمی‌تونم؛ دوباره دنبال جایگزین بگرده
          </button>
        )}

        {isOwner && !active && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask.mutate(undefined);
            }}
          >
            <div className="text-sm font-semibold">نمی‌تونی بیای؟ از یکی بخواه جات وایسه</div>
            <PersonPicker people={others} value={personId} onChange={setPersonId} anyone="هر کسی از تیم که بتونه" />
            <textarea className="field h-auto min-h-16 py-2.5" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="یادداشت (اختیاری)" />
            <button className="btn btn-primary h-12" disabled={busy}>
              درخواست بفرست
            </button>
          </form>
        )}

        {(isOwner || admin) && active && (
          <button className="btn h-12" disabled={busy} onClick={() => cancel.mutate(undefined)}>
            {active.status === "covered" ? `لغو؛ خود ${item.owner.name} میاد` : "لغو درخواست"}
          </button>
        )}

        {admin && (
          <form
            className="flex flex-col gap-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              assign.mutate(undefined);
            }}
          >
            <div className="text-sm font-semibold">بده به یکی دیگه (مدیر)</div>
            <PersonPicker people={others} value={personId} onChange={setPersonId} />
            <button className="btn h-12" disabled={busy || !personId}>
              جابه‌جا کن
            </button>
          </form>
        )}
      </div>
    </Sheet>
  );
}

function PlanSheet({ plan, open, onOpenChange }: { plan: Plan | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: me } = useMe();
  const { data: users } = useUsers();
  const [userId, setUserId] = useState(0);
  const [start, setStart] = useState("21:00");
  const [end, setEnd] = useState("03:00");
  const [channelId, setChannelId] = useState<number | null>(null);
  const [days, setDays] = useState(0);
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!open) return;
    setUserId(plan?.userId ?? 0);
    setStart(minToHM(plan?.startMin ?? 21 * 60));
    setEnd(minToHM(plan?.endMin ?? 3 * 60));
    setChannelId(plan?.channelId ?? null);
    setDays(plan?.weekdays ?? 0);
    setActive(plan?.active ?? true);
  }, [open, plan]);

  const done = { invalidate: planKeys, onSuccess: () => onOpenChange(false) };
  const save = useAction(
    () => planApi.save(plan?.id ?? null, { userId, startMin: hmToMin(start), endMin: hmToMin(end), channelId, weekdays: days, active }),
    { ...done, success: "ذخیره شد" },
  );
  const del = useAction(() => planApi.remove(plan!.id), { ...done, success: "حذف شد" });
  const s = hmToMin(start);
  const e = hmToMin(end);
  const channels = (me?.channels ?? []).filter((c) => c.active || c.id === channelId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={plan ? "ویرایش برنامه" : "برنامه ثابت جدید"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          save.mutate(undefined);
        }}
      >
        <label>
          <span className="label">چه کسی؟</span>
          <select
            className="field"
            value={userId}
            onChange={(ev) => {
              setUserId(+ev.target.value);
              const u = users?.find((x) => x.id === +ev.target.value);
              if (!plan && u?.channelId) setChannelId(u.channelId);
            }}
            required
          >
            <option value={0} disabled>
              انتخاب کن…
            </option>
            {users
              ?.filter((u) => u.active || u.id === userId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.avatar} {u.name}
                </option>
              ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">از ساعت</span>
            <input type="time" className="field ltr text-center" value={start} onChange={(ev) => setStart(ev.target.value)} required />
          </label>
          <label>
            <span className="label">تا ساعت</span>
            <input type="time" className="field ltr text-center" value={end} onChange={(ev) => setEnd(ev.target.value)} required />
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted">
          {s === e ? "شروع و پایان نمی‌تونه یکی باشه" : `${duration(e > s ? e - s : 1440 - s + e)}${e <= s ? "، از نیمه‌شب رد می‌شه" : ""}`}
        </p>
        {channels.length > 0 && (
          <div>
            <span className="label">تیم</span>
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setChannelId(channelId === c.id ? null : c.id)}
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
        <div>
          <span className="label">روزهای هفته (هیچ‌کدام = هر روز)</span>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.bit}
                onClick={() => setDays(days ^ (1 << d.bit))}
                className={cn("h-10 flex-1 rounded-lg border text-sm", days & (1 << d.bit) ? "border-primary bg-primary-soft" : "border-border bg-background text-muted")}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <Switch checked={active} onChange={setActive} label="فعال" />
        <div className="flex gap-2">
          <button className="btn btn-primary h-12 flex-1" disabled={save.isPending || !userId || s === e}>
            ذخیره
          </button>
          {plan && (
            <button type="button" className="btn h-12" onClick={() => del.mutate(undefined)} aria-label="حذف">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function PlanAdmin() {
  const { data: me } = useMe();
  const { data: plans } = usePlans();
  const { data: users } = useUsers();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const describe = (p: Plan) => {
    const daysText = p.weekdays ? WEEKDAYS.filter((d) => p.weekdays & (1 << d.bit)).map((d) => d.label).join("، ") : "هر روز";
    return `${fa(minToHM(p.startMin))} تا ${fa(minToHM(p.endMin))}، ${daysText}`;
  };
  const edit = (p: Plan | null) => {
    setEditing(p);
    setOpen(true);
  };
  return (
    <>
      <SectionTitle
        action={
          <button className="btn h-8 px-3 text-xs" onClick={() => edit(null)}>
            <Plus size={14} /> افزودن
          </button>
        }
      >
        برنامه‌های ثابت
      </SectionTitle>
      <div className="card divide-y divide-border">
        {!plans ? (
          <Loading />
        ) : plans.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">مثلاً «سارا هر روز ۲۱ تا ۳». از «افزودن» شروع کن.</div>
        ) : (
          plans.map((p) => {
            const u = users?.find((x) => x.id === p.userId);
            return (
              <button key={p.id} className={cn("flex w-full items-center gap-3 p-3.5 text-right", !p.active && "opacity-50")} onClick={() => edit(p)}>
                {u && <Avatar user={u} size={36} />}
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{u?.name ?? "؟"}</span>
                  <span className="text-xs text-muted">{describe(p)}</span>
                </span>
                <span className="text-xs text-muted">
                  <ChannelTag id={p.channelId} channels={me.channels} />
                </span>
              </button>
            );
          })
        )}
      </div>
      <PlanSheet plan={editing} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Home-screen card: the viewer's next planned shift and requests waiting for them. */
export function NextPlanCard() {
  const { data: me } = useMe();
  const { data } = usePlan();
  if (!me || !data) return null;
  const now = new Date();
  const nowHM = minToHM(now.getHours() * 60 + now.getMinutes());
  const today = isoDay(now);
  const next = data.items.find((i) => i.assignee.id === me.user.id && !i.logged && (i.date > today || i.startTime >= nowHM));
  const asks = requestsFor(data.items, me.user.id);
  if (!next && !asks.length) return null;
  return (
    <Link to="/plan" className="card mt-3 flex items-center gap-3 p-3.5">
      <CalendarCheck size={20} className="shrink-0 text-primary" />
      <span className="flex-1 text-sm">
        {next && (
          <span className="block">
            شیفت بعدی: <b>{relativeDay(me.settings.calendar, next.date)}</b>{" "}
            <span className="ltr inline-block">
              {fa(next.startTime)} → {fa(next.endTime)}
            </span>
          </span>
        )}
        {asks.length > 0 && <span className="block text-xs text-amber">🙋 {fa(asks.length)} نفر دنبال جایگزین‌ان</span>}
      </span>
      <ArrowLeft size={16} className="text-muted" />
    </Link>
  );
}

export default function PlanPage() {
  const { data: me } = useMe();
  const { data } = usePlan();
  const admin = me?.user.role === "admin";
  const [filter, setFilter] = useState<"mine" | "all">(admin ? "all" : "mine");
  const [sel, setSel] = useState<PlanItem | null>(null);
  if (!me) return <Loading />;
  const meId = me.user.id;
  const cal = me.settings.calendar;
  const asks = data ? requestsFor(data.items, meId) : [];
  const shown = (data?.items ?? []).filter((i) => filter === "all" || i.assignee.id === meId || i.owner.id === meId);
  const byDate = new Map<string, PlanItem[]>();
  shown.forEach((i) => byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]));

  return (
    <div className="rise">
      <h1 className="text-xl font-black">برنامه 📅</h1>
      <p className="mt-1 text-sm text-muted">شیفت‌های ثابت دو هفته آینده. اگه یه روز نمی‌تونی، بزن روش و از یکی بخواه جات وایسه.</p>

      {asks.length > 0 && (
        <>
          <SectionTitle>دنبال جایگزین 🙋</SectionTitle>
          <div className="flex flex-col gap-2">
            {asks.map((i) => (
              <PlanRow key={`${i.planId}-${i.date}`} item={i} channels={me.channels} meId={meId} admin={admin} onClick={() => setSel(i)} />
            ))}
          </div>
        </>
      )}

      <div className="mt-5">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "mine", label: "شیفت‌های من" },
            { value: "all", label: "همه تیم" },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {!data ? (
          <Loading />
        ) : byDate.size === 0 ? (
          <Empty
            emoji="🗓️"
            title={filter === "mine" ? "برنامه‌ای برات ثبت نشده" : "هنوز برنامه‌ای ثبت نشده"}
            text={admin ? "از پایین صفحه برنامه‌ی ثابت هر نفر رو بساز." : "مدیر می‌تونه ساعت‌های ثابتت رو اینجا بذاره."}
          />
        ) : (
          [...byDate.entries()].map(([date, list]) => (
            <div key={date}>
              <div className="mb-1.5 text-xs font-medium text-muted">{relativeDay(cal, date)}</div>
              <div className="flex flex-col gap-2">
                {list.map((i) => (
                  <PlanRow key={i.planId} item={i} channels={me.channels} meId={meId} admin={admin} onClick={() => setSel(i)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {admin && <PlanAdmin />}
      <ItemSheet item={sel} onOpenChange={(o) => !o && setSel(null)} />
    </div>
  );
}
