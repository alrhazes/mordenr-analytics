import { useState } from "react";
import { Brain, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSimulationAi } from "@/queries/simulation";

type Props = {
  open: boolean;
  onClose: () => void;
  question: string;
  reply: string;
  onQuestionChange: (q: string) => void;
  onReplyChange: (r: string) => void;
  context: Record<string, unknown>;
};

export function SimulationAiPanel({
  open,
  onClose,
  question,
  reply,
  onQuestionChange,
  onReplyChange,
  context,
}: Props) {
  const ai = useSimulationAi();
  const [error, setError] = useState("");

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,420px)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-[var(--color-accent)]" />
          ANALISIS AI
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3 p-4">
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          rows={5}
          placeholder="Tanya AI tentang simulasi ini..."
          className="w-full rounded-md border border-[var(--color-line)] bg-white p-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!question.trim() || ai.isPending}
            onClick={() => {
              setError("");
              ai.mutate(
                { question: question.trim(), simulationContext: context },
                {
                  onSuccess: (data) => onReplyChange(data.reply),
                  onError: (err) =>
                    setError(
                      err instanceof Error ? err.message : "Ralat AI",
                    ),
                },
              );
            }}
          >
            {ai.isPending ? "Menganalisa…" : "ANALISIS AI"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onReplyChange("");
              onQuestionChange("");
            }}
          >
            Reset Analisis
          </Button>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        {reply && (
          <div
            className="prose prose-sm max-w-none rounded-md bg-[var(--color-bg)] p-3 text-sm text-[var(--color-ink)]"
            dangerouslySetInnerHTML={{ __html: reply.replace(/\n/g, "<br/>") }}
          />
        )}
      </div>
    </div>
  );
}
