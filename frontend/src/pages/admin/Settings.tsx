import { useEffect, useRef, useState } from "react";
import { ImageUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { BrandLogo, prepareLogo } from "@/components/BrandLogo";
import { toast } from "@/stores/toast";
import { adminApi, useAction, useMe, useRules } from "@/lib/queries";
import { SWATCHES, WEEKDAYS, fa, hmToMin, minToHM, num } from "@/lib/format";
import { Loading, SectionTitle, Segmented, Sheet, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Channel, RateRule, Settings } from "@/lib/types";

function RuleSheet({ rule, open, onOpenChange }: { rule: RateRule | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("06:00");
  const [percent, setPercent] = useState("10");
  const [days, setDays] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? "");
    setStart(minToHM(rule?.startMin ?? 0));
    setEnd(minToHM(rule?.endMin ?? 360));
    setPercent(String(Math.round(((rule?.multiplier ?? 1.1) - 1) * 100)));
    setDays(rule?.weekdays ?? 0);
    setActive(rule?.active ?? true);
  }, [open, rule]);

  const invalidate = ["rules", "me", "report", "summary", "shifts"];
  const save = useAction(
    () =>
      adminApi.saveRule(rule?.id ?? null, {
        name,
        startMin: hmToMin(start),
        endMin: hmToMin(end),
        multiplier: 1 + Number(percent) / 100,
        weekdays: days,
        active,
      }),
    { success: "ذخیره شد", invalidate, onSuccess: () => onOpenChange(false) },
  );
  const del = useAction(() => adminApi.deleteRule(rule!.id), { success: "حذف شد", invalidate, onSuccess: () => onOpenChange(false) });
  const allDay = hmToMin(start) === hmToMin(end);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={rule ? "ویرایش ضریب" : "ضریب جدید"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <label>
          <span className="label">نام</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: شیفت شب" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">از ساعت</span>
            <input type="time" className="field ltr text-center" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            <span className="label">تا ساعت</span>
            <input type="time" className="field ltr text-center" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted">{allDay ? "شروع و پایان یکسان = کل روز" : "اگر پایان قبل از شروع باشد، از نیمه‌شب رد می‌شود."}</p>
        <label>
          <span className="label">درصد اضافه</span>
          <div className="relative">
            <input className="field ltr pl-8 text-left" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} required />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">%</span>
          </div>
        </label>
        <div>
          <span className="label">روزهای هفته (هیچ‌کدام = همه روزها)</span>
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
          <button className="btn btn-primary h-12 flex-1" disabled={save.isPending}>
            ذخیره
          </button>
          {rule && (
            <button type="button" className="btn h-12" onClick={() => del.mutate(undefined)} aria-label="حذف">
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <p className="text-xs text-subtle">اگر چند ضریب هم‌زمان شامل یک دقیقه شوند، بیشترین ضریب اعمال می‌شود (جمع نمی‌شوند).</p>
      </form>
    </Sheet>
  );
}

function ChannelSheet({ channel, open, onOpenChange }: { channel: Channel | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!open) return;
    setName(channel?.name ?? "");
    setColor(channel?.color ?? SWATCHES[0]);
    setActive(channel?.active ?? true);
  }, [open, channel]);
  const save = useAction(() => adminApi.saveChannel(channel?.id ?? null, { name, color, active }), {
    success: "ذخیره شد",
    invalidate: ["me", "coverage"],
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={channel ? "ویرایش تیم" : "تیم جدید"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <label>
          <span className="label">نام تیم</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: اینستاگرام" required />
        </label>
        <div className="flex gap-2">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={cn("h-9 w-9 rounded-full", color === c && "ring-2 ring-white ring-offset-2 ring-offset-popover")}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
        {channel && <Switch checked={active} onChange={setActive} label="فعال" hint="تیم غیرفعال برای شیفت جدید نمایش داده نمی‌شود" />}
        <button className="btn btn-primary h-12" disabled={save.isPending}>
          ذخیره
        </button>
      </form>
    </Sheet>
  );
}

function LogoPicker({ version }: { version: number }) {
  const input = useRef<HTMLInputElement>(null);
  const invalidate = ["me", "branding"];
  const upload = useAction(
    async (file: File) => {
      const form = new FormData();
      form.append("logo", await prepareLogo(file), "logo.png");
      return api("/admin/logo", { method: "POST", body: form });
    },
    { success: "لوگو عوض شد ✨", invalidate },
  );
  const reset = useAction(() => api("/admin/logo", { method: "DELETE" }), { success: "لوگوی پیش‌فرض برگشت", invalidate });
  const busy = upload.isPending || reset.isPending;

  return (
    <div>
      <span className="label">لوگو</span>
      <div className="flex items-center gap-4">
        <BrandLogo version={version} className="h-16 w-16 shrink-0 rounded-2xl border border-border bg-background p-1" />
        <div className="flex flex-1 flex-wrap gap-2">
          <button type="button" className="btn h-9 px-3 text-xs" disabled={busy} onClick={() => input.current?.click()}>
            <ImageUp size={15} /> {version ? "تغییر لوگو" : "آپلود لوگو"}
          </button>
          {version > 0 && (
            <button type="button" className="btn btn-ghost h-9 px-3 text-xs" disabled={busy} onClick={() => reset.mutate(undefined)}>
              <RotateCcw size={14} /> پیش‌فرض
            </button>
          )}
          <p className="w-full text-[0.7rem] text-subtle">PNG، JPG یا WebP؛ مربعی بهتر است. خودکار به ۲۵۶ پیکسل کوچک می‌شود.</p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 15 * 1024 * 1024) return toast.error("فایل خیلی بزرگه");
          upload.mutate(file);
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: rules } = useRules();
  const [s, setS] = useState<Settings | null>(null);
  const [rule, setRule] = useState<RateRule | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);

  // Load once; afterwards only pick up the logo version so a logo upload
  // doesn't discard unsaved edits in the form.
  useEffect(() => {
    if (me) setS((prev) => (prev ? { ...prev, logoVersion: me.settings.logoVersion } : me.settings));
  }, [me]);

  const save = useAction((body: Settings) => adminApi.saveSettings(body), { success: "تنظیمات ذخیره شد ✅", invalidate: ["me", "summary", "report", "shifts"] });
  if (!me || !s) return <Loading />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const dirty = JSON.stringify(s) !== JSON.stringify(me.settings);
  const describe = (r: RateRule) => {
    const daysText = r.weekdays ? WEEKDAYS.filter((d) => r.weekdays & (1 << d.bit)).map((d) => d.label).join("، ") : "هر روز";
    const time = r.startMin === r.endMin ? "کل روز" : `${fa(minToHM(r.startMin))} تا ${fa(minToHM(r.endMin))}`;
    return `${time}، ${daysText}`;
  };

  return (
    <div className="rise">
      <h1 className="text-xl font-black">تنظیمات ⚙️</h1>

      <SectionTitle>عمومی</SectionTitle>
      <div className="card flex flex-col gap-4 p-4">
        <LogoPicker version={me.settings.logoVersion} />
        <label>
          <span className="label">نام مجموعه</span>
          <input className="field" value={s.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </label>
        <div>
          <span className="label">تقویم گزارش ماهانه</span>
          <Segmented
            value={s.calendar}
            onChange={(v) => set("calendar", v)}
            options={[
              { value: "gregorian", label: "میلادی" },
              { value: "jalali", label: "شمسی" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">واحد پول</span>
            <input className="field" value={s.currency} onChange={(e) => set("currency", e.target.value)} />
          </label>
          <label>
            <span className="label">منطقه زمانی</span>
            <input className="field ltr text-left" value={s.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">مهلت ویرایش کارمند (روز)</span>
            <input className="field ltr text-left" inputMode="numeric" value={s.editWindowDays} onChange={(e) => set("editWindowDays", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </label>
          <label>
            <span className="label">حداکثر طول شیفت (ساعت)</span>
            <input className="field ltr text-left" inputMode="numeric" value={s.maxShiftHours} onChange={(e) => set("maxShiftHours", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </label>
        </div>
        <div className="divide-y divide-border">
          <Switch checked={s.requireApproval} onChange={(v) => set("requireApproval", v)} label="شیفت‌ها نیاز به تایید مدیر دارند" hint="ساعت تایید نشده در حقوق حساب نمی‌شود" />
          <Switch
            checked={s.flagOverlaps}
            onChange={(v) => set("flagOverlaps", v)}
            label="شیفت‌های هم‌زمان نیاز به تایید دارند"
            hint="اگر دو نفر از یک تیم برای یک ساعت شیفت ثبت کنند، هر دو به صف تایید می‌روند"
          />
          <Switch checked={s.showLeaderboard} onChange={(v) => set("showLeaderboard", v)} label="نمایش جدول پرتلاش‌ها به کارمندان" hint="فقط ساعت‌ها نمایش داده می‌شود، نه حقوق" />
        </div>
        <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(s)}>
          ذخیره تنظیمات
        </button>
      </div>

      <SectionTitle
        action={
          <button
            className="btn h-8 px-3 text-xs"
            onClick={() => {
              setRule(null);
              setRuleOpen(true);
            }}
          >
            <Plus size={14} /> افزودن
          </button>
        }
      >
        ضریب ساعت‌ها
      </SectionTitle>
      <div className="card divide-y divide-border">
        {rules?.length === 0 && <div className="p-4 text-center text-sm text-muted">همه ساعت‌ها با نرخ عادی حساب می‌شوند.</div>}
        {rules?.map((r) => (
          <button
            key={r.id}
            className={cn("flex w-full items-center gap-3 p-3.5 text-right", !r.active && "opacity-50")}
            onClick={() => {
              setRule(r);
              setRuleOpen(true);
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-lg">🌙</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{r.name}</span>
              <span className="text-xs text-muted">{describe(r)}</span>
            </span>
            <span className="chip bg-mint-soft text-mint">+{num((r.multiplier - 1) * 100, 1)}٪</span>
          </button>
        ))}
      </div>

      <SectionTitle
        action={
          <button
            className="btn h-8 px-3 text-xs"
            onClick={() => {
              setChannel(null);
              setChannelOpen(true);
            }}
          >
            <Plus size={14} /> افزودن
          </button>
        }
      >
        تیم‌ها
      </SectionTitle>
      <div className="card divide-y divide-border">
        {me.channels.map((c) => (
          <button
            key={c.id}
            className={cn("flex w-full items-center gap-3 p-3.5 text-right", !c.active && "opacity-50")}
            onClick={() => {
              setChannel(c);
              setChannelOpen(true);
            }}
          >
            <i className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} />
            <span className="flex-1 text-sm">{c.name}</span>
            {!c.active && <span className="chip bg-white/5 text-muted">غیرفعال</span>}
          </button>
        ))}
      </div>

      <RuleSheet rule={rule} open={ruleOpen} onOpenChange={setRuleOpen} />
      <ChannelSheet channel={channel} open={channelOpen} onOpenChange={setChannelOpen} />
    </div>
  );
}
