import { getAppState, subscribeAppState } from "./store";
import { getRemoteSyncContext } from "./portalBridge";

let lastSavedSnapshot = "";
let saveInFlight = false;
let hasPendingChanges = false;
let saveTimer: number | null = null;

const AUTOSAVE_DEBOUNCE_MS = 2_500;

async function saveRemoteState(snapshot: string): Promise<void> {
  const context = await getRemoteSyncContext();
  if (!context) return;

  const response = await fetch(
    `${context.supabaseUrl.replace(/\/$/, "")}/functions/v1/orama-state`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.accessToken}`,
        apikey: context.supabaseAnonKey,
      },
      body: JSON.stringify({
        state: JSON.parse(snapshot),
        state_version: 1,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Could not save Orama state: HTTP ${response.status}`);
  }
}

async function flushLatestState(): Promise<void> {
  if (saveInFlight) return;

  const snapshot = JSON.stringify(getAppState());
  if (snapshot === lastSavedSnapshot) {
    hasPendingChanges = false;
    return;
  }

  saveInFlight = true;
  try {
    await saveRemoteState(snapshot);
    lastSavedSnapshot = snapshot;
    hasPendingChanges = false;
  } catch (error) {
    console.warn("Could not save remote Orama state.", error);
  } finally {
    saveInFlight = false;
  }
}

export async function syncRemoteStateNow(): Promise<void> {
  hasPendingChanges = true;
  await flushLatestState();
}

export function initializeRemoteStateSync(): void {
  lastSavedSnapshot = JSON.stringify(getAppState());

  subscribeAppState(() => {
    hasPendingChanges = true;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void flushLatestState();
    }, AUTOSAVE_DEBOUNCE_MS);
  });

  const flushOnBackground = () => {
    if (!hasPendingChanges) return;
    void flushLatestState();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnBackground();
  });

  window.addEventListener("pagehide", flushOnBackground);

  window.addEventListener("beforeunload", () => {
    if (saveTimer) window.clearTimeout(saveTimer);
    flushOnBackground();
  });
}
