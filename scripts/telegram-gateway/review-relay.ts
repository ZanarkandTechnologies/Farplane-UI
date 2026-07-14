/**
 * Phone Chaser review relay owned by the Telegram gateway.
 *
 * Inputs: local review bindings, bearer-scoped webhook submissions, and Codex
 * delivery config. Outputs: one validated Codex user turn or retry receipt.
 * Side effects: writes local gateway state and may call the Codex app-server.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { sendCodexMessage } from "./codex-exec";
import { isRetryableCodexDeliveryError } from "./routing";
import {
  appendHistory,
  markReviewRelayBindingUsed,
  queuePendingMessage,
  recordReviewRelayBinding,
  recordReviewRelayReceipt,
} from "./state";
import type {
  ReviewRelayBinding,
  ReviewRelayDecision,
  TelegramGatewayConfig,
  TelegramGatewayState,
} from "./types";

const MAX_BODY_BYTES = 8192;
const MAX_REASON_CHARS = 500;
const DEFAULT_EXPIRY_MS = 1000 * 60 * 60 * 24;
const DECISIONS = new Set<ReviewRelayDecision>(["approve", "revise", "reject"]);

type CodexDeliveryImpl = (input: {
  threadId: string;
  text: string;
  appServerUrl?: string;
  responseTimeoutMs?: number;
}) => Promise<{ turnId?: string; responseText?: string }>;

export type ReviewRelayBindingResult = {
  state: TelegramGatewayState;
  reviewId: string;
  capability: string;
  expiresAt: number;
};

export type ReviewRelaySubmitResult = {
  state: TelegramGatewayState;
  ok: boolean;
  status: "delivered" | "queued" | "rejected";
  idempotent?: boolean;
  error?: string;
  turnId?: string;
};

export function createReviewRelayBinding(input: {
  state: TelegramGatewayState;
  threadId: string;
  title?: string;
  cycle?: string;
  now?: number;
  ttlMs?: number;
  reviewId?: string;
  capability?: string;
}): ReviewRelayBindingResult {
  const now = input.now ?? Date.now();
  const reviewId = input.reviewId ?? `review_${randomBytes(12).toString("hex")}`;
  const capability = input.capability ?? `fp_review_${randomBytes(24).toString("base64url")}`;
  const binding: ReviewRelayBinding = {
    reviewId,
    capabilityHash: hashSecret(capability),
    threadId: requireBoundedString(input.threadId, "thread_id", 200),
    title: boundedOptional(input.title, 160),
    createdAt: now,
    expiresAt: now + (input.ttlMs ?? DEFAULT_EXPIRY_MS),
    cycle: boundedOptional(input.cycle, 120) ?? "review",
  };
  return {
    state: recordReviewRelayBinding(input.state, binding),
    reviewId,
    capability,
    expiresAt: binding.expiresAt,
  };
}

export async function submitReviewRelayResponse(input: {
  state: TelegramGatewayState;
  config: TelegramGatewayConfig;
  reviewId: string;
  capability: string;
  decision: string;
  reason: string;
  idempotencyKey: string;
  now?: number;
  codexImpl?: CodexDeliveryImpl;
}): Promise<ReviewRelaySubmitResult> {
  const now = input.now ?? Date.now();
  const reviewId = requireBoundedString(input.reviewId, "review_id", 120);
  const idempotencyKey = requireBoundedString(input.idempotencyKey, "idempotency_key", 160);
  const existingReceipt = input.state.reviewReceipts.find(
    (receipt) => receipt.reviewId === reviewId && receipt.idempotencyKey === idempotencyKey,
  );
  const decision = normalizeDecision(input.decision);
  const reason = requireBoundedString(input.reason, "reason", MAX_REASON_CHARS);

  if (existingReceipt) {
    if (existingReceipt.decision !== decision || existingReceipt.reason !== reason) {
      return reject(input.state, reviewId, idempotencyKey, decision, reason, "idempotency_key_conflict", now);
    }
    return {
      state: input.state,
      ok: existingReceipt.status !== "rejected",
      status: existingReceipt.status,
      idempotent: true,
      error: existingReceipt.error,
      turnId: existingReceipt.turnId,
    };
  }

  const binding = input.state.reviewBindings.find((candidate) => candidate.reviewId === reviewId);
  if (!binding) return reject(input.state, reviewId, idempotencyKey, decision, reason, "unknown_review_id", now);
  if (binding.expiresAt < now) return reject(input.state, reviewId, idempotencyKey, decision, reason, "review_expired", now);
  if (binding.usedAt) return reject(input.state, reviewId, idempotencyKey, decision, reason, "review_already_used", now);
  if (binding.capabilityHash !== hashSecret(input.capability)) {
    return reject(input.state, reviewId, idempotencyKey, decision, reason, "invalid_capability", now);
  }

  const promptText = buildReviewResponsePrompt({ binding, decision, reason, idempotencyKey });
  const sent = await sendCodexMessage({
    threadId: binding.threadId,
    text: promptText,
    // Review responses must resume the visible Codex task. The local app-server
    // turn/start path can record user-only turns in this environment, so the
    // relay uses the Codex CLI resume backend while still keeping all thread
    // resolution inside the trusted gateway.
    responseTimeoutMs: input.config.responseTimeoutMs,
    codexImpl: input.codexImpl,
  });

  if (!sent.ok && isRetryableCodexDeliveryError(sent.error)) {
    let nextState = queuePendingMessage(input.state, {
      telegramMessageId: stableNumericId(`${reviewId}:${idempotencyKey}`),
      chatId: `review:${reviewId}`,
      text: reason,
      promptText,
      route: "review_relay",
      threadId: binding.threadId,
      title: binding.title,
      reviewId,
      reviewDecision: decision,
      reviewReason: reason,
      idempotencyKey,
      lastError: sent.error,
      lastAttemptAt: now,
    });
    nextState = markReviewRelayBindingUsed(nextState, reviewId, now);
    nextState = recordReviewRelayReceipt(nextState, {
      reviewId,
      idempotencyKey,
      decision,
      reason,
      status: "queued",
      error: sent.error,
      occurredAt: now,
    });
    nextState = appendHistory(nextState, {
      telegramMessageId: stableNumericId(`${reviewId}:${idempotencyKey}`),
      chatId: `review:${reviewId}`,
      direction: "inbound",
      text: promptText,
      route: "source_thread",
      threadId: binding.threadId,
      status: "queued",
      error: sent.error,
      occurredAt: now,
    });
    return { state: nextState, ok: true, status: "queued", error: sent.error };
  }

  if (!sent.ok) return reject(input.state, reviewId, idempotencyKey, decision, reason, sent.error ?? "codex_send_failed", now);

  let nextState = markReviewRelayBindingUsed(input.state, reviewId, now);
  nextState = recordReviewRelayReceipt(nextState, {
    reviewId,
    idempotencyKey,
    decision,
    reason,
    status: "delivered",
    turnId: sent.turnId,
    occurredAt: now,
  });
  nextState = appendHistory(nextState, {
    telegramMessageId: stableNumericId(`${reviewId}:${idempotencyKey}`),
    chatId: `review:${reviewId}`,
    direction: "inbound",
    text: promptText,
    route: "source_thread",
    threadId: binding.threadId,
    status: "delivered",
    turnId: sent.turnId,
    occurredAt: now,
  });
  return { state: nextState, ok: true, status: "delivered", turnId: sent.turnId };
}

export function startReviewRelayServer(input: {
  state: TelegramGatewayState;
  config: TelegramGatewayConfig;
  saveState: (state: TelegramGatewayState) => Promise<void>;
  port?: number;
  host?: string;
  codexImpl?: CodexDeliveryImpl;
}): { server: ReturnType<typeof createServer>; url: string } {
  let state = input.state;
  const host = input.host ?? "127.0.0.1";
  const port = input.port ?? input.config.reviewRelayPort ?? 8789;
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || !request.url?.startsWith("/phone-chaser/review")) {
      writeJson(response, 404, { ok: false, error: "not_found" });
      return;
    }
    try {
      const body = await readJsonBody(request);
      const capability = bearerToken(request.headers.authorization);
      if (!capability) {
        writeJson(response, 401, { ok: false, error: "missing_bearer_capability" });
        return;
      }
      const result = await submitReviewRelayResponse({
        state,
        config: input.config,
        reviewId: stringField(body, "review_id"),
        capability,
        decision: stringField(body, "decision"),
        reason: stringField(body, "reason"),
        idempotencyKey: stringField(body, "idempotency_key"),
        codexImpl: input.codexImpl,
      });
      state = result.state;
      await input.saveState(state);
      writeJson(response, result.ok ? 200 : 400, {
        ok: result.ok,
        status: result.status,
        idempotent: result.idempotent,
        error: result.error,
      });
    } catch (error) {
      writeJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "review_relay_failed" });
    }
  });
  server.listen(port, host);
  return { server, url: `http://${host}:${port}/phone-chaser/review` };
}

function buildReviewResponsePrompt(input: {
  binding: Pick<ReviewRelayBinding, "reviewId" | "cycle" | "title">;
  decision: ReviewRelayDecision;
  reason: string;
  idempotencyKey: string;
}): string {
  return [
    "Phone Chaser captured a spoken artifact review response.",
    "",
    `Review ID: ${input.binding.reviewId}`,
    `Review cycle: ${input.binding.cycle}`,
    input.binding.title ? `Review title: ${input.binding.title}` : undefined,
    `Decision: ${input.decision}`,
    `Reason: ${input.reason}`,
    `Idempotency key: ${input.idempotencyKey}`,
    "",
    "Treat this as a normal user review turn. Do not publish, spend, deploy, mutate accounts, or perform outreach unless the ticket already allows that final action.",
  ].filter(Boolean).join("\n");
}

function reject(
  state: TelegramGatewayState,
  reviewId: string,
  idempotencyKey: string,
  decision: ReviewRelayDecision,
  reason: string,
  error: string,
  occurredAt: number,
): ReviewRelaySubmitResult {
  return {
    state: recordReviewRelayReceipt(state, {
      reviewId,
      idempotencyKey,
      decision,
      reason,
      status: "rejected",
      error,
      occurredAt,
    }),
    ok: false,
    status: "rejected",
    error,
  };
}

function normalizeDecision(value: string): ReviewRelayDecision {
  const decision = value.trim().toLowerCase();
  if (!DECISIONS.has(decision as ReviewRelayDecision)) throw new Error("invalid_decision");
  return decision as ReviewRelayDecision;
}

function requireBoundedString(value: string, label: string, maxLength: number): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(`missing_${label}`);
  if (trimmed.length > maxLength) throw new Error(`${label}_too_large`);
  return trimmed;
}

function boundedOptional(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableNumericId(value: string): number {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16) % 2_147_483_647;
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error("request_body_too_large");
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json_body");
  return parsed as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string") throw new Error(`missing_${name}`);
  return value;
}

function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match?.[1]?.trim() || undefined;
}

function writeJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(`${JSON.stringify(body)}\n`);
}
