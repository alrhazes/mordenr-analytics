import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin, useMe } from "@/queries/auth";
import { useHealth } from "@/queries/explore";

export function LoginPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const login = useLogin();
  const health = useHealth();
  const [email, setEmail] = useState("admin@bdcat.local");
  const [password, setPassword] = useState("bdcat-admin-change-me");

  useEffect(() => {
    if (!isLoading && user) navigate("/explore", { replace: true });
  }, [isLoading, user, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, #1f6fb233, transparent 55%), radial-gradient(900px 500px at 100% 0%, #0b1f3322, transparent 50%), linear-gradient(160deg, #f7fafc 0%, #e8eef5 45%, #dce7f2 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #0b1f3310 1px, transparent 1px), linear-gradient(to bottom, #0b1f3310 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:flex-row lg:items-center lg:gap-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12 max-w-xl lg:mb-0"
        >
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--color-ink)] text-white">
              <span className="text-sm font-semibold tracking-widest">BD</span>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                TrackData
              </div>
              <div className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-ink)] md:text-5xl">
                BDCAT
              </div>
            </div>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-[var(--color-ink-muted)]">
            Big Data Coordinated Analytic Technology — explore electoral
            intelligence with a faster, calmer workspace.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-white/90 p-8 shadow-[0_24px_80px_-40px_rgba(11,31,51,0.45)] backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(
              { email, password },
              { onSuccess: () => navigate("/explore", { replace: true }) },
            );
          }}
        >
          <h1 className="text-xl font-semibold text-[var(--color-ink)]">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Use your BDCAT system account.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Email</span>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Password</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </div>

          {login.isError && (
            <p className="mt-3 text-sm text-[var(--color-danger)]">
              {(login.error as Error).message}
            </p>
          )}

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={login.isPending}
          >
            {login.isPending ? "Signing in…" : "Continue"}
          </Button>

          <div className="mt-6 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
            {health.isLoading && "Checking databases…"}
            {health.data && (
              <>
                System DB {health.data.systemDb.ok ? "ok" : "down"} · Knowledge{" "}
                {health.data.knowledgeDb.ok ? "ok" : "down"} (
                {health.data.knowledgeDb.name || "stt_electorals"}, read-only)
              </>
            )}
            {health.isError && "API unreachable — start the API on :3001"}
          </div>
        </motion.form>
      </div>
    </div>
  );
}
