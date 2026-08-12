/** Adds an isolated, cache-first Farplane control to live YouTube video cards. */
import type { PlasmoCSConfig, PlasmoRender } from "plasmo";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";
import cssText from "data-text:./index.css";

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  all_frames: false,
};

type Analysis = {
  sourceStatus: string;
  sourceNote: string;
  clickbait: {
    answer: string;
    verdict: string;
    confidence: number;
    evidence: string[];
  };
  keyPoints: {
    finding: string;
    detail: string | null;
    timestamp: string | null;
  }[];
  recommendation: {
    decision: "WATCH" | "READ" | "SKIP";
    personalRelevance: number | null;
    contentQuality: number;
    reasonCode: string;
    rationale: string;
    matchedProfile: string[];
  };
};

type CardMount = {
  host: HTMLDivElement;
  root: Root;
  link: HTMLAnchorElement;
  thumbnail: HTMLElement;
  styleHost: HTMLElement;
  previousPosition: string | null;
  previousIsolation: string;
  previousZIndex: string;
};

const mounts = new Map<Element, CardMount>();
let previewGuardInstalled = false;
const selectors = [
  "ytd-rich-item-renderer",
  "ytd-rich-grid-media",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-playlist-video-renderer",
  "ytd-playlist-panel-video-renderer",
  "ytd-radio-renderer",
  "ytd-movie-renderer",
  "yt-lockup-view-model",
  ".yt-lockup-view-model",
].join(",");

function videoData(card: Element) {
  const link = thumbnailLink(card);
  if (!link) return null;
  const id = new URL(link.href).searchParams.get("v");
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const titleNode = card.querySelector<HTMLElement>(
    "#video-title, h3 a, a[title]",
  );
  const title =
    titleNode?.getAttribute("title") || titleNode?.textContent?.trim();
  return title ? { id, title } : null;
}

function currentChannelId(): string | undefined {
  const channelId = document
    .querySelector<HTMLMetaElement>('meta[itemprop="channelId"]')
    ?.content?.trim();
  return channelId && /^UC[A-Za-z0-9_-]{22}$/.test(channelId) ? channelId : undefined;
}

function thumbnailLink(card: Element) {
  return card.querySelector<HTMLAnchorElement>(
    'ytd-thumbnail a[href*="/watch?v="], a#thumbnail[href*="/watch?v="], a.ytLockupViewModelContentImage[href*="/watch?v="], a.yt-lockup-view-model__content-image[href*="/watch?v="], a[href*="/watch?v="]',
  );
}

function thumbnailMountTarget(card: Element) {
  const thumbnail =
    card.querySelector<HTMLElement>(
      "ytd-thumbnail, #thumbnail, .ytLockupViewModelContentImage, .yt-lockup-view-model__content-image",
    ) || (card as HTMLElement);
  let styleHost = thumbnail;
  let owningLink = styleHost.closest<HTMLAnchorElement>(
    'a[href*="/watch?v="]',
  );
  while (owningLink) {
    styleHost = owningLink.parentElement || (card as HTMLElement);
    owningLink = styleHost.closest<HTMLAnchorElement>('a[href*="/watch?v="]');
  }
  return { thumbnail, styleHost };
}

function positionControl(
  host: HTMLElement,
  thumbnail: HTMLElement,
  styleHost: HTMLElement,
) {
  const thumbnailRect = thumbnail.getBoundingClientRect();
  const styleHostRect = styleHost.getBoundingClientRect();
  host.style.top = `${Math.max(0, thumbnailRect.top - styleHostRect.top)}px`;
  host.style.right = `${Math.max(0, styleHostRect.right - thumbnailRect.right)}px`;
}

function pointerTargetsControl(event: Event) {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof HTMLElement &&
        target.dataset.farplaneControlHost === "true",
    );
}

function pauseYouTubePreview() {
  document
    .querySelectorAll<HTMLVideoElement>("#video-preview video")
    .forEach((video) => video.pause());
}

function guardControlPointer(event: Event) {
  const overControl = pointerTargetsControl(event);
  document.documentElement.toggleAttribute(
    "data-farplane-control-hover",
    overControl,
  );
  if (!overControl) return;
  pauseYouTubePreview();
  if (event.type !== "pointermove") event.stopImmediatePropagation();
}

function removeMount(card: Element, mount: CardMount) {
  mount.root.unmount();
  mount.host.remove();
  if (mount.previousPosition !== null) {
    mount.styleHost.style.position = mount.previousPosition;
  }
  mount.styleHost.style.isolation = mount.previousIsolation;
  mount.styleHost.style.zIndex = mount.previousZIndex;
  mounts.delete(card);
}

function mountCard(card: Element) {
  const existing = mounts.get(card);
  const parentCard = card.parentElement?.closest(selectors);
  if (parentCard && videoData(parentCard)) {
    if (existing) removeMount(card, existing);
    return;
  }
  const video = videoData(card);
  const link = thumbnailLink(card);
  const { thumbnail, styleHost } = thumbnailMountTarget(card);
  if (!video || !link) {
    if (existing) removeMount(card, existing);
    return;
  }
  if (existing?.host.isConnected) {
    if (
      existing.link === link &&
      existing.thumbnail === thumbnail &&
      existing.styleHost === styleHost
    ) {
      positionControl(existing.host, thumbnail, styleHost);
      return;
    }
    removeMount(card, existing);
  }
  if (existing && mounts.has(card)) removeMount(card, existing);
  const host = document.createElement("div");
  host.style.cssText =
    "position:absolute;top:0;right:0;z-index:3;pointer-events:auto";
  host.dataset.farplaneControlHost = "true";
  for (const eventName of [
    "pointerenter",
    "pointerover",
    "pointerdown",
    "mouseenter",
    "mouseover",
    "mousedown",
    "mouseup",
    "touchstart",
    "click",
    "dblclick",
  ]) {
    host.addEventListener(eventName, (event) => event.stopPropagation());
  }
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `${cssText}\n:host{--farplane-background:oklch(0.1635 0.0045 264.4427);--farplane-foreground:oklch(0.8717 0.0093 258.3382);--farplane-card:oklch(0.1993 0.0068 258.3682);--farplane-primary:oklch(0.598 0.0997 43.6627);--farplane-primary-foreground:oklch(0.1635 0.0045 264.4427);--farplane-muted:oklch(0.2346 0.0083 264.4038);--farplane-muted-foreground:oklch(0.7107 0.0351 256.7878);--farplane-accent:oklch(0.2431 0.0082 264.4119);--farplane-border:oklch(0.28 0.0102 260.7048);--farplane-destructive:oklch(0.7705 0.1129 17.3797)}.farplane-control{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}.farplane-control:hover:not(:disabled){background:var(--farplane-accent)!important;color:var(--farplane-foreground)!important}.farplane-control:focus-visible{outline:2px solid var(--farplane-primary);outline-offset:2px}@media(prefers-reduced-motion:reduce){.animate-spin{animation:none!important}}`;
  shadow.append(style);
  const node = document.createElement("div");
  shadow.append(node);
  const root = createRoot(node);
  let previousPosition: string | null = null;
  if (getComputedStyle(styleHost).position === "static") {
    previousPosition = styleHost.style.position;
    styleHost.style.position = "relative";
  }
  const previousIsolation = styleHost.style.isolation;
  const previousZIndex = styleHost.style.zIndex;
  styleHost.style.isolation = "isolate";
  positionControl(host, thumbnail, styleHost);
  styleHost.append(host);
  mounts.set(card, {
    host,
    root,
    link,
    thumbnail,
    styleHost,
    previousPosition,
    previousIsolation,
    previousZIndex,
  });
  root.render(
    <Overlay
      card={card}
      styleHost={styleHost}
      previousZIndex={previousZIndex}
    />,
  );
}

function scan() {
  for (const [card, mount] of mounts) {
    if (!card.isConnected) removeMount(card, mount);
  }
  document.querySelectorAll(selectors).forEach(mountCard);
}

let scanTimer: number | undefined;
function scheduleScan() {
  if (scanTimer !== undefined) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined;
    scan();
  }, 120);
}

export const render: PlasmoRender<null> = async () => {
  if (!previewGuardInstalled) {
    previewGuardInstalled = true;
    const previewGuard = document.createElement("style");
    previewGuard.id = "farplane-youtube-preview-guard";
    previewGuard.textContent =
      "html[data-farplane-control-hover] #video-preview{display:none!important}";
    (document.head || document.documentElement).append(previewGuard);
  }
  for (const eventName of [
    "pointerenter",
    "pointerover",
    "pointermove",
    "mouseenter",
    "mouseover",
  ]) {
    document.addEventListener(eventName, guardControlPointer, {
      capture: true,
      passive: true,
    });
  }
  scan();
  const observer = new MutationObserver(() => {
    if (document.documentElement.hasAttribute("data-farplane-control-hover")) {
      pauseYouTubePreview();
    }
    scheduleScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "title"],
  });
  window.addEventListener("scroll", scheduleScan, { passive: true });
  window.addEventListener("resize", scheduleScan, { passive: true });
  document.addEventListener("yt-navigate-finish", scheduleScan);
};

const stackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 9,
  pointerEvents: "auto",
};
const cornerButtonStyle = (
  status: "idle" | "loading" | "success" | "error",
  panelOpen: boolean,
): React.CSSProperties => ({
  appearance: "none",
  position: "relative",
  height: 36,
  minWidth: 104,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 0,
  border: "1px solid",
  borderColor:
    status === "error"
      ? "var(--farplane-destructive)"
      : status === "success" || status === "loading"
        ? "var(--farplane-primary)"
        : "var(--farplane-border)",
  background:
    status === "success" && panelOpen
      ? "var(--farplane-primary)"
      : status === "error"
        ? "var(--farplane-card)"
        : "var(--farplane-background)",
  color:
    status === "success" && panelOpen
      ? "var(--farplane-primary-foreground)"
      : status === "error"
        ? "var(--farplane-destructive)"
        : "var(--farplane-foreground)",
  cursor: status === "loading" ? "wait" : "pointer",
  boxShadow: "none",
  font: '700 10px/1 "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".06em",
});

function Overlay({
  card,
  styleHost,
  previousZIndex,
}: {
  card: Element;
  styleHost: HTMLElement;
  previousZIndex: string;
}) {
  const [boundVideoId, setBoundVideoId] = useState(
    () => videoData(card)?.id ?? "",
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [cached, setCached] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [reusedDossierId, setReusedDossierId] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const nextVideoId = videoData(card)?.id ?? "";
      if (nextVideoId === boundVideoId) return;
      setBoundVideoId(nextVideoId);
      setStatus("idle");
      setAnalysis(null);
      setError("");
      setPage(0);
      setCached(false);
      setThreadId("");
      setReusedDossierId("");
      setPanelOpen(false);
    };
    const observer = new MutationObserver(sync);
    observer.observe(card, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "title"],
    });
    return () => observer.disconnect();
  }, [boundVideoId, card]);

  useEffect(() => {
    if (!panelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [panelOpen]);

  useEffect(() => {
    styleHost.style.zIndex = panelOpen ? "4" : previousZIndex;
    return () => {
      styleHost.style.zIndex = previousZIndex;
    };
  }, [panelOpen, previousZIndex, styleHost]);

  async function run(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const video = videoData(card);
    if (!video) return;
    setStatus("loading");
    setPanelOpen(false);
    setError("");
    setThreadId("");
    setReusedDossierId("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ANALYZE_YOUTUBE",
        videoId: video.id,
        title: video.title,
        channelId: currentChannelId(),
      });
      if (!response?.ok) {
        setThreadId(response?.threadId || "");
        throw new Error(response?.error || "Analysis failed");
      }
      if (response.reused && !response.analysis) {
        setThreadId(response.threadId || "");
        setReusedDossierId(response.dossierId || "ready");
        setPage(0);
        setStatus("success");
        setPanelOpen(true);
        return;
      }
      setAnalysis(response.analysis);
      setThreadId(response.threadId);
      setCached(Boolean(response.cached));
      setPage(0);
      setStatus("success");
      setPanelOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed");
      setStatus("error");
      setPanelOpen(true);
    }
  }

  const panelId = `farplane-summary-${boundVideoId}`;
  if (status === "idle")
    return <ControlButton status={status} panelId={panelId} onClick={run} />;
  if (status === "loading")
    return <ControlButton status={status} panelId={panelId} />;
  if (status === "error")
    return (
      <div style={stackStyle} onClick={(event) => event.stopPropagation()}>
        <ControlButton
          status={status}
          panelId={panelId}
          panelOpen={panelOpen}
          onClick={run}
        />
        {panelOpen && (
          <div role="alert" style={panelStyle}>
            <button
              className="farplane-control"
              aria-label="Close error"
              style={closeStyle}
              onClick={() => setPanelOpen(false)}
            >
              <X aria-hidden="true" size={15} />
            </button>
            <strong style={{ color: "var(--farplane-destructive)" }}>
              Couldn’t analyze
            </strong>
            <p style={copyStyle}>{error}</p>
            <p style={copyStyle}>Click Analyze to try again.</p>
            <ThreadLink threadId={threadId} />
          </div>
        )}
      </div>
    );
  if (reusedDossierId)
    return (
      <div style={stackStyle} onClick={(event) => event.stopPropagation()}>
        <ControlButton
          status="success"
          panelId={panelId}
          panelOpen={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        />
        {panelOpen && (
          <div role="status" style={panelStyle}>
            <button
              className="farplane-control"
              aria-label="Close analysis status"
              style={closeStyle}
              onClick={() => setPanelOpen(false)}
            >
              <X aria-hidden="true" size={15} />
            </button>
            <strong>Already analyzed</strong>
            <p style={copyStyle}>
              This video is ready in Farplane Content Intelligence. Open that workspace to review its dossier and any reportable News coverage.
            </p>
            <ThreadLink threadId={threadId} />
          </div>
        )}
      </div>
    );
  if (!analysis) return null;

  const tabs = ["Answer", "Key points", "Worth it?"];
  return (
    <div style={stackStyle} onClick={(event) => event.stopPropagation()}>
      <ControlButton
        status={status}
        panelId={panelId}
        panelOpen={panelOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPanelOpen((open) => !open);
        }}
      />
      {panelOpen && <div id={panelId} aria-live="polite" style={panelStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <BrainCircuit
          aria-hidden="true"
          size={16}
          color="var(--farplane-primary)"
        />
        <strong style={{ fontSize: 13 }}>Farplane Quick Answer</strong>
        {cached && <span style={pillStyle}>cached</span>}
        <button
          className="farplane-control"
          aria-label="Close summary"
          style={closeStyle}
          onClick={() => setPanelOpen(false)}
        >
          <X aria-hidden="true" size={15} />
        </button>
      </div>
      <div
        role="tablist"
        aria-label="Summary sections"
        style={{ display: "flex", gap: 5, marginBottom: 14 }}
      >
        {tabs.map((tab, index) => (
          <button
            className="farplane-control"
            role="tab"
            aria-selected={page === index}
            key={tab}
            onClick={() => setPage(index)}
            style={{ ...tabStyle, ...(page === index ? activeTabStyle : {}) }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        style={{
          height: 145,
          overflowY: "auto",
          overscrollBehavior: "contain",
          paddingRight: 3,
        }}
      >
        {page === 0 && (
          <>
            <div style={verdictStyle}>
              {analysis.clickbait.verdict.replace("_", " ")}
            </div>
            <p style={leadStyle}>{analysis.clickbait.answer}</p>
            {analysis.clickbait.evidence.map((item) => (
              <p key={item} style={copyStyle}>
                • {item}
              </p>
            ))}
          </>
        )}
        {page === 1 &&
          (analysis.keyPoints.length ? (
            analysis.keyPoints.map((point, index) => (
              <div
                key={`${point.finding}-${index}`}
                style={{ marginBottom: 12 }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <span
                    style={{ color: "var(--farplane-primary)", fontWeight: 900 }}
                  >
                    {index + 1}
                  </span>
                  <strong style={{ fontSize: 12, lineHeight: 1.45 }}>
                    {point.finding}
                  </strong>
                </div>
                {point.detail && (
                  <p style={{ ...copyStyle, marginLeft: 19 }}>{point.detail}</p>
                )}
                {point.timestamp && (
                  <span style={{ ...pillStyle, marginLeft: 19 }}>
                    {point.timestamp}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p style={copyStyle}>No reliable key points were available.</p>
          ))}
        {page === 2 && (
          <>
            <div style={{ ...verdictStyle, fontSize: 20 }}>
              {analysis.recommendation.decision}
            </div>
            <p style={leadStyle}>{analysis.recommendation.rationale}</p>
            <p style={copyStyle}>
              Content quality:{" "}
              {Math.round(analysis.recommendation.contentQuality * 100)}%
              {analysis.recommendation.personalRelevance === null
                ? " · Profile unavailable"
                : ` · Relevance: ${Math.round(analysis.recommendation.personalRelevance * 100)}%`}
            </p>
            {analysis.recommendation.matchedProfile.map((item) => (
              <span key={item} style={{ ...pillStyle, marginRight: 5 }}>
                {item}
              </span>
            ))}
          </>
        )}
      </div>
      <div
        style={{
          borderTop: "1px solid var(--farplane-border)",
          marginTop: 12,
          paddingTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          className="farplane-control"
          aria-label="Previous section"
          disabled={page === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
          style={navStyle}
        >
          <ChevronLeft aria-hidden="true" size={15} />
        </button>
        <span
          style={{ fontSize: 10, color: "var(--farplane-muted-foreground)" }}
        >
          {analysis.sourceStatus.replaceAll("_", " ").toLowerCase()}
        </span>
        <button
          className="farplane-control"
          aria-label="Next section"
          disabled={page === 2}
          onClick={() => setPage((value) => Math.min(2, value + 1))}
          style={navStyle}
        >
          <ChevronRight aria-hidden="true" size={15} />
        </button>
      </div>
      <ThreadLink threadId={threadId} />
      </div>}
    </div>
  );
}

function ControlButton({
  status,
  panelId,
  panelOpen = false,
  onClick,
}: {
  status: "idle" | "loading" | "success" | "error";
  panelId: string;
  panelOpen?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const tooltip =
    status === "loading"
      ? "Analyzing video…"
      : status === "success"
        ? panelOpen
          ? "Close quick answer"
          : "Open quick answer"
        : status === "error"
          ? "Retry analysis"
          : "Analyze with Farplane";
  const label =
    status === "loading"
      ? "Analyzing"
      : status === "success"
        ? panelOpen
          ? "Close"
          : "Answer"
        : status === "error"
          ? "Retry"
          : "Analyze";
  return (
    <button
      className="farplane-control"
      type="button"
      aria-label={tooltip}
      aria-expanded={status === "success" ? panelOpen : undefined}
      aria-controls={status === "success" ? panelId : undefined}
      aria-live={status === "loading" ? "polite" : undefined}
      disabled={status === "loading"}
      style={cornerButtonStyle(status, panelOpen)}
      onClick={onClick}
    >
      {status === "loading" ? (
        <Loader2 aria-hidden="true" className="animate-spin" size={15} />
      ) : status === "error" ? (
        <CircleAlert aria-hidden="true" size={15} />
      ) : (
        <BrainCircuit aria-hidden="true" size={15} />
      )}
      {label}
      {status === "success" && (
        <ChevronDown
          aria-hidden="true"
          size={12}
          style={{ transform: panelOpen ? "rotate(180deg)" : undefined }}
        />
      )}
    </button>
  );
}

function ThreadLink({ threadId }: { threadId: string }) {
  if (!threadId) return null;
  return (
    <a
      aria-label="Open this summary task in Codex"
      href={`codex://threads/${encodeURIComponent(threadId)}`}
      onClick={(event) => event.stopPropagation()}
      style={threadLinkStyle}
    >
      <SquareArrowOutUpRight aria-hidden="true" size={13} /> Open Codex Task
    </a>
  );
}

const panelStyle: React.CSSProperties = {
  width: 340,
  boxSizing: "border-box",
  border: "1px solid var(--farplane-border)",
  borderLeft: "2px solid var(--farplane-primary)",
  borderRadius: 0,
  background: "var(--farplane-card)",
  color: "var(--farplane-foreground)",
  padding: 13,
  boxShadow: "none",
  fontFamily:
    '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".03em",
  overflowWrap: "anywhere",
};
const closeStyle: React.CSSProperties = {
  marginLeft: "auto",
  border: 0,
  background: "transparent",
  color: "var(--farplane-muted-foreground)",
  padding: 2,
  cursor: "pointer",
  display: "flex",
};
const copyStyle: React.CSSProperties = {
  color: "var(--farplane-muted-foreground)",
  fontSize: 11.5,
  lineHeight: 1.55,
  margin: "7px 0",
};
const leadStyle: React.CSSProperties = {
  color: "var(--farplane-foreground)",
  fontSize: 13,
  lineHeight: 1.55,
  margin: "8px 0 12px",
  fontWeight: 650,
};
const pillStyle: React.CSSProperties = {
  color: "var(--farplane-muted-foreground)",
  background: "var(--farplane-muted)",
  border: "1px solid var(--farplane-border)",
  borderRadius: 0,
  padding: "3px 7px",
  fontSize: 9,
  textTransform: "uppercase",
};
const verdictStyle: React.CSSProperties = {
  color: "var(--farplane-primary)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: ".12em",
};
const threadLinkStyle: React.CSSProperties = {
  color: "var(--farplane-primary)",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 10,
  fontWeight: 800,
  marginTop: 10,
  textDecoration: "none",
};
const tabStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid var(--farplane-border)",
  borderRadius: 0,
  padding: "7px 4px",
  background: "var(--farplane-background)",
  color: "var(--farplane-muted-foreground)",
  cursor: "pointer",
  font: '700 9px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".05em",
};
const activeTabStyle: React.CSSProperties = {
  borderColor: "var(--farplane-primary)",
  background: "var(--farplane-muted)",
  color: "var(--farplane-primary)",
};
const navStyle: React.CSSProperties = {
  border: "1px solid var(--farplane-border)",
  background: "transparent",
  color: "var(--farplane-muted-foreground)",
  cursor: "pointer",
  display: "flex",
  padding: 3,
};

export default Overlay;
