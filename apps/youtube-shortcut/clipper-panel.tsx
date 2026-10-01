/**
 * Save to Farplane: clip the current tab like a web clipper. Take a snapshot (or just a note), then add
 * only the fields you want: who it is useful for (@ your Wiki's people and problems), why it's good, and
 * an instruction handed to a new intelligest thread. Saves through the local bridge to the Resource Bank in Convex.
 */
import { Camera, Check, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { YOUTUBE_BRIDGE_URL, YOUTUBE_RUNTIME_CLIENT, YOUTUBE_RUNTIME_CLIENT_HEADER } from "./local-runtime.js";

type Mention = { ref: string; label: string; kind: string };
type Field = "usefulFor" | "why" | "instruction";

async function postBridge<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${YOUTUBE_BRIDGE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [YOUTUBE_RUNTIME_CLIENT_HEADER]: YOUTUBE_RUNTIME_CLIENT,
      "x-farplane-request-id": `clip-${Date.now().toString(36)}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok !== true) throw new Error(payload.error ?? `Bridge returned HTTP ${response.status}.`);
  return payload;
}

const FIELD_LABEL: Record<Field, string> = { usefulFor: "Useful later for", why: "Why it's good", instruction: "Instruction" };

export function ClipperPanel({ hidden }: { hidden: boolean }) {
  const [tab, setTab] = useState<{ url: string; title: string } | null>(null);
  const [mode, setMode] = useState<"snapshot" | "note">("snapshot");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [picked, setPicked] = useState<Mention[]>([]);
  const [query, setQuery] = useState("");
  const [why, setWhy] = useState("");
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
      const active = tabs[0];
      if (active?.url?.startsWith("http")) setTab({ url: active.url, title: active.title ?? "" });
    });
    void postBridge<{ options: Mention[] }>("/library/entities", {})
      .then((payload) => setMentions(payload.options))
      .catch(() => setMentions([]));
  }, []);

  const matches = useMemo(() => {
    const needle = query.replace(/^@/, "").trim().toLowerCase();
    if (!needle) return [];
    return mentions
      .filter((option) => !picked.some((item) => item.ref === option.ref))
      .filter((option) => option.label.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [mentions, picked, query]);

  async function capture() {
    setMessage("");
    try {
      setSnapshot(await chrome.tabs.captureVisibleTab({ format: "png" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not capture this tab.");
    }
  }

  async function save() {
    if (!tab) return;
    setState("saving");
    setMessage("");
    try {
      const result = await postBridge<{ threadId: string | null }>("/library/save", {
        url: tab.url,
        title: tab.title,
        snapshot: mode === "snapshot" && snapshot ? snapshot : undefined,
        usefulFor: fields.includes("usefulFor") ? picked.map((item) => item.ref) : [],
        why: fields.includes("why") && why.trim() ? why.trim() : undefined,
        instruction: fields.includes("instruction") && instruction.trim() ? instruction.trim() : undefined,
      });
      setState("saved");
      setMessage(`Saved to the Resource Bank${result.threadId ? " · intelligest thread started" : ""}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  const toggle = (field: Field) =>
    setFields((current) => (current.includes(field) ? current.filter((item) => item !== field) : [...current, field]));

  return (
    <section id="save-panel" role="tabpanel" aria-labelledby="save-tab" hidden={hidden} style={{ display: hidden ? "none" : "grid", gap: 10, paddingTop: 10 }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)", overflowWrap: "anywhere" }}>
        {tab ? tab.title || tab.url : "Open a web page to save it."}
      </p>
      <div style={{ display: "flex", border: "1px solid var(--border)" }}>
        {(["snapshot", "note"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="control"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            style={{ ...segmentStyle, background: mode === value ? "var(--card)" : "transparent", color: mode === value ? "var(--foreground)" : "var(--muted-foreground)" }}
          >
            {value === "snapshot" ? "Snapshot + note" : "Note only"}
          </button>
        ))}
      </div>
      {mode === "snapshot" ? (
        snapshot ? (
          <div style={{ position: "relative" }}>
            <img src={snapshot} alt="Snapshot of this tab" style={{ width: "100%", maxHeight: 140, objectFit: "cover", objectPosition: "top", border: "1px solid var(--border)" }} />
            <button type="button" className="control" aria-label="Retake snapshot" onClick={capture} style={{ ...chipStyle, position: "absolute", right: 6, bottom: 6, background: "var(--background)" }}>
              <Camera size={12} aria-hidden="true" /> Retake
            </button>
          </div>
        ) : (
          <button type="button" className="control" onClick={capture} disabled={!tab} style={{ ...chipStyle, justifyContent: "center", padding: "10px 0" }}>
            <Camera size={14} aria-hidden="true" /> Take snapshot of the visible area
          </button>
        )
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(Object.keys(FIELD_LABEL) as Field[]).map((field) => (
          <button
            key={field}
            type="button"
            className="control"
            aria-pressed={fields.includes(field)}
            onClick={() => toggle(field)}
            style={{ ...chipStyle, borderRadius: 999, background: fields.includes(field) ? "var(--foreground)" : "transparent", color: fields.includes(field) ? "var(--background)" : "var(--muted-foreground)" }}
          >
            {fields.includes(field) ? <Check size={11} aria-hidden="true" /> : <Plus size={11} aria-hidden="true" />} {FIELD_LABEL[field]}
          </button>
        ))}
      </div>
      {fields.includes("usefulFor") ? (
        <label style={labelStyle}>
          Useful later for
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 6, border: "1px solid var(--border)", background: "var(--card)" }}>
            {picked.map((item) => (
              <span key={item.ref} style={{ ...chipStyle, background: "color-mix(in oklch, var(--primary) 24%, transparent)", borderColor: "var(--primary)" }}>
                @{item.label}
                <button type="button" aria-label={`Remove ${item.label}`} onClick={() => setPicked((current) => current.filter((value) => value.ref !== item.ref))} style={bareStyle}>
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="@ a person or problem" style={{ ...inputStyle, flex: 1, minWidth: 120, border: "none", padding: 2 }} />
          </div>
          {matches.length ? (
            <div role="listbox" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              {matches.map((option) => (
                <button
                  key={option.ref}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="control"
                  onClick={() => {
                    setPicked((current) => [...current, option]);
                    setQuery("");
                  }}
                  style={{ ...bareStyle, display: "flex", gap: 8, width: "100%", padding: "6px 8px", textAlign: "left", fontSize: 11 }}
                >
                  <span style={{ color: "var(--muted-foreground)", width: 52 }}>{option.kind}</span>
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </label>
      ) : null}
      {fields.includes("why") ? (
        <label style={labelStyle}>
          Why it's good
          <textarea value={why} onChange={(event) => setWhy(event.target.value)} rows={3} placeholder="Your taste note: what makes this worth keeping" style={inputStyle} />
        </label>
      ) : null}
      {fields.includes("instruction") ? (
        <label style={labelStyle}>
          Instruction · runs in a new thread
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={2} placeholder="e.g. /intelligest this, then add the playbook to lead-scout" style={inputStyle} />
        </label>
      ) : null}
      <button type="button" className="control" disabled={!tab || state === "saving"} onClick={() => void save()} style={saveStyle}>
        {state === "saving" ? <Loader2 size={13} className="spin" aria-hidden="true" /> : null}
        {fields.includes("instruction") && instruction.trim() ? "Save + start thread" : "Save"}
      </button>
      {message ? (
        <p role="status" style={{ margin: 0, fontSize: 11, color: state === "error" ? "var(--destructive-fg)" : "var(--success)" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}

const segmentStyle: React.CSSProperties = { flex: 1, padding: "7px 0", border: "none", font: "inherit", fontSize: 11, cursor: "pointer" };
const chipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", border: "1px solid var(--border)", font: "inherit", fontSize: 11, color: "var(--foreground)", background: "transparent", cursor: "pointer" };
const bareStyle: React.CSSProperties = { border: "none", background: "transparent", color: "inherit", font: "inherit", cursor: "pointer", padding: 0 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 4, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--muted-foreground)" };
const inputStyle: React.CSSProperties = { font: "inherit", fontSize: 12, textTransform: "none", letterSpacing: 0, color: "var(--foreground)", background: "var(--card)", border: "1px solid var(--border)", padding: 6, resize: "vertical" };
const saveStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", border: "none", background: "var(--primary)", color: "var(--primary-foreground)", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" };
