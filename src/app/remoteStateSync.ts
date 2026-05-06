import { getAppState, subscribeAppState } from "./store";
import { getRemoteSyncContext } from "./portalBridge";

let lastSavedSnapshot = "";
let saveInFlight = false;
let hasPendingChanges = false;
let flushRequestedWhileInFlight = false;
let saveTimer: number | null = null;
let warnedMissingContext = false;

const AUTOSAVE_DEBOUNCE_MS = 2_500;
const AUTOSAVE_RETRY_MS = 10_000;

class RemoteSyncUnavailableError extends Error {
  constructor() {
    super("Supabase session context is unavailable.");
  }
}

function scheduleFlush(delayMs: number): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void flushLatestState();
  }, delayMs);
}

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

async function saveRemoteState(snapshot: string): Promise<void> {
  const context = await getRemoteSyncContext();
  if (!context) {
    if (!warnedMissingContext) {
      console.warn("Orama remote sync is unavailable because no Supabase session context was provided by the portal.");
      warnedMissingContext = true;
    }
    throw new RemoteSyncUnavailableError();
  }

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
    const detail = await readErrorDetail(response);
    throw new Error(`Could not save Orama state: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }
}

async function flushLatestState(): Promise<void> {
  if (saveInFlight) {
    flushRequestedWhileInFlight = true;
    return;
  }

  const snapshot = JSON.stringify(getAppState());
  if (snapshot === lastSavedSnapshot) {
    hasPendingChanges = false;
    return;
  }

  saveInFlight = true;
  flushRequestedWhileInFlight = false;
  let saveFailed = false;
  try {
    await saveRemoteState(snapshot);
    lastSavedSnapshot = snapshot;
    hasPendingChanges = false;
  } catch (error) {
    saveFailed = true;
    hasPendingChanges = true;
    if (!(error instanceof RemoteSyncUnavailableError)) {
      console.warn("Could not save remote Orama state.", error);
    }
    scheduleFlush(AUTOSAVE_RETRY_MS);
  } finally {
    saveInFlight = false;
    if (!saveFailed) {
      const latestSnapshot = JSON.stringify(getAppState());
      if (flushRequestedWhileInFlight || latestSnapshot !== lastSavedSnapshot) {
        hasPendingChanges = true;
        flushRequestedWhileInFlight = false;
        scheduleFlush(0);
      }
    }
  }
}

export async function syncRemoteStateNow(): Promise<void> {
  hasPendingChanges = true;
  await flushLatestState();
}

function hasPersistableUserData(): boolean {
  const state = getAppState();
  return (
    state.outcomes.length > 0 ||
    state.archivedOutcomes.length > 0 ||
    Object.keys(state.yearly).length > 0 ||
    Object.keys(state.monthly).length > 0 ||
    Object.keys(state.weekly).length > 0 ||
    Object.keys(state.daily).length > 0 ||
    Object.keys(state.coachThreads).length > 0
  );
}

export function initializeRemoteStateSync(options: { pushInitialState?: boolean } = {}): void {
  lastSavedSnapshot = options.pushInitialState ? "" : JSON.stringify(getAppState());

  subscribeAppState(() => {
    hasPendingChanges = true;
    scheduleFlush(AUTOSAVE_DEBOUNCE_MS);
  });

  if (options.pushInitialState && hasPersistableUserData()) {
    hasPendingChanges = true;
    scheduleFlush(0);
  }

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
    saveTimer = null;
    flushOnBackground();
  });
}
