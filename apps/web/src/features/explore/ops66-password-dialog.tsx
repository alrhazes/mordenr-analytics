import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyOps66Password } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

export function Ops66PasswordDialog() {
  const open = useExploreWorkspaceStore((s) => s.ops66DialogOpen);
  const setOpen = useExploreWorkspaceStore((s) => s.setOps66DialogOpen);
  const setPresentation = useExploreWorkspaceStore((s) => s.setPresentation);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-50 bg-[var(--color-ink)]/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="ops66-title"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="fixed left-1/2 top-[22vh] z-50 w-[min(92vw,380px)] -translate-x-1/2 rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-2xl"
          >
            <h2
              id="ops66-title"
              className="text-lg font-semibold text-[var(--color-ink)]"
            >
              OPS 66
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Masukkan kata laluan untuk paparan OPS 66 (baca sahaja — tiada
              tukar jadual live).
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError("");
                try {
                  await verifyOps66Password(password);
                  setPresentation("ops66");
                  close();
                } catch {
                  setError("Kata laluan salah");
                } finally {
                  setPending(false);
                }
              }}
            >
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata laluan"
              />
              {error && (
                <p className="text-sm text-[var(--color-danger)]">{error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Batal
                </Button>
                <Button type="submit" disabled={pending || !password}>
                  {pending ? "Mengesahkan…" : "Sahkan"}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
