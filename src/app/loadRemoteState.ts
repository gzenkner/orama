import { getRemoteSyncContext } from "./portalBridge";
import { actions } from "./store";

export type RemoteLoadPhase = "connecting" | "fetching";

export async function loadRemoteStateIntoStore(onPhaseChange?: (phase: RemoteLoadPhase) => void): Promise<void> {
  onPhaseChange?.("connecting");
  const context = await getRemoteSyncContext();
  if (!context) {
    return;
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
    throw new Error(`Could not load Orama state: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.state) {
    return;
  }

  actions.importJSON(JSON.stringify(payload.state));
}
