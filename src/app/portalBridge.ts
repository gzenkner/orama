type PortalConfig = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

type SameOriginPortalWindow = Window &
  typeof globalThis & {
    MARKETSTATE_CONFIG?: PortalConfig;
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

type RemoteContextPayload = {
  type: "marketstate:orama-context-response";
  requestId: string;
  config?: PortalConfig;
  accessToken?: string | null;
};

export type RemoteSyncContext = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
};

function getParentWindow(): Window | null {
  if (typeof window === "undefined") return null;
  if (!window.parent || window.parent === window) return null;
  return window.parent;
}

async function readSameOriginParentContext(parentWindow: Window): Promise<RemoteSyncContext | null> {
  try {
    const portalWindow = parentWindow as SameOriginPortalWindow;
    const config = portalWindow.MARKETSTATE_CONFIG;
    const client = portalWindow.marketstateSupabase;

    if (!config?.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !client) {
      return null;
    }

    const { data } = await client.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (!accessToken) return null;

    return {
      supabaseUrl: config.SUPABASE_URL,
      supabaseAnonKey: config.SUPABASE_ANON_KEY,
      accessToken,
    };
  } catch {
    return null;
  }
}

function requestCrossOriginParentContext(parentWindow: Window): Promise<RemoteSyncContext | null> {
  return new Promise((resolve) => {
    const requestId = `orama_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve(null);
    }, 3000);

    function handleMessage(event: MessageEvent<RemoteContextPayload>) {
      if (event.source !== parentWindow) return;
      if (event.data?.type !== "marketstate:orama-context-response") return;
      if (event.data.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);

      const config = event.data.config;
      const accessToken = event.data.accessToken;
      if (!config?.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !accessToken) {
        resolve(null);
        return;
      }

      resolve({
        supabaseUrl: config.SUPABASE_URL,
        supabaseAnonKey: config.SUPABASE_ANON_KEY,
        accessToken,
      });
    }

    window.addEventListener("message", handleMessage);
    parentWindow.postMessage(
      {
        type: "marketstate:orama-context-request",
        requestId,
      },
      "*",
    );
  });
}

export async function getRemoteSyncContext(): Promise<RemoteSyncContext | null> {
  const parentWindow = getParentWindow();
  if (!parentWindow) return null;

  const sameOriginContext = await readSameOriginParentContext(parentWindow);
  if (sameOriginContext) return sameOriginContext;

  return requestCrossOriginParentContext(parentWindow);
}
