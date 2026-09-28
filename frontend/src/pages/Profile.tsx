import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAction, useMe } from "@/lib/queries";
import { AVATARS, SWATCHES, fa, money } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { Avatar, Loading, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function Profile() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const setToken = useAuth((s) => s.setToken);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const save = useAction((body: object) => api("/me", { method: "PATCH", json: body }), { invalidate: ["me", "coverage", "leaderboard"] });
  const changePassword = useAction(() => api("/me", { method: "PATCH", json: { currentPassword: current, newPassword: next } }), {
    success: "رمزت عوض شد 🔐",
    invalidate: [],
    onSuccess: () => {
      setCurrent("");
      setNext("");
    },
  });

  if (!me) return <Loading />;
  const u = me.user;

  return (
    <div className="rise">
      <div className="card hero-gradient flex flex-col items-center p-6 text-center">
        <Avatar user={u} size={84} />
        <h1 className="mt-3 text-xl font-black">{u.name}</h1>
        <div className="ltr text-sm text-muted">@{u.username}</div>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          <span className="chip bg-primary-soft text-purple-light">{u.role === "admin" ? "مدیر" : "پشتیبان"}</span>
          {u.hourlyRate > 0 && (
            <span className="chip bg-mint-soft text-mint">
              {money(u.hourlyRate)} {me.settings.currency} / ساعت
            </span>
          )}
          {u.weeklyGoalHours > 0 && <span className="chip bg-white/5 text-muted">هدف هفته: {fa(u.weeklyGoalHours)} ساعت</span>}
          {u.monthlyGoalHours > 0 && <span className="chip bg-white/5 text-muted">هدف ماه: {fa(u.monthlyGoalHours)} ساعت</span>}
        </div>
      </div>

      <SectionTitle>آواتارت رو انتخاب کن</SectionTitle>
      <div className="card grid grid-cols-5 gap-2 p-3 sm:grid-cols-10">
        {AVATARS.map((a) => (
          <button
            key={a}
            onClick={() => save.mutate({ avatar: a })}
            className={cn("flex aspect-square items-center justify-center rounded-xl text-2xl transition", u.avatar === a ? "bg-primary-soft ring-2 ring-primary" : "bg-background hover:bg-white/5")}
          >
            {a}
          </button>
        ))}
      </div>

      <SectionTitle>رنگت</SectionTitle>
      <div className="card flex justify-between p-3">
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => save.mutate({ color: c })}
            className={cn("h-10 w-10 rounded-full transition", u.color === c && "ring-2 ring-white ring-offset-2 ring-offset-surface")}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>

      {me.channels.filter((c) => c.active).length > 1 && (
        <>
          <SectionTitle>تیم پیش‌فرض</SectionTitle>
          <div className="card flex flex-wrap gap-2 p-3">
            {me.channels
              .filter((c) => c.active)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => save.mutate({ channelId: c.id })}
                  className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm", u.channelId === c.id ? "text-foreground" : "border-border text-muted")}
                  style={u.channelId === c.id ? { borderColor: c.color, background: `${c.color}22` } : undefined}
                >
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
          </div>
        </>
      )}

      <SectionTitle>تغییر رمز</SectionTitle>
      <form
        className="card flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          changePassword.mutate(undefined);
        }}
      >
        <input className="field ltr text-left" type="password" placeholder="رمز فعلی" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <input className="field ltr text-left" type="password" placeholder="رمز جدید (حداقل ۸ کاراکتر)" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
        <button className="btn" disabled={changePassword.isPending}>
          <KeyRound size={16} /> عوض کن
        </button>
      </form>

      <button
        className="btn btn-ghost mt-6 w-full text-danger hover:text-red-400"
        onClick={() => {
          setToken(null);
          qc.clear();
        }}
      >
        <LogOut size={18} /> خروج از حساب
      </button>
    </div>
  );
}
