import { actions } from "./store";

type ParentWindowWithPortal = Window &
  typeof globalThis & {
    MARKETSTATE_CONFIG?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
    marketstateSupabase?: {
      auth: {
        getSession: () => Promise<{
          data?: {
            session?: {
              access_token?: string;
            } | null;
          };
        }>;
      };
    };
  };

function getPortalWindow(): ParentWindowWithPortal | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.parent && window.parent !== window) {
      return window.parent as ParentWindowWithPortal;
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadRemoteStateIntoStore(): Promise<void> {
  const portalWindow = getPortalWindow();
  const config = portalWindow?.MARKETSTATE_CONFIG;
  const client = portalWindow?.marketstateSupabase;

  if (!portalWindow || !config?.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !client) {
    return;
  }

  const { data } = await client.auth.getSession();
  const accessToken = data?.session?.access_token;

  if (!accessToken) {
    return;
  }

  const response = await fetch(
    `${config.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/orama-state`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: config.SUPABASE_ANON_KEY,
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
