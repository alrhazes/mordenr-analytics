import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/queries/auth";
import {
  useAdminUsers,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  type Role,
} from "@/queries/admin";

const ROLES: Role[] = ["ADMIN", "ANALYST", "VIEWER"];

export function AdminPage() {
  const me = useMe();
  const users = useAdminUsers(me.data?.role === "ADMIN");
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ANALYST");
  const [formOpen, setFormOpen] = useState(false);

  const sorted = useMemo(() => users.data || [], [users.data]);

  if (me.data && me.data.role !== "ADMIN") {
    return <Navigate to="/explore" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
            Admin
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            People and roles for this workspace.
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          {formOpen ? "Close form" : "Add user"}
        </Button>
      </div>

      {formOpen && (
        <form
          className="grid gap-3 rounded-xl border border-[var(--color-line)] bg-white p-5 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createUser.mutate(
              { email, name, password, role },
              {
                onSuccess: () => {
                  setEmail("");
                  setName("");
                  setPassword("");
                  setRole("ANALYST");
                  setFormOpen(false);
                },
              },
            );
          }}
        >
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Temp password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Role</span>
            <select
              className="flex h-11 w-full rounded-md border border-[var(--color-line)] bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {createUser.isError && (
            <p className="md:col-span-2 text-sm text-[var(--color-danger)]">
              {(createUser.error as Error).message}
            </p>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
        <div className="grid grid-cols-[1.2fr_1.4fr_0.7fr_0.6fr_auto] gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Views</span>
          <span />
        </div>

        {users.isLoading && (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}

        {users.isError && (
          <p className="p-4 text-sm text-[var(--color-danger)]">
            {(users.error as Error).message}
          </p>
        )}

        {sorted.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1.2fr_1.4fr_0.7fr_0.6fr_auto] items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 text-sm last:border-b-0"
          >
            <div className="font-medium text-[var(--color-ink)]">{user.name}</div>
            <div className="truncate text-[var(--color-ink-muted)]">
              {user.email}
            </div>
            <select
              className="h-9 rounded-md border border-[var(--color-line)] bg-white px-2 text-xs"
              value={user.role}
              disabled={updateUser.isPending}
              onChange={(e) =>
                updateUser.mutate({
                  id: user.id,
                  role: e.target.value as Role,
                })
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="tabular-nums text-[var(--color-ink-muted)]">
              {user.savedViewCount}
            </div>
            <Button
              size="icon"
              variant="ghost"
              disabled={user.id === me.data?.id || deleteUser.isPending}
              title={
                user.id === me.data?.id
                  ? "Cannot delete yourself"
                  : "Delete user"
              }
              onClick={() => {
                if (!window.confirm(`Delete ${user.email}?`)) return;
                deleteUser.mutate(user.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
            </Button>
          </div>
        ))}
      </div>

      {(updateUser.isError || deleteUser.isError) && (
        <p className="text-sm text-[var(--color-danger)]">
          {((updateUser.error || deleteUser.error) as Error).message}
        </p>
      )}
    </div>
  );
}
