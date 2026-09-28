import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Clock3, Home, Settings2, Users, UsersRound } from "lucide-react";
import { Avatar } from "./ui";
import { BrandLogo, useFavicon } from "./BrandLogo";
import { useLive, useMe } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/format";

const employeeNav = [
  { to: "/", label: "خانه", icon: Home, end: true },
  { to: "/shifts", label: "شیفت‌ها", icon: Clock3 },
  { to: "/team", label: "تیم", icon: UsersRound },
];

const adminNav = [
  { to: "/", label: "خانه", icon: Home, end: true },
  { to: "/shifts", label: "شیفت‌ها", icon: Clock3, badge: true },
  { to: "/report", label: "گزارش", icon: BarChart3 },
  { to: "/people", label: "افراد", icon: Users },
  { to: "/settings", label: "تنظیمات", icon: Settings2 },
];

export default function Layout() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const isAdmin = me?.user.role === "admin";
  const { data: live } = useLive(isAdmin);
  const nav = isAdmin ? adminNav : employeeNav;
  useFavicon(me?.settings.logoVersion);

  return (
    <div className="flex min-h-dvh justify-center">
      <div className="relative w-full max-w-3xl bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-background/75 px-4 py-3 backdrop-blur-md">
          <button className="flex items-center gap-2.5" onClick={() => navigate("/")}>
            <BrandLogo version={me?.settings.logoVersion} className="h-9 w-9 rounded-xl" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-lg font-extrabold">شیفت‌یار</span>
              <span className="text-[0.65rem] text-muted">{me?.settings.companyName}</span>
            </span>
          </button>
          {me && (
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-3 pr-1 shadow-[0_1px_2px_0_rgba(0,0,0,0.1)]"
            >
              <Avatar user={me.user} size={30} />
              <span className="max-w-24 truncate text-sm">{me.user.name}</span>
            </button>
          )}
        </header>

        <main className="px-4 pb-28 pt-4">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-3xl -translate-x-1/2 border-t border-white/5 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <div className="flex justify-around px-2 pt-1.5 pb-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn("relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[0.7rem] transition", isActive ? "text-primary" : "text-subtle hover:text-muted")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition", isActive && "bg-primary-soft")}>
                      <n.icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
                    </span>
                    {n.label}
                    {"badge" in n && n.badge && !!live?.pendingCount && (
                      <span className="absolute right-2 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber px-1 text-[0.6rem] font-bold text-black">
                        {fa(live.pendingCount)}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
