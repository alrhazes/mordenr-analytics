import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  BookOpen,
  Compass,
  FlaskConical,
  LogOut,
  PanelLeft,
  Settings2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BdcatAppHeader } from "@/components/bdcat-app-header";
import { useLogout, useMe } from "@/queries/auth";
import { useUiShellStore } from "@/stores/ui-shell";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/explore", label: "Explore", icon: Compass, adminOnly: false },
  { to: "/simulation", label: "Simulation", icon: FlaskConical, adminOnly: false },
  { to: "/library", label: "Library", icon: BookOpen, adminOnly: false },
  { to: "/admin", label: "Admin", icon: Settings2, adminOnly: true },
  { to: "/profile", label: "Profile", icon: UserRound, adminOnly: false },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user, isLoading } = useMe();
  const logout = useLogout();
  const sidebarCollapsed = useUiShellStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiShellStore((s) => s.toggleSidebar);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login", { replace: true });
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-[var(--color-ink-muted)]">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-fg)] transition-[width] duration-300",
          sidebarCollapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-sm font-semibold tracking-wide">
            BD
          </div>
          {!sidebarCollapsed && (
            <div>
              <div className="text-sm font-semibold tracking-[0.08em]">BDCAT</div>
              <div className="text-xs text-[var(--color-sidebar-muted)]">
                Analytics
              </div>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {nav
            .filter((item) => !item.adminOnly || user.role === "ADMIN")
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-[var(--color-sidebar-muted)] hover:bg-white/8 hover:text-white",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          {!sidebarCollapsed && (
            <div className="px-1 text-xs text-[var(--color-sidebar-muted)]">
              {user.name}
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-[var(--color-sidebar-fg)] hover:bg-white/10 hover:text-white"
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => navigate("/login", { replace: true }),
              })
            }
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && "Sign out"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <BdcatAppHeader
          sidebarToggle={
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <PanelLeft className="h-4 w-4" />
            </Button>
          }
        />

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={cn(
            "flex-1",
            location.pathname.startsWith("/explore") ||
            location.pathname.startsWith("/simulation")
              ? "p-4"
              : "p-6",
          )}
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
