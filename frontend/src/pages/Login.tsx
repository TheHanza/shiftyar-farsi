import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { toLatinDigits } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { BrandLogo, useBranding, useFavicon } from "@/components/BrandLogo";

export default function Login() {
  const setToken = useAuth((s) => s.setToken);
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: branding } = useBranding();
  useFavicon(branding?.logoVersion);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ token: string }>("/auth/login", { json: { username: toLatinDigits(username), password: toLatinDigits(password) } });
      qc.clear();
      setToken(res.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh justify-center">
      <div className="hero-gradient relative flex w-full max-w-3xl flex-col justify-center overflow-hidden bg-background px-6 py-10">
        <div className="pointer-events-none absolute -left-16 top-24 h-48 w-48 rounded-full bg-mint/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />

        <div className="rise relative mx-auto w-full max-w-sm">
          <BrandLogo version={branding?.logoVersion} className="glow mx-auto h-20 w-20 rounded-3xl bg-surface" />
          <h1 className="mt-5 text-center text-3xl font-black">شیفت‌یار</h1>
          {branding?.companyName && <p className="mt-1 text-center text-sm font-medium text-purple-light">{branding.companyName}</p>}
          <p className="mt-2 text-center text-sm text-muted">ساعت‌هات رو ثبت کن، حقوقت رو ببین، به هدفت برس 🚀</p>

          <form onSubmit={submit} className="card mt-8 flex flex-col gap-4 bg-surface/80 p-5 backdrop-blur">
            <label>
              <span className="label">نام کاربری</span>
              <input
                className="field ltr text-left"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              <span className="label">رمز عبور</span>
              <div className="relative">
                <input
                  className="field ltr pl-10 text-left"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-muted" onClick={() => setShow(!show)} aria-label="نمایش رمز">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-red-300">{error}</div>}
            <button className="btn btn-primary mt-1 h-12 text-base" disabled={busy}>
              {busy ? <Spinner className="text-white" /> : <LogIn size={18} />}
              ورود
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-subtle">حساب نداری؟ از مدیرت بخواه برات بسازه.</p>
        </div>
      </div>
    </div>
  );
}
