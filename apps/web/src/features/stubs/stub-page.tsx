export function StubPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-2 text-[var(--color-ink-muted)]">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-8 text-sm text-[var(--color-ink-muted)]">
        Stub route — ready for Phase 3/4 features without cloning the old
        Metronic admin chrome.
      </div>
    </div>
  );
}
