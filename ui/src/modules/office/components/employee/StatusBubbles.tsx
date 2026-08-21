"use client";

import { Html } from "@react-three/drei";
import { memo, type ReactNode, useEffect, useState } from "react";

import { OFFICE_HTML_Z } from "@/lib/z-index";
import type { EmployeeActivityState, EmployeePersistenceTag } from "@/modules/office/lib/types";

/**
 * EMPLOYEE STATUS BUBBLES
 * =======================
 * Renders the floating status indicator, hover label, and debug decision badge.
 *
 * KEY CONCEPTS:
 * - Keep R3F HTML overlays isolated from the avatar mesh tree
 * - Keep activity text hidden until hover so the diamond remains the scan cue
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 */

type ActivityBadgeStyle = {
  label: string;
  className: string;
};

const FIXED_READY_BANNER_CLASS =
  "flex min-h-[42px] min-w-[176px] max-w-[260px] flex-col items-center justify-center rounded-sm border px-4 py-2 text-center text-[13px] font-semibold leading-none shadow-md backdrop-blur-sm";
const FLOATING_STATUS_CARD_CLASS =
  "w-[200px] max-w-[200px] rounded-md border px-3 py-2 text-[11px] font-semibold leading-none shadow-lg backdrop-blur";
const TITLE_TEXT_CLASS =
  "line-clamp-2 whitespace-normal break-keep leading-snug [hyphens:none] [overflow-wrap:normal] [word-break:keep-all]";
const ACTIVITY_ROW_CLASS = "flex items-center justify-center gap-1.5";
const ACTIVITY_SIGNAL_CARD_CLASS =
  "relative w-[104px] max-w-[104px] translate-x-[7px] -translate-y-[8px] overflow-hidden rounded-sm border border-emerald-900/15 bg-white/88 px-2 py-1 text-emerald-900/85 shadow-[0_4px_10px_rgba(60,64,56,0.14)] backdrop-blur-[2px]";
const ACTIVITY_SIGNAL_TEXT_CLASS =
  "relative z-10 min-h-[11px] min-w-0 flex-1 text-left text-[7px] font-semibold leading-none tracking-[0.01em]";
const ACTIVITY_SIGNAL_STACK_TEXT_CLASS =
  "relative z-10 flex min-h-[16px] min-w-0 flex-1 flex-col justify-center gap-0.5 text-left text-[6.5px] font-semibold leading-none tracking-[0.01em]";
const BUBBLE_MESSAGE_ROW_CLASS = "line-clamp-1 whitespace-normal break-words leading-tight";

type EmployeeStatusBubblesProps = {
  statusMessage?: string;
  activityState?: EmployeeActivityState;
  activityLabel?: string;
  activityDetail?: string;
  isHovered: boolean;
  isHighlighted: boolean;
  name: string;
  jobTitle?: string;
  team?: string;
  capabilityProfileLabel?: string;
  totalHeight: number;
  debugMode: boolean;
  debugDeskDecision: string;
  onboardingPrompt?: string | null;
  useCompactOverlayMode?: boolean;
  pinReadyActivity?: boolean;
  skillInvocationLabel?: string;
  bubbleMessages?: Array<{ threadId: string; message: string; eventAt: number }>;
  presenceExpiresAt?: number;
  persistenceTag?: EmployeePersistenceTag;
};

const PERSISTENCE_TAG_STYLES: Record<EmployeePersistenceTag, string> = {
  goal: "text-amber-700",
  heartbeat: "text-cyan-700",
  pinned: "text-slate-600",
};

function EmployeePersistenceLabel({ tag }: { tag: EmployeePersistenceTag }) {
  return (
    <span
      data-testid={`employee-persistence-tag-${tag}`}
      className={`inline-flex items-center gap-1.5 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] ${PERSISTENCE_TAG_STYLES[tag]}`}
    >
      <span className="size-1 rounded-full bg-current opacity-80" />
      {tag}
    </span>
  );
}

function AccessProfilePill({ label }: { label: string }) {
  return (
    <span
      data-testid="employee-capability-profile-pill"
      className="inline-flex items-center rounded-full border border-current/20 bg-current/5 px-1.5 py-0.5 text-[9px] font-semibold leading-none opacity-90"
    >
      Access profile · {label}
    </span>
  );
}

export function formatSkillInvocationLabel(skillId: string | undefined): string | undefined {
  const normalized = skillId
    ?.trim()
    .replace(/^[$@#]+/, "")
    .replace(/[_/]+/g, "-")
    .replace(/-+/g, " ")
    .trim();
  if (!normalized) return undefined;
  return `Calling ${normalized}`;
}

function getActivityBadgeStyle(state: EmployeeActivityState): ActivityBadgeStyle {
  switch (state) {
    case "running":
      return {
        label: "Running",
        className: "border-sky-300/80 bg-white/92 text-sky-800 shadow-stone-900/10",
      };
    case "waiting":
      return {
        label: "Waiting",
        className: "border-amber-300/80 bg-white/92 text-amber-800 shadow-stone-900/10",
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-rose-300/80 bg-white/92 text-rose-800 shadow-stone-900/10",
      };
    case "review":
      return {
        label: "Review",
        className: "border-violet-300/80 bg-white/92 text-violet-800 shadow-stone-900/10",
      };
    case "done":
      return {
        label: "Done",
        className: "border-emerald-300/80 bg-white/92 text-emerald-800 shadow-stone-900/10",
      };
    default:
      return {
        label: "Idle",
        className: "border-stone-300/80 bg-white/92 text-stone-600 shadow-stone-900/10",
      };
  }
}

function EmployeeActivityBadge({
  state,
  label,
  detail,
  title,
  focused,
  totalHeight,
  compact,
  fixedBannerSize,
  persistenceTag,
  capabilityProfileLabel,
}: {
  state: EmployeeActivityState;
  label?: string;
  detail?: string;
  title: string;
  focused: boolean;
  totalHeight: number;
  compact: boolean;
  fixedBannerSize: boolean;
  persistenceTag?: EmployeePersistenceTag;
  capabilityProfileLabel?: string;
}) {
  const style = getActivityBadgeStyle(state);
  const displayLabel = label?.trim() || style.label;
  const showDetail = focused && !compact && detail?.trim() && detail.trim() !== displayLabel;
  const displayTitle = title.trim();
  const containerClassName = fixedBannerSize
    ? `${FIXED_READY_BANNER_CLASS} ${style.className}`
    : `${FLOATING_STATUS_CARD_CLASS} ${style.className}`;

  return (
    <Html
      position={[0, totalHeight + 0.46, 0]}
      center
      transform={fixedBannerSize}
      sprite={fixedBannerSize}
      distanceFactor={fixedBannerSize ? 4.8 : undefined}
      zIndexRange={OFFICE_HTML_Z.status}
      style={{
        backfaceVisibility: fixedBannerSize ? "hidden" : undefined,
        WebkitBackfaceVisibility: fixedBannerSize ? "hidden" : undefined,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div className={containerClassName}>
        {displayTitle ? <div className={TITLE_TEXT_CLASS}>{displayTitle}</div> : null}
        <div className={displayTitle ? `mt-1 ${ACTIVITY_ROW_CLASS}` : ACTIVITY_ROW_CLASS}>
          <span className="shrink-0 truncate uppercase tracking-[0.08em] text-[9px] opacity-80">
            {displayLabel}
          </span>
          {showDetail ? (
            <span className="min-w-0 truncate text-[10px] font-medium opacity-70">
              {detail?.trim()}
            </span>
          ) : null}
        </div>
        {persistenceTag ? (
          <div className="mt-1.5 border-t border-current/15 pt-1.5 leading-none">
            <EmployeePersistenceLabel tag={persistenceTag} />
          </div>
        ) : null}
        {focused && capabilityProfileLabel ? (
          <div className="mt-1.5">
            <AccessProfilePill label={capabilityProfileLabel} />
          </div>
        ) : null}
      </div>
    </Html>
  );
}

function ActivitySignalCard({
  children,
  stacked = false,
}: {
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={ACTIVITY_SIGNAL_CARD_CLASS}>
      <span className="pointer-events-none absolute inset-0 bg-white/[0.04]" />
      <span className="pointer-events-none absolute -left-[3px] top-[10px] h-1.5 w-1.5 rotate-45 border-b border-l border-emerald-900/15 bg-white/88" />
      <div className="relative z-10 flex items-start gap-1">
        <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-emerald-700/70" />
        <div className={stacked ? ACTIVITY_SIGNAL_STACK_TEXT_CLASS : ACTIVITY_SIGNAL_TEXT_CLASS}>
          {children}
        </div>
      </div>
    </div>
  );
}

function formatPresenceTimeLeft(expiresAt: number | undefined, now: number): string | null {
  if (!expiresAt || !Number.isFinite(expiresAt)) return null;
  const remainingMs = Math.max(0, expiresAt - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds <= 0) return "poofing now";
  if (totalSeconds < 60) return `poofs in ${totalSeconds}s`;
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `poofs in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `poofs in ${hours}h ${restMinutes}m` : `poofs in ${hours}h`;
}

function usePresenceTimeLeft(expiresAt: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return formatPresenceTimeLeft(expiresAt, now);
}

export const EmployeeStatusBubbles = memo(function EmployeeStatusBubbles({
  statusMessage,
  activityState,
  activityLabel,
  activityDetail,
  isHovered,
  isHighlighted,
  name,
  jobTitle,
  team,
  capabilityProfileLabel,
  totalHeight,
  debugMode,
  debugDeskDecision,
  onboardingPrompt,
  useCompactOverlayMode = false,
  pinReadyActivity = false,
  skillInvocationLabel,
  bubbleMessages,
  presenceExpiresAt,
  persistenceTag,
}: EmployeeStatusBubblesProps) {
  const presenceTimeLeft = usePresenceTimeLeft(presenceExpiresAt);
  const showRichEmployeeLabels = !useCompactOverlayMode;
  const visibleBubbleMessages = (bubbleMessages ?? [])
    .filter((message) => message.message.trim().length > 0)
    .slice(0, 2);
  const hasActivityText = Boolean(activityLabel?.trim() || activityDetail?.trim());
  const hasActivityBadge =
    typeof activityState === "string" && (activityState !== "idle" || hasActivityText);
  const showPinnedReadyBadge = pinReadyActivity && activityState === "done";
  const showBubbleMessageStack = visibleBubbleMessages.length > 1;
  const invocationLabel =
    visibleBubbleMessages.length === 1
      ? visibleBubbleMessages[0]?.message.trim()
      : skillInvocationLabel?.trim();
  const showActivityBadge =
    !invocationLabel &&
    !showBubbleMessageStack &&
    hasActivityBadge &&
    (isHovered || isHighlighted || showPinnedReadyBadge);
  const showRichHoverLabel =
    showRichEmployeeLabels &&
    !invocationLabel &&
    !showBubbleMessageStack &&
    !showActivityBadge &&
    (isHovered || isHighlighted);
  const richLabelOffset = showActivityBadge ? 0.86 : 0.5;
  const onboardingOffset = showActivityBadge ? 1.28 : 1.05;
  const bubbleOffset = 0.08;

  return (
    <>
      {invocationLabel ? (
        <Html
          position={[0, totalHeight + bubbleOffset, 0]}
          center
          transform
          sprite
          distanceFactor={4.8}
          zIndexRange={OFFICE_HTML_Z.status}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-150">
            <ActivitySignalCard>
              <span className="line-clamp-1 whitespace-normal break-words">{invocationLabel}</span>
            </ActivitySignalCard>
          </div>
        </Html>
      ) : null}

      {showBubbleMessageStack ? (
        <Html
          position={[0, totalHeight + bubbleOffset, 0]}
          center
          transform
          sprite
          distanceFactor={4.8}
          zIndexRange={OFFICE_HTML_Z.status}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-150">
            <ActivitySignalCard stacked>
              {visibleBubbleMessages.map((message) => (
                <div
                  key={`${message.threadId}:${message.eventAt}`}
                  className={BUBBLE_MESSAGE_ROW_CLASS}
                >
                  {message.message}
                </div>
              ))}
            </ActivitySignalCard>
          </div>
        </Html>
      ) : null}

      {showActivityBadge ? (
        <EmployeeActivityBadge
          state={activityState}
          label={activityLabel}
          detail={activityDetail ?? statusMessage}
          title={name}
          focused={isHovered || isHighlighted}
          totalHeight={totalHeight}
          compact={useCompactOverlayMode}
          fixedBannerSize={showPinnedReadyBadge}
          persistenceTag={persistenceTag}
          capabilityProfileLabel={capabilityProfileLabel}
        />
      ) : null}

      {showRichHoverLabel ? (
        <Html
          position={[0, totalHeight + richLabelOffset, 0]}
          center
          zIndexRange={OFFICE_HTML_Z.label}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-3 py-1.5 rounded-md text-xs font-medium shadow-lg whitespace-nowrap ${
                isHighlighted
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "border border-border bg-background/95 text-foreground"
              }`}
            >
              <div className="font-semibold">{name}</div>
              {jobTitle ? <div className="mt-0.5 text-[10px] opacity-80">{jobTitle}</div> : null}
              {team ? <div className="mt-0.5 text-[10px] opacity-60">{team}</div> : null}
              {capabilityProfileLabel ? (
                <div className="mt-1">
                  <AccessProfilePill label={capabilityProfileLabel} />
                </div>
              ) : null}
              {presenceTimeLeft ? (
                <div className="mt-1 border-t border-current/20 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
                  {presenceTimeLeft}
                </div>
              ) : null}
              {persistenceTag ? (
                <div className="mt-1 border-t border-current/20 pt-1">
                  <EmployeePersistenceLabel tag={persistenceTag} />
                </div>
              ) : null}
            </div>
          </div>
        </Html>
      ) : null}

      {persistenceTag && !showActivityBadge && !showRichHoverLabel ? (
        <Html
          position={[0, totalHeight + 0.34, 0]}
          center
          transform
          sprite
          distanceFactor={4.8}
          zIndexRange={OFFICE_HTML_Z.status}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div className="rounded-sm border border-stone-300/70 bg-white/92 px-2 py-1 shadow-md backdrop-blur-sm">
            <EmployeePersistenceLabel tag={persistenceTag} />
          </div>
        </Html>
      ) : null}

      {showRichEmployeeLabels && onboardingPrompt ? (
        <Html
          position={[0, totalHeight + onboardingOffset, 0]}
          center
          zIndexRange={OFFICE_HTML_Z.label}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-full border border-primary/30 bg-background/95 px-3 py-1.5 text-xs font-semibold text-primary shadow-lg">
              {onboardingPrompt}
            </div>
          </div>
        </Html>
      ) : null}

      {showRichEmployeeLabels && debugMode && debugDeskDecision ? (
        <Html
          position={[0, totalHeight + 0.28, 0]}
          center
          zIndexRange={OFFICE_HTML_Z.debug}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="rounded bg-black/75 px-2 py-1 text-[10px] text-white shadow">
            {debugDeskDecision}
          </div>
        </Html>
      ) : null}
    </>
  );
});
