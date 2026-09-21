/** YouTube bridge authentication preflight. Codex owns tokens and refresh; this
 * adapter returns non-secret readiness and never retries an analysis turn. */
export type CodexAuthentication = {
  authentication: "ready" | "required" | "unavailable";
  authenticationMessage?: string;
};

type AccountRpc = {
  request<T>(method: string, params: unknown): Promise<T>;
};

export const CODEX_SIGN_IN_MESSAGE =
  "Codex sign-in needs to be renewed. Run codex login, then retry analysis. No analysis task was started.";

// A presence-only poll cannot undo a refresh failure; explicit refresh proves recovery.
let lastRequired: CodexAuthentication | undefined;

export async function readCodexAuthentication(
  rpc: AccountRpc,
  refreshToken = true,
  timeoutMs = 12_000,
): Promise<CodexAuthentication> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Codex preflight timed out")), timeoutMs);
  });
  try {
    const result = await Promise.race([rpc.request<{
      account: { type: string } | null;
      requiresOpenaiAuth: boolean;
    }>("account/read", { refreshToken }), deadline]);
    if (!result || typeof result.requiresOpenaiAuth !== "boolean") {
      return { authentication: "unavailable", authenticationMessage: "Codex returned an invalid authentication status." };
    }
    if (!result.account && result.requiresOpenaiAuth) {
      lastRequired = { authentication: "required", authenticationMessage: CODEX_SIGN_IN_MESSAGE };
      return lastRequired;
    }
    // account/read can swallow refresh failures and return a cached account.
    // A real authenticated, non-generating request must succeed before readiness.
    if (refreshToken && result.account?.type === "chatgpt") {
      await Promise.race([rpc.request("account/rateLimits/read", {}), deadline]);
    }
    if (refreshToken) lastRequired = undefined;
    return lastRequired ?? { authentication: "ready" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Never expose arbitrary RPC errors: they can contain provider details.
    const status: CodexAuthentication = /refresh.?token|access token|sign.?in|log(?:ged)?[ -]?out|unauthori[sz]ed|authentication|401/i.test(message)
      ? { authentication: "required", authenticationMessage: CODEX_SIGN_IN_MESSAGE }
      : { authentication: "unavailable", authenticationMessage: "Could not verify Codex sign-in. Check the Codex connection and retry." };
    if (status.authentication === "required") lastRequired = status;
    return status;
  } finally {
    clearTimeout(timer);
  }
}

export async function requireCodexAuthentication(rpc: AccountRpc): Promise<void> {
  const result = await readCodexAuthentication(rpc);
  if (result.authentication !== "ready") throw new Error(result.authenticationMessage);
}
