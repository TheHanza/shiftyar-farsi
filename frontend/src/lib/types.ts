export type Role = "admin" | "employee";
export type ShiftStatus = "pending" | "approved" | "rejected";
export type Calendar = "gregorian" | "jalali";
export type PeriodKind = "week" | "month";

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  hourlyRate: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
  avatar: string;
  color: string;
  channelId: number | null;
  active: boolean;
}

export interface UserBrief {
  id: number;
  name: string;
  avatar: string;
  color: string;
}

export interface Channel {
  id: number;
  name: string;
  color: string;
  active: boolean;
}

export interface Settings {
  companyName: string;
  calendar: Calendar;
  timezone: string;
  currency: string;
  requireApproval: boolean;
  editWindowDays: number;
  maxShiftHours: number;
  showLeaderboard: boolean;
  logoVersion: number;
}

export interface MeResponse {
  user: User;
  settings: Settings;
  channels: Channel[];
  rules: RateRule[];
  serverTime: string;
}

export interface Shift {
  id: number;
  userId: number;
  channelId: number | null;
  start: string;
  end: string | null;
  note: string;
  status: ShiftStatus;
  reviewNote: string;
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  weightedMinutes: number;
  bonusMinutes: number;
  editable: boolean;
  user?: UserBrief;
}

export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  year: number;
  month: number;
}

export interface DayRow {
  date: string;
  minutes: number;
  weightedMinutes: number;
  pendingMinutes: number;
}

export interface Summary {
  user: UserBrief;
  period: Period;
  minutes: number;
  weightedMinutes: number;
  bonusMinutes: number;
  pendingMinutes: number;
  pendingWeightedMinutes: number;
  shiftCount: number;
  hourlyRate: number;
  basePay: number;
  adjustments: number;
  pay: number;
  estimatedPay: number;
  goalMinutes: number;
  openShiftMinutes: number;
  streak?: number;
  days?: DayRow[];
}

export interface CoverageItem {
  shiftId: number;
  user: UserBrief;
  channelId: number | null;
  startMin: number;
  endMin: number;
  open: boolean;
  status: ShiftStatus;
}

export interface LeaderRow {
  user: UserBrief;
  minutes: number;
  goalMinutes: number;
}

export interface RateRule {
  id: number;
  name: string;
  startMin: number;
  endMin: number;
  weekdays: number;
  multiplier: number;
  active: boolean;
}

export interface Adjustment {
  id: number;
  userId: number;
  year: number;
  month: number;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface LiveResponse {
  online: { user: UserBrief; shiftId: number; channelId: number | null; start: string }[];
  pendingCount: number;
}
