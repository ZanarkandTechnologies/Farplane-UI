/** Tabbed job activity and diagnostics surface for the local YouTube shortcut runtime. */
import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

type Health = {
  service: boolean;
  appServer: boolean;
  intelligestSkill: boolean;
  userProfile: boolean;
  userProfilePath: string;
};

type AnalysisJob = {
  id: string;
  videoId: string;
  title: string;
  status: "queued" | "running" | "succeeded" | "failed";
  threadId?: string;
  error?: string;
  progress?: {
    stage:
      | "queued"
      | "preparing"
      | "analyzing"
      | "persistence"
      | "complete"
      | "failed"
      | "needs_review";
    message: string;
    updatedAt: string;
  } | null;
  updatedAt: string;
};
type PopupTab = "jobs" | "status";

const startCommand = "corepack pnpm youtube:serve";

/** Popup status bypasses the worker so its startup cannot produce a false offline state. */
async function requestBridge<T>(path: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:47893${path}`, {
      method: "POST",
      headers: {
        "x-farplane-client": "youtube-shortcut",
        "x-farplane-request-id": `popup-${Date.now().toString(36)}`,
      },
      signal: controller.signal,
    });
    const payload = (await response.json()) as T & {
      ok?: unknown;
      error?: unknown;
    };
    if (!response.ok || payload.ok !== true) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : `Bridge returned HTTP ${response.status}.`,
      );
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function Popup() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [activeTab, setActiveTab] = useState<PopupTab>("jobs");

  async function refreshJobs() {
    try {
      const response = await requestBridge<{ jobs?: AnalysisJob[] }>(
        "/jobs",
        5_000,
      );
      if (Array.isArray(response.jobs)) setJobs(response.jobs);
    } catch {
      // Health owns the offline state; job polling stays silent.
    }
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await requestBridge<Health>(
        "/health",
        9_000,
      );
      setHealth(response);
      await refreshJobs();
    } catch (cause) {
      setHealth(null);
      setError(
        cause instanceof Error ? cause.message : "Local service unavailable",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyStartCommand() {
    try {
      await navigator.clipboard.writeText(startCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refreshJobs(), 1_500);
    return () => window.clearInterval(timer);
  }, []);

  const ready = Boolean(
    health?.service && health.appServer && health.intelligestSkill,
  );

  function handleTabKeyDown(event: React.KeyboardEvent, tab: PopupTab) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextTab = tab === "jobs" ? "status" : "jobs";
    setActiveTab(nextTab);
    document.getElementById(`${nextTab}-tab`)?.focus();
  }

  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <span style={logoStyle}>
          <BrainCircuit aria-hidden="true" size={19} strokeWidth={2.2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={eyebrowStyle}>FARPLANE</p>
          <h1 style={titleStyle}>YouTube Quick Answer</h1>
        </div>
        <button
          className="control icon-control"
          type="button"
          aria-label="Check runtime status"
          disabled={loading}
          onClick={refresh}
          style={iconButtonStyle}
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="spin" size={15} />
          ) : (
            <RefreshCw aria-hidden="true" size={15} />
          )}
        </button>
      </header>

      <nav aria-label="Popup sections" role="tablist" style={tabsStyle}>
        {(["jobs", "status"] as const).map((tab) => (
          <button
            id={`${tab}-tab`}
            key={tab}
            className="control tab-control"
            type="button"
            role="tab"
            aria-controls={`${tab}-panel`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, tab)}
            style={{
              ...tabStyle,
              color:
                activeTab === tab
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
              borderBottomColor:
                activeTab === tab ? "var(--primary)" : "transparent",
            }}
          >
            {tab === "jobs" ? "Jobs" : "Status"}
            {tab === "jobs" ? (
              <span style={tabCountStyle}>{jobs.length}</span>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  ...tabDotStyle,
                  background: ready
                    ? "var(--success)"
                    : loading
                      ? "var(--primary)"
                      : "var(--destructive-fg)",
                }}
              />
            )}
          </button>
        ))}
      </nav>

      <section
        id="jobs-panel"
        role="tabpanel"
        aria-labelledby="jobs-tab"
        aria-label="Recent analysis jobs"
        aria-live="polite"
        hidden={activeTab !== "jobs"}
        style={jobsStyle}
      >
          <div style={jobsHeaderStyle}>
            <div>
              <p style={jobsEyebrowStyle}>ACTIVITY</p>
              <h2 style={jobsTitleStyle}>Recent Jobs</h2>
            </div>
            <span style={jobsCountStyle}>{jobs.length}</span>
          </div>
          {loading ? (
            <div style={jobsLoadingStyle}>
              <span className="status-pulse" style={pulseStyle} />
              Loading jobs…
            </div>
          ) : error ? (
            <div style={emptyJobsStyle}>
              <p style={{ margin: 0 }}>Jobs are unavailable while Farplane is offline.</p>
              <button
                className="control retry-control"
                type="button"
                onClick={() => setActiveTab("status")}
                style={{ ...retryStyle, paddingLeft: 0 }}
              >
                Open Status
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <p style={emptyJobsStyle}>
              Analyze a thumbnail to start a Codex task.
            </p>
          ) : (
            <div style={jobsListStyle}>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
      </section>

      <div
        id="status-panel"
        role="tabpanel"
        aria-labelledby="status-tab"
        hidden={activeTab !== "status"}
      >
          {loading ? (
            <section aria-live="polite" style={loadingStyle}>
              <span className="status-pulse" style={pulseStyle} />
              Checking local runtime…
            </section>
          ) : error ? (
            <section aria-live="polite" style={offlineStyle}>
              <div style={stateHeaderStyle}>
                <span
                  style={{
                    ...stateDotStyle,
                    background: "var(--destructive-fg)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <h2 style={stateTitleStyle}>Runtime Offline</h2>
                  <p style={stateCopyStyle}>
                    Start Farplane locally, then check again.
                  </p>
                </div>
              </div>
              <button
                className="control command-control"
                type="button"
                aria-label={
                  copied
                    ? "Farplane runtime start command copied"
                    : "Copy the Farplane runtime start command"
                }
                onClick={() => void copyStartCommand()}
                style={commandStyle}
              >
                <code translate="no" style={commandTextStyle}>
                  {startCommand}
                </code>
                {copied ? (
                  <Check aria-hidden="true" size={15} color="var(--success)" />
                ) : (
                  <Copy aria-hidden="true" size={15} />
                )}
              </button>
              <div style={errorFooterStyle}>
                <span title={error} style={errorDetailStyle}>
                  {error}
                </span>
                <button
                  className="control retry-control"
                  type="button"
                  onClick={refresh}
                  style={retryStyle}
                >
                  Check Again
                </button>
              </div>
            </section>
          ) : (
            health && (
              <section
                aria-live="polite"
                style={{
                  ...readyStyle,
                  borderLeftColor: ready ? "var(--success)" : "var(--primary)",
                }}
              >
                <div style={{ ...stateHeaderStyle, padding: 13 }}>
                  <span
                    style={{
                      ...stateDotStyle,
                      background: ready ? "var(--success)" : "var(--primary)",
                    }}
                  />
                  <div>
                    <h2 style={stateTitleStyle}>
                      {ready ? "Runtime Ready" : "Setup Incomplete"}
                    </h2>
                    <p style={stateCopyStyle}>
                      {ready
                        ? "Quick answers are available on YouTube."
                        : "One or more required services needs attention."}
                    </p>
                  </div>
                </div>
                {!ready && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <button
                      className="control command-control"
                      type="button"
                      aria-label={
                        copied
                          ? "Farplane runtime start command copied"
                          : "Copy the Farplane runtime start command"
                      }
                      onClick={() => void copyStartCommand()}
                      style={commandStyle}
                    >
                      <code translate="no" style={commandTextStyle}>
                        {startCommand}
                      </code>
                      {copied ? (
                        <Check
                          aria-hidden="true"
                          size={15}
                          color="var(--success)"
                        />
                      ) : (
                        <Copy aria-hidden="true" size={15} />
                      )}
                    </button>
                  </div>
                )}
                <div style={statusListStyle}>
                  <StatusRow
                    label="Farplane bridge"
                    detail="127.0.0.1:47893"
                    ok={health.service}
                  />
                  <StatusRow
                    label="Codex app-server"
                    detail="127.0.0.1:47892"
                    ok={health.appServer}
                  />
                  <StatusRow
                    label="Intelligest skill"
                    detail={health.intelligestSkill ? "Available" : "Unavailable"}
                    ok={health.intelligestSkill}
                  />
                  <StatusRow
                    label="Personal profile"
                    detail={
                      health.userProfile
                        ? health.userProfilePath
                        : "Not configured"
                    }
                    ok={health.userProfile}
                    optional
                  />
                </div>
              </section>
            )
          )}
      </div>

      <footer style={footerStyle}>
        <span style={miniButtonStyle}>
          <BrainCircuit aria-hidden="true" size={13} />
        </span>
        <p style={footerCopyStyle}>
          Use Analyze on any YouTube thumbnail.
        </p>
      </footer>

      <style>{`
        /* Canonical Farplane dark tokens mirrored from ui/src/styles.css. */
        :root{
          color-scheme:dark;
          --background:oklch(0.1635 0.0045 264.4427);
          --foreground:oklch(0.8717 0.0093 258.3382);
          --card:oklch(0.1993 0.0068 258.3682);
          --primary:oklch(0.598 0.0997 43.6627);
          --primary-foreground:oklch(0.1635 0.0045 264.4427);
          --muted:oklch(0.2346 0.0083 264.4038);
          --muted-foreground:oklch(0.7107 0.0351 256.7878);
          --accent:oklch(0.2431 0.0082 264.4119);
          --border:oklch(0.28 0.0102 260.7048);
          --ring:oklch(0.598 0.0997 43.6627);
          --destructive:oklch(0.3958 0.1331 25.723);
          --destructive-fg:oklch(0.7705 0.1129 17.3797);
          --success:oklch(0.696 0.17 162.48);
        }
        *{box-sizing:border-box}
        body{margin:0;background:var(--background)}
        button{font:inherit;letter-spacing:inherit}
        .control{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}
        .control:hover:not(:disabled){background:var(--accent)!important;color:var(--foreground)!important}
        .control:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
        .control:disabled{cursor:wait;opacity:.6}
        .command-control:hover{border-color:var(--primary)!important}
        .retry-control:hover{background:transparent!important;color:var(--primary)!important}
        .tab-control:hover{background:var(--card)!important;color:var(--foreground)!important}
        .job-link{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background-color 120ms ease,color 120ms ease}
        .job-link:hover{background:var(--accent)!important}
        .job-link:focus-visible{outline:2px solid var(--ring);outline-offset:-2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{50%{opacity:.35;transform:scale(.82)}}
        .spin{animation:spin 1s linear infinite}.status-pulse{animation:pulse 1.2s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.spin,.status-pulse{animation:none}}
      `}</style>
    </main>
  );
}

function JobRow({ job }: { job: AnalysisJob }) {
  const running = job.status === "queued" || job.status === "running";
  const progressMessage = job.progress?.message;
  const content = (
    <>
      <span style={jobIconStyle}>
        {running ? (
          <Loader2 aria-hidden="true" className="spin" size={14} />
        ) : job.status === "succeeded" ? (
          <CheckCircle2 aria-hidden="true" size={14} />
        ) : (
          <XCircle aria-hidden="true" size={14} />
        )}
      </span>
      <span style={jobCopyStyle}>
        <span style={jobTitleStyle}>{job.title}</span>
        <span
          title={job.error || progressMessage}
          style={{
            ...jobMetaStyle,
            color:
              job.status === "failed"
                ? "var(--destructive-fg)"
                : "var(--muted-foreground)",
          }}
        >
          {job.status === "failed"
            ? job.error || progressMessage || "Analysis failed"
            : progressMessage ||
              (job.status === "queued"
                ? "Waiting to start"
                : job.status === "running"
                  ? "Codex is analyzing"
                  : "Answer ready")}
        </span>
      </span>
      {job.threadId && (
        <ExternalLink aria-hidden="true" size={13} style={{ opacity: 0.7 }} />
      )}
    </>
  );

  return job.threadId ? (
    <a
      className="job-link"
      href={`codex://threads/${job.threadId}`}
      title={`Open “${job.title}” in Codex`}
      style={jobRowStyle}
    >
      {content}
    </a>
  ) : (
    <div style={jobRowStyle}>{content}</div>
  );
}

function StatusRow({
  label,
  detail,
  ok,
  optional = false,
}: {
  label: string;
  detail: string;
  ok: boolean;
  optional?: boolean;
}) {
  return (
    <div style={statusRowStyle}>
      {ok ? (
        <CheckCircle2 aria-hidden="true" size={15} color="var(--success)" />
      ) : (
        <Circle
          aria-hidden="true"
          size={15}
          color={optional ? "var(--muted-foreground)" : "var(--destructive-fg)"}
        />
      )}
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowDetailStyle}>{detail}</span>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  width: 348,
  boxSizing: "border-box",
  margin: 0,
  overflowX: "hidden",
  padding: 12,
  background: "var(--background)",
  color: "var(--foreground)",
  fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".06em",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};
const logoStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  flex: "0 0 auto",
  border: "1px solid var(--primary)",
  borderRadius: 0,
  display: "grid",
  placeItems: "center",
  background: "var(--primary)",
  color: "var(--primary-foreground)",
};
const eyebrowStyle: React.CSSProperties = {
  margin: "0 0 2px",
  color: "var(--primary)",
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: ".18em",
};
const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--foreground)",
  fontSize: 13,
  lineHeight: 1.2,
  fontWeight: 700,
  letterSpacing: ".02em",
  textWrap: "balance",
};
const iconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--border)",
  borderRadius: 0,
  background: "var(--card)",
  color: "var(--muted-foreground)",
  cursor: "pointer",
};
const loadingStyle: React.CSSProperties = {
  minHeight: 112,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--muted-foreground)",
  fontSize: 10,
};
const pulseStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "var(--primary)",
};
const offlineStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderLeft: "2px solid var(--destructive-fg)",
  borderRadius: 0,
  background: "var(--card)",
  padding: 12,
};
const readyStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderLeftWidth: 2,
  borderLeftStyle: "solid",
  borderRadius: 0,
  background: "var(--card)",
  overflow: "hidden",
};
const stateHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  padding: "1px 1px 11px",
};
const stateDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  flex: "0 0 auto",
  borderRadius: 999,
  marginTop: 5,
};
const stateTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--foreground)",
  fontSize: 11,
  lineHeight: 1.3,
  fontWeight: 700,
  letterSpacing: ".05em",
};
const stateCopyStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "var(--muted-foreground)",
  fontSize: 9,
  lineHeight: 1.4,
};
const commandStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  border: "1px solid var(--border)",
  borderRadius: 0,
  background: "var(--background)",
  color: "var(--muted-foreground)",
  padding: "9px 10px",
  cursor: "pointer",
  transition: "background 120ms ease, border-color 120ms ease",
};
const commandTextStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "var(--primary)",
  font: '600 9px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const errorFooterStyle: React.CSSProperties = {
  minHeight: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 9,
};

const errorDetailStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "var(--muted-foreground)",
  font: '500 8px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const retryStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--foreground)",
  padding: "6px 0 6px 8px",
  cursor: "pointer",
  font: '700 9px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
};
const statusListStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border)",
};
const statusRowStyle: React.CSSProperties = {
  minHeight: 39,
  display: "grid",
  gridTemplateColumns: "16px minmax(0,1fr) auto",
  alignItems: "center",
  gap: 8,
  padding: "0 12px",
  borderBottom: "1px solid var(--border)",
};
const rowLabelStyle: React.CSSProperties = {
  minWidth: 0,
  color: "var(--foreground)",
  fontSize: 9,
  fontWeight: 600,
};
const rowDetailStyle: React.CSSProperties = {
  maxWidth: 142,
  overflow: "hidden",
  color: "var(--muted-foreground)",
  font: '500 8px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const tabsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  marginBottom: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
};
const tabStyle: React.CSSProperties = {
  minHeight: 38,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: 0,
  borderBottom: "2px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontSize: 9,
  fontWeight: 700,
};
const tabCountStyle: React.CSSProperties = {
  minWidth: 18,
  height: 18,
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--border)",
  color: "var(--muted-foreground)",
  fontSize: 7.5,
  fontVariantNumeric: "tabular-nums",
};
const tabDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
};
const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 13,
  padding: "0 2px",
};
const jobsStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--card)",
};
const jobsHeaderStyle: React.CSSProperties = {
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 12px",
  borderBottom: "1px solid var(--border)",
};
const jobsEyebrowStyle: React.CSSProperties = {
  margin: "0 0 2px",
  color: "var(--primary)",
  fontSize: 7.5,
  fontWeight: 700,
  letterSpacing: ".16em",
};
const jobsTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--foreground)",
  fontSize: 10,
  fontWeight: 700,
};
const jobsCountStyle: React.CSSProperties = {
  minWidth: 21,
  height: 21,
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--border)",
  color: "var(--muted-foreground)",
  fontSize: 8,
  fontVariantNumeric: "tabular-nums",
};
const emptyJobsStyle: React.CSSProperties = {
  margin: 0,
  padding: 13,
  color: "var(--muted-foreground)",
  fontSize: 8.5,
  lineHeight: 1.5,
};
const jobsLoadingStyle: React.CSSProperties = {
  minHeight: 72,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "var(--muted-foreground)",
  fontSize: 8.5,
};
const jobsListStyle: React.CSSProperties = {
  maxHeight: 188,
  overflowY: "auto",
};
const jobRowStyle: React.CSSProperties = {
  minHeight: 52,
  display: "grid",
  gridTemplateColumns: "20px minmax(0,1fr) 14px",
  alignItems: "center",
  gap: 8,
  padding: "8px 11px",
  borderBottom: "1px solid var(--border)",
  color: "var(--foreground)",
  textDecoration: "none",
};
const jobIconStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  display: "grid",
  placeItems: "center",
  color: "var(--primary)",
};
const jobCopyStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
};
const jobTitleStyle: React.CSSProperties = {
  overflow: "hidden",
  color: "var(--foreground)",
  fontSize: 9,
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const jobMetaStyle: React.CSSProperties = {
  overflow: "hidden",
  fontSize: 7.5,
  textOverflow: "ellipsis",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};
const miniButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--primary)",
  borderRadius: 0,
  background: "color-mix(in oklch, var(--primary) 12%, var(--background))",
  color: "var(--primary)",
};
const footerCopyStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--muted-foreground)",
  fontSize: 8.5,
  lineHeight: 1.4,
};
