export type AtoAppConnectionId =
  | "supabase"
  | "xero"
  | "myob"
  | "quickbooks"
  | "google_ai"
  | "stripe"
  | "sendgrid"
  | "linear"
  | "abr"
  | "sentry"
  | "unite_group";

export type AtoAppConnectionState =
  | "connected"
  | "ready"
  | "mock"
  | "blocked"
  | "unknown";

export type AtoAppConnection = {
  id: AtoAppConnectionId;
  label: string;
  state: AtoAppConnectionState;
  safeForMissionControl: boolean;
  detail: string;
  endpoint?: string;
  nextAction?: string;
};

export type AtoAppConnectionStatus = {
  source: "ato-app:connection-status";
  generatedAt: string;
  project: {
    slug: "ato-app";
    repo: "CleanExpo/ATO";
    service: "ato-app-web";
    environment: string;
  };
  summary: Record<AtoAppConnectionState, number> & { total: number };
  connections: AtoAppConnection[];
};

function envSet(name: string, env: NodeJS.ProcessEnv): boolean {
  return Boolean(env[name]?.trim());
}

function connectionSummary(
  connections: AtoAppConnection[],
): AtoAppConnectionStatus["summary"] {
  return {
    total: connections.length,
    connected: connections.filter((c) => c.state === "connected").length,
    ready: connections.filter((c) => c.state === "ready").length,
    mock: connections.filter((c) => c.state === "mock").length,
    blocked: connections.filter((c) => c.state === "blocked").length,
    unknown: connections.filter((c) => c.state === "unknown").length,
  };
}

/**
 * Presence-only readiness manifest for Unite-Group Mission Control polling.
 * States are derived from env-var presence, never from secret values, and no
 * secret material is ever included in the payload. "connected" is reserved
 * for infrastructure the app cannot boot without (per lib/config/env.ts,
 * only SUPABASE_SERVICE_ROLE_KEY is a hard-required env var); integrations
 * whose live use is still gated (Xero/MYOB/QuickBooks OAuth, billing, email,
 * AI, ABR lookup, PM sync) report "ready" at best.
 */
export function buildAtoAppConnectionStatus(
  env: NodeJS.ProcessEnv = process.env,
  now = new Date().toISOString(),
): AtoAppConnectionStatus {
  const environment = env.VERCEL_ENV?.trim() || env.NODE_ENV?.trim() || "development";

  const supabaseReady =
    envSet("NEXT_PUBLIC_SUPABASE_URL", env) &&
    envSet("NEXT_PUBLIC_SUPABASE_ANON_KEY", env) &&
    envSet("SUPABASE_SERVICE_ROLE_KEY", env);
  const xeroReady = envSet("XERO_CLIENT_ID", env) && envSet("XERO_CLIENT_SECRET", env);
  const myobReady = envSet("MYOB_CLIENT_ID", env) && envSet("MYOB_CLIENT_SECRET", env);
  const quickbooksReady =
    envSet("QUICKBOOKS_CLIENT_ID", env) && envSet("QUICKBOOKS_CLIENT_SECRET", env);
  const googleAiReady = envSet("GOOGLE_AI_API_KEY", env);
  const stripeReady = envSet("STRIPE_SECRET_KEY", env);
  const stripeWebhookReady = envSet("STRIPE_WEBHOOK_SECRET", env);
  const sendgridReady = envSet("SENDGRID_API_KEY", env);
  const linearReady = envSet("LINEAR_API_KEY", env) && envSet("LINEAR_TEAM_ID", env);
  const abrReady = envSet("ABR_GUID", env);
  const sentryReady = envSet("NEXT_PUBLIC_SENTRY_DSN", env);

  const connections: AtoAppConnection[] = [
    {
      id: "supabase",
      label: "Supabase",
      state: supabaseReady ? "connected" : "blocked",
      safeForMissionControl: true,
      detail: supabaseReady
        ? "Supabase URL, anon key, and service role key are present."
        : "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required to boot.",
      nextAction: supabaseReady ? undefined : "Set the Supabase env trio.",
    },
    {
      id: "xero",
      label: "Xero accounting sync",
      state: xeroReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: xeroReady
        ? "Xero OAuth credential pair present; live sync remains user-connect-gated."
        : "XERO_CLIENT_ID and XERO_CLIENT_SECRET are required for Xero sync.",
      nextAction: xeroReady ? undefined : "Provision Xero OAuth app credentials.",
    },
    {
      id: "myob",
      label: "MYOB accounting sync",
      state: myobReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: myobReady
        ? "MYOB OAuth credential pair present; live sync remains user-connect-gated."
        : "MYOB_CLIENT_ID and MYOB_CLIENT_SECRET are required for MYOB sync.",
      nextAction: myobReady ? undefined : "Provision MYOB OAuth app credentials.",
    },
    {
      id: "quickbooks",
      label: "QuickBooks Online sync",
      state: quickbooksReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: quickbooksReady
        ? "QuickBooks OAuth credential pair present; live sync remains user-connect-gated."
        : "QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET are required for QuickBooks sync.",
      nextAction: quickbooksReady ? undefined : "Provision QuickBooks OAuth app credentials.",
    },
    {
      id: "google_ai",
      label: "Google AI (Gemini analysis)",
      state: googleAiReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: googleAiReady
        ? "Gemini API key present; AI analysis features can run (billing applies on use)."
        : "GOOGLE_AI_API_KEY is not set — AI analysis features degrade.",
      nextAction: googleAiReady ? undefined : "Set GOOGLE_AI_API_KEY.",
    },
    {
      id: "stripe",
      label: "Payments (Stripe)",
      state: stripeReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: stripeReady
        ? stripeWebhookReady
          ? "Stripe secret and webhook secret present; production checkout remains human-gated."
          : "Stripe secret present but STRIPE_WEBHOOK_SECRET is missing — webhooks will fail."
        : "STRIPE_SECRET_KEY is not set.",
      nextAction: stripeReady
        ? stripeWebhookReady
          ? undefined
          : "Set STRIPE_WEBHOOK_SECRET."
        : "Set the Stripe key pair.",
    },
    {
      id: "sendgrid",
      label: "Transactional email (SendGrid)",
      state: sendgridReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: sendgridReady
        ? "SendGrid key present; report and invitation sends remain policy-gated."
        : "SENDGRID_API_KEY is not set — no transactional email.",
      nextAction: sendgridReady ? undefined : "Set SENDGRID_API_KEY.",
    },
    {
      id: "linear",
      label: "Linear project sync",
      state: linearReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: linearReady
        ? "Linear key and team id present for task sync."
        : "LINEAR_API_KEY and LINEAR_TEAM_ID are required to sync tasks.",
      nextAction: linearReady ? undefined : "Set the Linear intake env pair.",
    },
    {
      id: "abr",
      label: "Australian Business Register lookup",
      state: abrReady ? "ready" : "blocked",
      safeForMissionControl: true,
      detail: abrReady
        ? "ABR GUID present; ABN validation and entity lookup can run."
        : "ABR_GUID is not set — ABN validation is unavailable.",
      nextAction: abrReady ? undefined : "Set ABR_GUID.",
    },
    {
      id: "sentry",
      label: "Error monitoring (Sentry)",
      state: sentryReady ? "connected" : "unknown",
      safeForMissionControl: true,
      detail: sentryReady
        ? "Sentry DSN present; client/edge/server configs ship in this repo."
        : "No Sentry DSN detected — errors are not being reported.",
      nextAction: sentryReady ? undefined : "Set NEXT_PUBLIC_SENTRY_DSN.",
    },
    {
      id: "unite_group",
      label: "Unite-Group Mission Control",
      state: "ready",
      safeForMissionControl: true,
      detail:
        "This manifest is designed for Unite-Group to poll and show ATO-APP readiness without secrets.",
      endpoint: "/api/v1/connections/status",
      nextAction: "Add this endpoint to the Unite-Group project registry.",
    },
  ];

  return {
    source: "ato-app:connection-status",
    generatedAt: now,
    project: {
      slug: "ato-app",
      repo: "CleanExpo/ATO",
      service: "ato-app-web",
      environment,
    },
    summary: connectionSummary(connections),
    connections,
  };
}
