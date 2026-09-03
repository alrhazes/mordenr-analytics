import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiShellState = {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;
  setCommandOpen: (value: boolean) => void;
};

export const useUiShellStore = create<UiShellState>()(
  persist(
    (set) => ({
      sidebarCollapsed: true,
      commandOpen: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (value) => set({ commandOpen: value }),
    }),
    {
      // bump key so default collapsed applies for existing local sessions
      name: "sentra-ui-shell",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
