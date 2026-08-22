import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  BookOpen,
  Compass,
  Settings2,
  UserRound,
} from "lucide-react";
import { useUiShellStore } from "@/stores/ui-shell";
import { useMe } from "@/queries/auth";

const items = [
  { label: "Explore", to: "/explore", icon: Compass, adminOnly: false },
  { label: "Library", to: "/library", icon: BookOpen, adminOnly: false },
  { label: "Admin", to: "/admin", icon: Settings2, adminOnly: true },
  { label: "Profile", to: "/profile", icon: UserRound, adminOnly: false },
];

export function CommandPalette() {
  const open = useUiShellStore((s) => s.commandOpen);
  const setCommandOpen = useUiShellStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const { data: user } = useMe();

  if (!open) return null;

  const visible = items.filter(
    (item) => !item.adminOnly || user?.role === "ADMIN",
  );

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--color-ink)]/40 backdrop-blur-[2px]"
        aria-label="Close command palette"
        onClick={() => setCommandOpen(false)}
      />
      <div className="relative mx-auto mt-[14vh] w-full max-w-lg px-4">
        <Command
          className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xl"
          label="Command menu"
        >
          <Command.Input
            placeholder="Jump to…"
            className="h-12 w-full border-b border-[var(--color-line)] px-4 text-sm outline-none"
            autoFocus
          />
          <Command.List className="max-h-72 overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-sm text-[var(--color-ink-muted)]">
              No matches.
            </Command.Empty>
            <Command.Group
              heading="Navigate"
              className="px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)]"
            >
              {visible.map((item) => (
                <Command.Item
                  key={item.to}
                  value={item.label}
                  onSelect={() => {
                    navigate(item.to);
                    setCommandOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-ink)] aria-selected:bg-[var(--color-accent-soft)]"
                >
                  <item.icon className="h-4 w-4 text-[var(--color-accent)]" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
