import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateSavedView } from "@/queries/library";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

export function SaveViewDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateSavedView();

  const appliedState = useExploreWorkspaceStore((s) => s.appliedState);
  const selectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.selectedConstituencyId,
  );
  const mapMode = useExploreWorkspaceStore((s) => s.mapMode);
  const compareIds = useExploreWorkspaceStore((s) => s.compareIds);

  const defaultName = appliedState
    ? `GE15 · ${appliedState}`
    : "GE15 · All Malaysia";

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setName(defaultName);
          setDescription("");
          setOpen(true);
        }}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        Save view
      </Button>

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
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="save-view-title"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-[18vh] z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-2xl"
            >
              <h2
                id="save-view-title"
                className="text-lg font-semibold text-[var(--color-ink)]"
              >
                Save Explore view
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Stores filters in your system DB. Live seats still load from
                knowledge data when opened.
              </p>

              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate(
                    {
                      name: name.trim() || defaultName,
                      description: description.trim() || null,
                      config: {
                        election: "GE15",
                        state: appliedState,
                        selectedConstituencyId,
                        mapMode,
                        compareIds,
                      },
                    },
                    {
                      onSuccess: () => setOpen(false),
                    },
                  );
                }}
              >
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Name</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Description</span>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional note"
                  />
                </label>

                <div className="rounded-md bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
                  State: {appliedState || "All Malaysia"}
                  {selectedConstituencyId
                    ? ` · Seat ${selectedConstituencyId}`
                    : ""}
                  {compareIds.length
                    ? ` · Compare ${compareIds.join(", ")}`
                    : ""}
                </div>

                {create.isError && (
                  <p className="text-sm text-[var(--color-danger)]">
                    {(create.error as Error).message}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Saving…" : "Save to Library"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
