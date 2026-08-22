import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

const FAST_MS = 200;
const NORMAL_MS = 500;
const POLL_MS = 5_000;
const ERROR_POLL_MS = 2_000;
const TIMEOUT_MS = 5_000;
const INITIAL_DELAY_MS = 500;

export type NetworkSpeedLevel = "checking" | "fast" | "normal" | "slow" | "none";

type SpeedState = {
  level: NetworkSpeedLevel;
  seconds: number | null;
  reason: "offline" | "server" | null;
};

const LEVEL_CONFIG: Record<
  Exclude<NetworkSpeedLevel, "checking">,
  { label: string; className: string; iconClassName: string }
> = {
  fast: {
    label: "Fast",
    className:
      "border-sky-300 bg-sky-100 text-sky-800 shadow-sm shadow-sky-200/60",
    iconClassName: "text-sky-600",
  },
  normal: {
    label: "Normal",
    className:
      "border-blue-400 bg-blue-700 text-white shadow-sm shadow-blue-900/20",
    iconClassName: "text-white",
  },
  slow: {
    label: "Slow",
    className:
      "border-amber-400 bg-amber-400 text-amber-950 shadow-sm shadow-amber-500/30",
    iconClassName: "text-amber-950",
  },
  none: {
    label: "None",
    className:
      "border-red-400 bg-red-500 text-white shadow-sm shadow-red-600/30",
    iconClassName: "text-white",
  },
};

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function levelFromMs(ms: number): Exclude<NetworkSpeedLevel, "checking" | "none"> {
  if (ms < FAST_MS) return "fast";
  if (ms <= NORMAL_MS) return "normal";
  return "slow";
}

function formatSeconds(ms: number) {
  return `${Math.round((ms / 1000) * 10) / 10}s`;
}

export function NetworkSpeedBadge() {
  const isBrowserOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    () => true,
  );
  const [state, setState] = useState<SpeedState>({
    level: "checking",
    seconds: null,
    reason: null,
  });
  const runId = useRef(0);

  const markOffline = useCallback(() => {
    setState({ level: "none", seconds: null, reason: "offline" });
  }, []);

  const markServerDown = useCallback(() => {
    setState({ level: "none", seconds: null, reason: "server" });
  }, []);

  const runSpeedTest = useCallback(async () => {
    if (!navigator.onLine) {
      markOffline();
      return;
    }

    const id = ++runId.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    const start = performance.now();

    try {
      const res = await fetch(`/api/health/speed?_=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (id !== runId.current) return;

      if (!res.ok) {
        markServerDown();
        return;
      }

      const body = (await res.json()) as { status?: string };
      if (body.status !== "success") {
        markServerDown();
        return;
      }

      const ms = performance.now() - start;
      setState({ level: levelFromMs(ms), seconds: ms, reason: null });
    } catch {
      window.clearTimeout(timeoutId);
      if (id !== runId.current) return;
      markServerDown();
    }
  }, [markOffline, markServerDown]);

  useEffect(() => {
    if (!isBrowserOnline) {
      markOffline();
      return;
    }

    setState({ level: "checking", seconds: null, reason: null });
    const initialId = window.setTimeout(runSpeedTest, INITIAL_DELAY_MS);
    return () => window.clearTimeout(initialId);
  }, [isBrowserOnline, markOffline, runSpeedTest]);

  useEffect(() => {
    if (!isBrowserOnline) return;

    const pollMs = state.level === "none" ? ERROR_POLL_MS : POLL_MS;
    const pollId = window.setInterval(runSpeedTest, pollMs);
    return () => window.clearInterval(pollId);
  }, [isBrowserOnline, runSpeedTest, state.level]);

  const config =
    state.level === "checking" ? null : LEVEL_CONFIG[state.level];
  const isChecking = state.level === "checking";

  const title = isChecking
    ? "Checking network speed…"
    : state.reason === "offline"
      ? "No network connection"
      : state.reason === "server"
        ? "Cannot reach server"
        : state.seconds != null
          ? `Network speed (${formatSeconds(state.seconds)})`
          : "Network speed check failed";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
        isChecking
          ? "border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-muted)]"
          : config?.className,
      )}
      title={title}
      aria-live="polite"
      aria-label={title}
    >
      <Wifi
        className={cn(
          "h-3.5 w-3.5 animate-wifi-flash",
          isChecking
            ? "text-[var(--color-accent)]"
            : config?.iconClassName,
        )}
      />
      {isChecking ? "…" : config?.label}
    </span>
  );
}
