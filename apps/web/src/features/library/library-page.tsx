import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteSavedView,
  useSavedViews,
  type SavedView,
} from "@/queries/library";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function exploreHref(view: SavedView) {
  const q = new URLSearchParams();
  if (view.config.state) q.set("state", view.config.state);
  q.set("view", view.id);
  if (view.config.selectedConstituencyId) {
    q.set("seat", view.config.selectedConstituencyId);
  }
  return `/explore?${q.toString()}`;
}

export function LibraryPage() {
  const navigate = useNavigate();
  const views = useSavedViews();
  const remove = useDeleteSavedView();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
            Library
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-ink-muted)]">
            Saved Explore views live in your system account. Opening one
            rehydrates filters against live knowledge data.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/explore")}>
          Back to Explore
        </Button>
      </div>

      {views.isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {views.isError && (
        <p className="text-sm text-[var(--color-danger)]">
          {(views.error as Error).message}
        </p>
      )}

      {views.data && views.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white px-6 py-14 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-[var(--color-accent)]" />
          <h2 className="mt-3 text-lg font-semibold">No saved views yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-ink-muted)]">
            In Explore, set a state filter (and optional seat), then use Save
            view to store the workspace recipe here.
          </p>
          <Button className="mt-5" onClick={() => navigate("/explore")}>
            Open Explore
          </Button>
        </div>
      )}

      {views.data && views.data.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {views.data.map((view, index) => (
            <motion.article
              key={view.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className="flex flex-col rounded-xl border border-[var(--color-line)] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-ink)]">
                    {view.name}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    Updated {formatDate(view.updatedAt)}
                  </p>
                </div>
                <span className="rounded-md bg-[var(--color-accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-ink)]">
                  {view.config.state || "All Malaysia"}
                </span>
              </div>

              {view.description && (
                <p className="mt-3 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                  {view.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-ink-muted)]">
                <span className="rounded border border-[var(--color-line)] px-2 py-0.5">
                  {view.config.election || "GE15"}
                </span>
                {view.config.selectedConstituencyId && (
                  <span className="rounded border border-[var(--color-line)] px-2 py-0.5">
                    Seat {view.config.selectedConstituencyId}
                  </span>
                )}
                {view.config.compareIds && view.config.compareIds.length > 0 && (
                  <span className="rounded border border-[var(--color-line)] px-2 py-0.5">
                    Compare {view.config.compareIds.length}
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center gap-2 pt-5">
                <Button
                  size="sm"
                  onClick={() => navigate(exploreHref(view))}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={remove.isPending && pendingDelete === view.id}
                  onClick={() => {
                    if (!window.confirm(`Delete “${view.name}”?`)) return;
                    setPendingDelete(view.id);
                    remove.mutate(view.id, {
                      onSettled: () => setPendingDelete(null),
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
