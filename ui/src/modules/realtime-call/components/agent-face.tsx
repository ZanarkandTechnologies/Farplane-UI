/**
 * Flat monitor-style realtime-agent face shared by call tiles and the profile inspector.
 * Configured colors and eyebrow geometry keep identity stable; LiveKit audio drives
 * only the mouth opening and activity border, with no simulated speaking state.
 */
import { useId } from "react";
import type { ProjectAgentProfile } from "../types";

const DEFAULT_APPEARANCE: NonNullable<ProjectAgentProfile["appearance"]> = {
  accent: "#718096",
  skinTone: "#c98f6b",
  hairColor: "#2d2523",
  eyebrows: "straight",
};

function eyebrowPaths(eyebrows: NonNullable<ProjectAgentProfile["appearance"]>["eyebrows"]): {
  left: string;
  right: string;
} {
  if (eyebrows === "arched") {
    return { left: "M29 54 Q50 39 69 52", right: "M91 52 Q110 39 131 54" };
  }
  if (eyebrows === "angled") {
    return { left: "M29 55 L69 44", right: "M91 44 L131 55" };
  }
  return { left: "M29 49 L69 49", right: "M91 49 L131 49" };
}

export function AgentFace({
  profile,
  isSpeaking = false,
  level = 0,
  className,
}: {
  profile: ProjectAgentProfile;
  isSpeaking?: boolean;
  level?: number;
  className?: string;
}): React.JSX.Element {
  const id = useId().replace(/:/g, "");
  const appearance = profile.appearance ?? DEFAULT_APPEARANCE;
  const brows = eyebrowPaths(appearance.eyebrows);
  const mouthHeight = Math.min(28, Math.max(13, 13 + level * 42));

  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      role="img"
      aria-label={`${profile.name || profile.agentId} avatar${isSpeaking ? ", speaking" : ""}`}
      data-face-style="monitor-flat"
      data-eyebrows={appearance.eyebrows}
      data-speaking={isSpeaking ? "true" : "false"}
    >
      <defs>
        <clipPath id={`${id}-screen-clip`}>
          <rect x="4" y="4" width="152" height="152" rx="14" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-screen-clip)`}>
        <rect x="4" y="4" width="152" height="152" fill={appearance.skinTone} />
        <path
          d="M4 4 H156 V35 Q132 27 109 33 Q79 43 52 34 Q27 26 4 38 Z"
          fill={appearance.hairColor}
        />
        <path
          d="M4 132 H156 V156 H4 Z"
          fill={appearance.accent}
        />
        <path d="M61 132 L80 148 L99 132" fill="#f8fafc" fillOpacity="0.92" />
      </g>
      <path
        d={brows.left}
        fill="none"
        stroke={appearance.hairColor}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={brows.right}
        fill="none"
        stroke={appearance.hairColor}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="51" cy="73" r="15" fill="#20212a" />
      <circle cx="109" cy="73" r="15" fill="#20212a" />
      <circle cx="46" cy="67" r="5" fill="#ffffff" fillOpacity="0.96" />
      <circle cx="104" cy="67" r="5" fill="#ffffff" fillOpacity="0.96" />
      <circle cx="57" cy="80" r="2" fill="#ffffff" fillOpacity="0.44" />
      <circle cx="115" cy="80" r="2" fill="#ffffff" fillOpacity="0.44" />
      {isSpeaking ? (
        <g>
          <rect
            x="50"
            y={110 - mouthHeight / 2}
            width="60"
            height={mouthHeight}
            rx={mouthHeight / 2}
            fill="#3a1722"
            stroke={appearance.hairColor}
            strokeWidth="2"
            style={{ transition: "height 80ms ease-out, y 80ms ease-out" }}
          />
          <path d="M56 104 Q80 114 104 104" fill="#f8fafc" />
          <path d="M59 116 Q80 128 101 116" fill="none" stroke="#ef8fa3" strokeWidth="5" />
        </g>
      ) : (
        <path
          d="M48 102 Q80 128 112 102 Q80 116 48 102 Z"
          fill="#ef8fa3"
          stroke={appearance.hairColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      <rect
        x="4"
        y="4"
        width="152"
        height="152"
        rx="14"
        fill="none"
        stroke={appearance.accent}
        strokeWidth={isSpeaking ? 6 : 3}
        strokeOpacity={isSpeaking ? 0.95 : 0.62}
      />
    </svg>
  );
}
