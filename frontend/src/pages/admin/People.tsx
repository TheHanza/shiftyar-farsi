import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { adminApi, useAction, useMe, useUsers } from "@/lib/queries";
import { AVATARS, SWATCHES, fa, money, toLatinDigits } from "@/lib/format";
import { Avatar, Empty, Loading, Segmented, Sheet, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Role, User } from "@/lib/types";

const blank = { name: "", username: "", password: "", role: "employee" as Role, hourlyRate: "", weeklyGoalHours: "", monthlyGoalHours: "", avatar: "🙂", color: "#a855f7", channelId: 0, active: true };

function UserSheet({ user, open, onOpenChange }: { user: User | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: me } = useMe();
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      user
        ? {
            name: user.name,
            username: user.username,
            password: "",
            role: user.role,
            hourlyRate: String(user.hourlyRate || ""),
            weeklyGoalHours: String(user.weeklyGoalHours || ""),
            monthlyGoalHours: String(user.monthlyGoalHours || ""),
            avatar: user.avatar,
            color: user.color,
            channelId: user.channelId ?? 0,
            active: user.active,
          }
        : blank,
    );
  }, [open, user]);

  const n = (s: string) => Number(toLatinDigits(s).replace(/[^\d]/g, "")) || 0;
  const save = useAction(
    () =>
      adminApi.saveUser(user?.id ?? null, {
        ...f,
        username: toLatinDigits(f.username),
        password: f.password || undefined,
        hourlyRate: n(f.hourlyRate),
        weeklyGoalHours: n(f.weeklyGoalHours),
        monthlyGoalHours: n(f.monthlyGoalHours),
      }),
    { success: user ? "ذخیره شد" : "عضو جدید اضافه شد 🎉", invalidate: ["users", "report", "me", "leaderboard"], onSuccess: () => onOpenChange(false) },
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={user ? "ویرایش عضو" : "عضو جدید"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => set("avatar", a)}
              className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl", f.avatar === a ? "bg-primary-soft ring-2 ring-primary" : "bg-background")}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => set("color", c)}
              className={cn("h-8 w-8 rounded-full", f.color === c && "ring-2 ring-white ring-offset-2 ring-offset-popover")}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
        <label>
          <span className="label">نام</span>
          <input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">نام کاربری (انگلیسی)</span>
            <input className="field ltr text-left" autoCapitalize="none" value={f.username} onChange={(e) => set("username", e.target.value)} required />
          </label>
          <label>
            <span className="label">{user ? "رمز جدید (اختیاری)" : "رمز عبور"}</span>
            <input className="field ltr text-left" type="text" minLength={8} value={f.password} onChange={(e) => set("password", e.target.value)} required={!user} placeholder="۸+ کاراکتر" />
          </label>
        </div>
        <div>
          <span className="label">نقش</span>
          <Segmented
            value={f.role}
            onChange={(v) => set("role", v)}
            options={[
              { value: "employee", label: "پشتیبان" },
              { value: "admin", label: "مدیر" },
            ]}
          />
        </div>
        <label>
          <span className="label">نرخ ساعتی ({me?.settings.currency})</span>
          <input className="field ltr text-left" inputMode="numeric" value={f.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} placeholder="0" />
          {n(f.hourlyRate) > 0 && <span className="mt-1 block text-xs text-muted">{money(n(f.hourlyRate))} {me?.settings.currency} در ساعت</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">هدف هفتگی (ساعت)</span>
            <input className="field ltr text-left" inputMode="numeric" value={f.weeklyGoalHours} onChange={(e) => set("weeklyGoalHours", e.target.value)} placeholder="0" />
          </label>
          <label>
            <span className="label">هدف ماهانه (ساعت)</span>
            <input className="field ltr text-left" inputMode="numeric" value={f.monthlyGoalHours} onChange={(e) => set("monthlyGoalHours", e.target.value)} placeholder="0" />
          </label>
        </div>
        {me && me.channels.length > 0 && (
          <label>
            <span className="label">تیم پیش‌فرض</span>
            <select className="field" value={f.channelId} onChange={(e) => set("channelId", +e.target.value)}>
              <option value={0}>—</option>
              {me.channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {user && <Switch checked={f.active} onChange={(v) => set("active", v)} label="فعال" hint="اعضای غیرفعال نمی‌توانند وارد شوند" />}
        <button className="btn btn-primary h-12 text-base" disabled={save.isPending}>
          {user ? "ذخیره" : "اضافه کن"}
        </button>
      </form>
    </Sheet>
  );
}

export default function People() {
  const { data: me } = useMe();
  const { data: users } = useUsers();
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  if (!me || !users) return <Loading />;

  return (
    <div className="rise">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">افراد تیم</h1>
          <p className="text-sm text-muted">{fa(users.filter((u) => u.active).length)} عضو فعال</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <UserPlus size={18} /> عضو جدید
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {users.length === 0 && <Empty emoji="👋" title="هنوز کسی نیست" />}
        {users.map((u) => (
          <button
            key={u.id}
            className={cn("card flex items-center gap-3 p-3 text-right transition hover:border-neutral-500", !u.active && "opacity-50")}
            onClick={() => {
              setEditing(u);
              setOpen(true);
            }}
          >
            <Avatar user={u} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{u.name}</span>
                {u.role === "admin" && <span className="chip bg-primary-soft text-purple-light">مدیر</span>}
                {!u.active && <span className="chip bg-white/5 text-muted">غیرفعال</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                <span className="ltr">@{u.username}</span>
                {u.hourlyRate > 0 && <span>{money(u.hourlyRate)} / ساعت</span>}
                {(u.weeklyGoalHours > 0 || u.monthlyGoalHours > 0) && (
                  <span>
                    🎯 {fa(u.weeklyGoalHours)} / {fa(u.monthlyGoalHours)}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <UserSheet user={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}
