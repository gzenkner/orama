import { getRemoteSyncContext } from "./portalBridge";
import { actions } from "./store";

export type RemoteLoadPhase = "connecting" | "fetching";
export type RemoteLoadResult = "unavailable" | "empty" | "loaded";

async function readErrorDetail(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    return raw.slice(0, 240);
  }

  return raw.slice(0, 240);
}

export async function loadRemoteStateIntoStore(onPhaseChange?: (phase: RemoteLoadPhase) => void): Promise<RemoteLoadResult> {
  onPhaseChange?.("connecting");
  const context = await getRemoteSyncContext();
  if (!context) {
    return "unavailable";
  }

  onPhaseChange?.("fetching");
  const response = await fetch(
    `${context.supabaseUrl.replace(/\/$/, "")}/functions/v1/orama-state`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${context.accessToken}`,
        apikey: context.supabaseAnonKey,
      },
    },
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Could not load Orama state: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  const payload = await response.json();
  if (!payload?.state) {
    return "empty";
  }

  actions.importJSON(JSON.stringify(payload.state));
  return "loaded";
}
