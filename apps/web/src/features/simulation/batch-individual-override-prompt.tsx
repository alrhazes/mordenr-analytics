import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import type { SimulationSave } from "@/queries/simulation";

type Props = {
  open: boolean;
  matches: SimulationSave[];
  onConfirm: (selectedIds: string[]) => void;
  onSkip: () => void;
  onCancel: () => void;
};

export function BatchIndividualOverridePrompt({
  open,
  matches,
  onConfirm,
  onSkip,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelected(matches.map((m) => m.id));
    }
  }, [open, matches]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Tutup"
            className="fixed inset-0 z-50 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed left-1/2 top-[18vh] z-50 w-[min(92vw,480px)] -translate-x-1/2 rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">Simulasi Individu Dijumpai</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Ada simpanan individu untuk kerusi terpilih. Gunakan parameter
              individu tersebut dalam batch run?
            </p>
            <ul className="mt-4 max-h-60 space-y-2 overflow-auto">
              {matches.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(m.id)}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, m.id]
                            : prev.filter((id) => id !== m.id),
                        );
                      }}
                    />
                    <span>
                      <span className="font-semibold">{m.mapCode}</span>
                      {" · "}
                      {m.name}
                      <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">
                        {new Date(m.lastActivity).toLocaleString("en-MY")}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Batal
              </Button>
              <Button type="button" variant="outline" onClick={onSkip}>
                Tanpa override
              </Button>
              <Button
                type="button"
                onClick={() => onConfirm(selected)}
                disabled={selected.length === 0}
              >
                Guna terpilih ({selected.length})
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
