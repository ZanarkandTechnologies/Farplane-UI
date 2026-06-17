"use client";

import { memo, type ReactNode } from "react";
import { Html } from "@react-three/drei";

import type { EmployeeActivityState } from "@/modules/office/lib/types";

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
const THINKING_CLOUD_CLASS =
  "relative isolate flex min-h-[38px] w-[188px] max-w-[188px] items-center justify-center rounded-[24px] border border-cyan-100/70 bg-slate-950/94 px-4 py-2 text-center text-[12px] font-semibold leading-snug text-cyan-50 shadow-lg shadow-cyan-950/30 backdrop-blur";
const BUBBLE_MESSAGE_STACK_CLASS =
  "relative isolate flex w-[204px] max-w-[204px] flex-col gap-1 rounded-[24px] border border-cyan-100/70 bg-slate-950/94 px-4 py-2.5 text-[11px] font-semibold leading-snug text-cyan-50 shadow-lg shadow-cyan-950/30 backdrop-blur";
const BUBBLE_MESSAGE_ROW_CLASS = "line-clamp-2 whitespace-normal break-words leading-snug";
const THINKING_LOBE_CLASS =
  "pointer-events-none absolute -z-10 rounded-full border border-cyan-100/70 bg-slate-950/94";
const THINKING_DOT_CLASS = "pointer-events-none absolute rounded-full border border-cyan-100/70 bg-slate-950/94";

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
  totalHeight: number;
  debugMode: boolean;
  debugDeskDecision: string;
  onboardingPrompt?: string | null;
  useCompactOverlayMode?: boolean;
  pinReadyActivity?: boolean;
  skillInvocationLabel?: string;
  bubbleMessages?: Array<{ threadId: string; message: string; eventAt: number }>;
};

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
        className: "border-sky-300/70 bg-sky-950/90 text-sky-50 shadow-sky-950/30",
      };
    case "waiting":
      return {
        label: "Waiting",
        className: "border-amber-300/70 bg-amber-950/90 text-amber-50 shadow-amber-950/30",
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-rose-300/70 bg-rose-950/90 text-rose-50 shadow-rose-950/30",
      };
    case "review":
      return {
        label: "Review",
        className: "border-violet-300/70 bg-violet-950/90 text-violet-50 shadow-violet-950/30",
      };
    case "done":
      return {
        label: "Done",
        className: "border-emerald-300/70 bg-emerald-950/90 text-emerald-50 shadow-emerald-950/30",
      };
    default:
      return {
        label: "Idle",
        className: "border-slate-300/70 bg-slate-950/90 text-slate-50 shadow-slate-950/30",
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
}: {
  state: EmployeeActivityState;
  label?: string;
  detail?: string;
  title: string;
  focused: boolean;
  totalHeight: number;
  compact: boolean;
  fixedBannerSize: boolean;
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
      zIndexRange={[110, 0]}
      style={{
        backfaceVisibility: fixedBannerSize ? "hidden" : undefined,
        WebkitBackfaceVisibility: fixedBannerSize ? "hidden" : undefined,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div className={containerClassName}>
        {displayTitle ? (
          <div className={TITLE_TEXT_CLASS}>{displayTitle}</div>
        ) : null}
        <div
          className={displayTitle ? `mt-1 ${ACTIVITY_ROW_CLASS}` : ACTIVITY_ROW_CLASS}
        >
          <span className="shrink-0 truncate uppercase tracking-[0.08em] text-[9px] opacity-80">
            {displayLabel}
          </span>
          {showDetail ? (
            <span className="min-w-0 truncate text-[10px] font-medium opacity-70">
              {detail?.trim()}
            </span>
          ) : null}
        </div>
      </div>
    </Html>
  );
}

function ThoughtCloud({
  children,
  stacked = false,
}: {
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? BUBBLE_MESSAGE_STACK_CLASS : THINKING_CLOUD_CLASS}>
      <span className={`${THINKING_LOBE_CLASS} -top-2 left-8 h-7 w-9`} />
      <span className={`${THINKING_LOBE_CLASS} -top-3 left-[70px] h-8 w-12`} />
      <span className={`${THINKING_LOBE_CLASS} -top-1 right-7 h-7 w-9`} />
      <span className={`${THINKING_LOBE_CLASS} -bottom-1 left-5 h-6 w-8`} />
      <span className={`${THINKING_LOBE_CLASS} -bottom-1 right-6 h-6 w-8`} />
      <span className="relative z-10 contents">{children}</span>
      <span className={`${THINKING_DOT_CLASS} -bottom-2.5 left-[48%] h-2.5 w-2.5`} />
      <span className={`${THINKING_DOT_CLASS} -bottom-5 left-[42%] h-1.5 w-1.5 opacity-90`} />
    </div>
  );
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
  totalHeight,
  debugMode,
  debugDeskDecision,
  onboardingPrompt,
  useCompactOverlayMode = false,
  pinReadyActivity = false,
  skillInvocationLabel,
  bubbleMessages,
}: EmployeeStatusBubblesProps) {
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
    visibleBubbleMessages.length === 1 ? visibleBubbleMessages[0]?.message.trim() : skillInvocationLabel?.trim();
  const showActivityBadge =
    !invocationLabel &&
    !showBubbleMessageStack &&
    hasActivityBadge &&
    (isHovered || isHighlighted || showPinnedReadyBadge);
  const richLabelOffset = showActivityBadge ? 0.86 : 0.5;
  const onboardingOffset = showActivityBadge ? 1.28 : 1.05;
  const bubbleOffset = 0.22;

  return (
    <>
      {invocationLabel ? (
        <Html
          position={[0, totalHeight + bubbleOffset, 0]}
          center
          zIndexRange={[115, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-150">
            <ThoughtCloud>
              <span className="line-clamp-2 whitespace-normal break-words">{invocationLabel}</span>
            </ThoughtCloud>
          </div>
        </Html>
      ) : null}

      {showBubbleMessageStack ? (
        <Html
          position={[0, totalHeight + bubbleOffset, 0]}
          center
          zIndexRange={[112, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-150">
            <ThoughtCloud stacked>
              {visibleBubbleMessages.map((message) => (
                <div key={`${message.threadId}:${message.eventAt}`} className={BUBBLE_MESSAGE_ROW_CLASS}>
                  {message.message}
                </div>
              ))}
            </ThoughtCloud>
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
        />
      ) : null}

      {showRichEmployeeLabels &&
      !invocationLabel &&
      !showBubbleMessageStack &&
      !showActivityBadge &&
      (isHovered || isHighlighted) ? (
        <Html
          position={[0, totalHeight + richLabelOffset, 0]}
          center
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-3 py-1.5 rounded-md text-xs font-medium shadow-lg whitespace-nowrap ${
                isHighlighted
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-foreground text-background"
              }`}
            >
              <div className="font-semibold">{name}</div>
              {jobTitle ? <div className="mt-0.5 text-[10px] opacity-80">{jobTitle}</div> : null}
              {team ? <div className="mt-0.5 text-[10px] opacity-60">{team}</div> : null}
            </div>
          </div>
        </Html>
      ) : null}

      {showRichEmployeeLabels && onboardingPrompt ? (
        <Html
          position={[0, totalHeight + onboardingOffset, 0]}
          center
          zIndexRange={[100, 0]}
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
          zIndexRange={[100, 0]}
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
