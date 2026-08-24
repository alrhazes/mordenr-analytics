import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PartyConfigEntry } from "@/queries/simulation";

type Props = {
  open: boolean;
  onClose: () => void;
  parties: PartyConfigEntry[];
  overrides: Record<string, { party_gov: boolean }>;
  onSave: (overrides: Record<string, { party_gov: boolean }>) => void;
};

export function PartyConfigDialog({
  open,
  onClose,
  parties,
  overrides,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(overrides);

  useEffect(() => {
    if (open) setDraft(overrides);
  }, [open, overrides]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Tutup"
            className="fixed inset-0 z-50 bg-[var(--color-ink)]/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed left-1/2 top-[10vh] z-50 flex max-h-[80vh] w-[min(92vw,720px)] -translate-x-1/2 flex-col rounded-xl border border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
              <h2 className="text-lg font-semibold">Tukar Parti (Kerajaan)</h2>
              <Button type="button" size="icon" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-xs text-[var(--color-ink-muted)]">
                    <th className="px-2 py-2">Parti</th>
                    <th className="px-2 py-2">Asal</th>
                    <th className="px-2 py-2">Simulasi (Kerajaan)</th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => {
                    const effective =
                      draft[p.party_name]?.party_gov ?? p.effective_gov;
                    return (
                      <tr
                        key={p.party_name}
                        className="border-b border-[var(--color-line)]/60"
                      >
                        <td className="px-2 py-2 font-medium">{p.party_name}</td>
                        <td className="px-2 py-2">
                          {p.party_gov ? "Kerajaan" : "Bukan Kerajaan"}
                        </td>
                        <td className="px-2 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={effective}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  [p.party_name]: {
                                    party_gov: e.target.checked,
                                  },
                                })
                              }
                            />
                            Kerajaan
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-line)] px-5 py-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onSave(draft);
                  onClose();
                }}
              >
                Simpan
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
