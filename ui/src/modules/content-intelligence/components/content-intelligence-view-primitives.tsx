import { RefreshCcw } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

export function State({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function displayDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString() : value;
}

export function TimelineEndSentinel({
  scrollRoot,
  canLoadMore,
  isLoading,
  onLoadMore,
  label,
}: {
  scrollRoot: RefObject<HTMLDivElement | null>;
  canLoadMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  label: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRoot.current;
    const target = endRef.current;
    if (!root || !target || !canLoadMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root, rootMargin: "0px 0px 180px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, isLoading, onLoadMore, scrollRoot]);

  if (!canLoadMore && !isLoading) return null;
  return (
    <div
      ref={endRef}
      aria-live="polite"
      data-testid="content-intelligence-timeline-end"
      className="flex min-h-12 items-center justify-center text-xs text-muted-foreground"
    >
      {isLoading ? (
        <>
          <RefreshCcw className="mr-2 size-3 animate-spin motion-reduce:animate-none" />
          {label}
        </>
      ) : null}
    </div>
  );
}
