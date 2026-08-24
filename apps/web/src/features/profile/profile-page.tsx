import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChangePassword,
  useProfile,
  useUpdateProfile,
} from "@/queries/profile";

export function ProfilePage() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data?.name) setName(profile.data.name);
  }, [profile.data?.name]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
          Profile
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Your Votlytics system account — stored in <code>bdcat_system</code>.
        </p>
      </div>

      {profile.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      )}

      {profile.data && (
        <>
          <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <h2 className="text-sm font-semibold">Account</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[var(--color-bg)] px-3 py-2.5 text-sm">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                  Email
                </div>
                <div className="mt-1 font-medium">{profile.data.email}</div>
              </div>
              <div className="rounded-lg bg-[var(--color-bg)] px-3 py-2.5 text-sm">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                  Role
                </div>
                <div className="mt-1 font-medium">{profile.data.role}</div>
              </div>
              <div className="rounded-lg bg-[var(--color-bg)] px-3 py-2.5 text-sm sm:col-span-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                  Saved views
                </div>
                <div className="mt-1 font-medium tabular-nums">
                  {profile.data.savedViewCount}
                </div>
              </div>
            </div>

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                updateProfile.mutate({ name: name.trim() });
              }}
            >
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Display name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              {updateProfile.isError && (
                <p className="text-sm text-[var(--color-danger)]">
                  {(updateProfile.error as Error).message}
                </p>
              )}
              {updateProfile.isSuccess && (
                <p className="text-sm text-[var(--color-accent)]">
                  Profile updated.
                </p>
              )}
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving…" : "Save name"}
              </Button>
            </form>
          </section>

          <section className="rounded-xl border border-[var(--color-line)] bg-white p-5">
            <h2 className="text-sm font-semibold">Password</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setPasswordMsg(null);
                if (newPassword !== confirmPassword) {
                  setPasswordMsg("New passwords do not match");
                  return;
                }
                changePassword.mutate(
                  { currentPassword, newPassword },
                  {
                    onSuccess: () => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordMsg("Password changed.");
                    },
                    onError: (err) => {
                      setPasswordMsg((err as Error).message);
                    },
                  },
                );
              }}
            >
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Current password</span>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">New password</span>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Confirm new password</span>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              {passwordMsg && (
                <p
                  className={`text-sm ${
                    passwordMsg === "Password changed."
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-danger)]"
                  }`}
                >
                  {passwordMsg}
                </p>
              )}
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "Updating…" : "Change password"}
              </Button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
