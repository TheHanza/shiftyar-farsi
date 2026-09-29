import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  Adjustment,
  Channel,
  CoverageItem,
  LeaderRow,
  LiveResponse,
  MeResponse,
  PeriodKind,
  Plan,
  PlanItem,
  RateRule,
  Settings,
  Shift,
  ShiftStatus,
  Summary,
  User,
  UserBrief,
} from "./types";
import { toast } from "@/stores/toast";

const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me"), staleTime: 60_000 });

export const useSummary = (period: PeriodKind, offset = 0, userId?: number) =>
  useQuery({
    queryKey: ["summary", period, offset, userId],
    queryFn: () => api<Summary>(`/summary${qs({ period, offset, userId })}`),
  });

export const useShifts = (params: { from?: string; to?: string; userId?: number; status?: ShiftStatus; limit?: number } = {}, enabled = true) =>
  useQuery({ queryKey: ["shifts", params], queryFn: () => api<Shift[]>(`/shifts${qs(params)}`), enabled });

export const useActiveShift = () =>
  useQuery({ queryKey: ["active"], queryFn: () => api<Shift | null>("/shifts/active"), refetchInterval: 60_000 });

export const useCoverage = (date: string) =>
  useQuery({
    queryKey: ["coverage", date],
    queryFn: () => api<{ date: string; items: CoverageItem[] }>(`/coverage${qs({ date })}`),
    refetchInterval: 60_000,
  });

export const useLeaderboard = (period: PeriodKind) =>
  useQuery({ queryKey: ["leaderboard", period], queryFn: () => api<LeaderRow[]>(`/leaderboard${qs({ period })}`) });

export const useLive = (enabled = true) =>
  useQuery({ queryKey: ["live"], queryFn: () => api<LiveResponse>("/admin/live"), refetchInterval: 30_000, enabled });

export const useReport = (period: PeriodKind, offset: number) =>
  useQuery({
    queryKey: ["report", period, offset],
    queryFn: () => api<{ period: Summary["period"]; rows: Summary[] }>(`/admin/report${qs({ period, offset })}`),
  });

export const usePlan = (days = 14, from?: string, enabled = true) =>
  useQuery({
    queryKey: ["plan", days, from],
    queryFn: () => api<{ from: string; days: number; items: PlanItem[] }>(`/plan${qs({ days, from })}`),
    refetchInterval: 60_000,
    enabled,
  });

export const usePlans = () => useQuery({ queryKey: ["plans"], queryFn: () => api<Plan[]>("/admin/plans") });

/** Lightweight list of teammates (name and avatar) for picking a cover; employees can't read /admin/users. */
export const useTeammates = () =>
  useQuery({ queryKey: ["teammates"], queryFn: () => api<UserBrief[]>("/team") });

export const useUsers = (enabled = true) =>
  useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/admin/users"), enabled });
export const useRules = () => useQuery({ queryKey: ["rules"], queryFn: () => api<RateRule[]>("/admin/rules") });

export const useAdjustments = (year: number, month: number, userId?: number) =>
  useQuery({
    queryKey: ["adjustments", year, month, userId],
    queryFn: () => api<Adjustment[]>(`/admin/adjustments${qs({ year, month, userId })}`),
    enabled: year > 0,
  });

/** A mutation that toasts errors and refreshes everything shift-related on success. */
export function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string; invalidate?: string[]; onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      const keys = opts.invalidate ?? ["shifts", "summary", "active", "coverage", "leaderboard", "live", "report", "plan"];
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const shiftApi = {
  create: (body: object) => api<Shift>("/shifts", { json: body }),
  update: (id: number, body: object) => api<Shift>(`/shifts/${id}`, { method: "PATCH", json: body }),
  remove: (id: number) => api<void>(`/shifts/${id}`, { method: "DELETE" }),
  clockIn: (channelId: number | null) => api<Shift>("/shifts/clock-in", { json: { channelId } }),
  clockOut: (note: string) => api<Shift | null>("/shifts/clock-out", { json: { note } }),
  review: (ids: number[], status: ShiftStatus, note = "") => api("/admin/shifts/review", { json: { ids, status, note } }),
};

export const adminApi = {
  saveUser: (id: number | null, body: object) =>
    id ? api<User>(`/admin/users/${id}`, { method: "PATCH", json: body }) : api<User>("/admin/users", { json: body }),
  saveChannel: (id: number | null, body: object) =>
    id ? api<Channel>(`/admin/channels/${id}`, { method: "PATCH", json: body }) : api<Channel>("/admin/channels", { json: body }),
  saveRule: (id: number | null, body: object) =>
    id ? api<RateRule>(`/admin/rules/${id}`, { method: "PATCH", json: body }) : api<RateRule>("/admin/rules", { json: body }),
  deleteRule: (id: number) => api<void>(`/admin/rules/${id}`, { method: "DELETE" }),
  saveSettings: (body: Settings) => api<Settings>("/admin/settings", { method: "PUT", json: body }),
  addAdjustment: (body: object) => api<Adjustment>("/admin/adjustments", { json: body }),
  deleteAdjustment: (id: number) => api<void>(`/admin/adjustments/${id}`, { method: "DELETE" }),
};

export const planApi = {
  save: (id: number | null, body: object) =>
    id ? api<Plan>(`/admin/plans/${id}`, { method: "PATCH", json: body }) : api<Plan>("/admin/plans", { json: body }),
  remove: (id: number) => api<void>(`/admin/plans/${id}`, { method: "DELETE" }),
  requestCover: (body: { planId: number; date: string; targetId?: number | null; coverId?: number | null; note?: string }) =>
    api("/plan/covers", { json: body }),
  accept: (id: number) => api<void>(`/plan/covers/${id}/accept`, { method: "POST" }),
  decline: (id: number) => api<void>(`/plan/covers/${id}/decline`, { method: "POST" }),
  cancel: (id: number) => api<void>(`/plan/covers/${id}/cancel`, { method: "POST" }),
};
