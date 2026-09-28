import type { Calendar, Period, RateRule } from "./types";

const faDigits = "۰۱۲۳۴۵۶۷۸۹";

export const fa = (v: number | string) => String(v).replace(/\d/g, (d) => faDigits[+d]);

/** Converts Persian/Arabic digits typed on a phone keyboard to ASCII. */
export const toLatinDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d))).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

export const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));

export const num = (n: number, digits = 1) =>
  new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(n);

/** 150 -> "۲ ساعت و ۳۰ دقیقه" */
export function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${fa(h)} ساعت و ${fa(r)} دقیقه`;
  if (h) return `${fa(h)} ساعت`;
  return `${fa(r)} دقیقه`;
}

/** 150 -> "۲:۳۰" */
export const hm = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return fa(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`);
};

export const hours = (minutes: number) => num(minutes / 60);

const locale = (cal: Calendar) => (cal === "jalali" ? "fa-IR-u-ca-persian-nu-arabext" : "fa-IR-u-ca-gregory-nu-arabext");

/** Parses "YYYY-MM-DD" at local noon so formatting never slips a day. */
export const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const fmtDate = (cal: Calendar, day: string | Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale(cal), opts).format(typeof day === "string" ? parseDay(day) : day);

export const dayLabel = (cal: Calendar, day: string) => fmtDate(cal, day, { weekday: "long", day: "numeric", month: "long" });
export const shortDay = (cal: Calendar, day: string) => fmtDate(cal, day, { day: "numeric", month: "short" });
export const weekdayShort = (cal: Calendar, day: string) => fmtDate(cal, day, { weekday: "short" });

export function relativeDay(cal: Calendar, day: string) {
  const today = isoDay(new Date());
  if (day === today) return "امروز";
  if (day === isoDay(addDays(new Date(), -1))) return "دیروز";
  return dayLabel(cal, day);
}

export function periodLabel(cal: Calendar, p: Period) {
  const start = p.start.slice(0, 10);
  if (p.kind === "month") {
    const mid = isoDay(addDays(parseDay(start), 10));
    return fmtDate(cal, mid, { month: "long", year: "numeric" });
  }
  const last = isoDay(addDays(parseDay(p.end.slice(0, 10)), -1));
  return `${shortDay(cal, start)} تا ${shortDay(cal, last)}`;
}

export const minToHM = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const hmToMin = (s: string) => {
  const [h, m] = toLatinDigits(s).split(":").map(Number);
  return h * 60 + m;
};

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  if (h < 21) return "عصر بخیر";
  return "شب بخیر";
}

/** Saturday-first weekday order with time.Weekday bit indexes. */
export const WEEKDAYS: { bit: number; label: string }[] = [
  { bit: 6, label: "ش" },
  { bit: 0, label: "ی" },
  { bit: 1, label: "د" },
  { bit: 2, label: "س" },
  { bit: 3, label: "چ" },
  { bit: 4, label: "پ" },
  { bit: 5, label: "ج" },
];

export const AVATARS = ["😎", "🦊", "🐼", "🐱", "🐸", "🦄", "🐯", "🐧", "🐙", "👾", "🤖", "🎮", "🚀", "⚡", "🔥", "🌙", "🍕", "🎧", "🌈", "💎"];

// Validated for CVD separation and contrast on the dark surface (see README).
export const SWATCHES = ["#a855f7", "#0891b2", "#d97706", "#db2777", "#16a34a", "#6366f1"];

/** Minutes of a planned shift that fall under a pay-bonus rule (mirrors backend calc). */
export function bonusMinutes(date: string, startMin: number, minutes: number, rules: RateRule[]) {
  const base = parseDay(date);
  let n = 0;
  for (let m = startMin; m < startMin + minutes; m++) {
    const wd = addDays(base, Math.floor(m / 1440)).getDay(); // JS getDay matches Go time.Weekday
    const mod = m % 1440;
    const hit = rules.some((r) => {
      if (!r.active || r.multiplier <= 1) return false;
      if (r.weekdays && !(r.weekdays & (1 << wd))) return false;
      if (r.startMin === r.endMin) return true;
      return r.startMin < r.endMin ? mod >= r.startMin && mod < r.endMin : mod >= r.startMin || mod < r.endMin;
    });
    if (hit) n++;
  }
  return n;
}
