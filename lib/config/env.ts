/**
 * Environment Configuration and Validation
 *
 * This module provides centralized environment variable management with:
 * - Runtime validation of all required variables
 * - Clear error messages for missing configuration
 * - Type-safe configuration exports
 * - Vercel-specific URL resolution
 * - Separation of client/server/shared config
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('config:env')

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Get a required environment variable, throwing if not found
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    throw new ConfigurationError(
      `Missing required environment variable: ${key}\n` +
      `Please set this variable in your Vercel dashboard or .env.local file.`
    );
  }

  return value.trim();
}

/**
 * Get an optional environment variable with a default value
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

/**
 * Validate that a string is a valid URL
 */
function validateUrl(url: string, varName: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    throw new ConfigurationError(
      `Invalid URL for ${varName}: "${url}"\n` +
      `Please ensure this is a valid URL (e.g., https://example.com)`
    );
  }
}

/**
 * Resolve the base URL for the application
 * Handles Vercel deployments, local development, and custom domains
 */
function resolveBaseUrl(): string {
  // 1. Check for explicit base URL (highest priority)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return validateUrl(process.env.NEXT_PUBLIC_BASE_URL, 'NEXT_PUBLIC_BASE_URL');
  }

  // 2. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Local development fallback
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Validate all server-side configuration
 * This runs at module load time, so errors are caught early
 */
function validateServerConfig() {
  return {
    supabase: {
      serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },
    xero: {
      clientId: getOptionalEnv('XERO_CLIENT_ID', ''),
      clientSecret: getOptionalEnv('XERO_CLIENT_SECRET', ''),
    },
    myob: {
      clientId: getOptionalEnv('MYOB_CLIENT_ID', ''),
      clientSecret: getOptionalEnv('MYOB_CLIENT_SECRET', ''),
    },
    quickbooks: {
      clientId: getOptionalEnv('QUICKBOOKS_CLIENT_ID', ''),
      clientSecret: getOptionalEnv('QUICKBOOKS_CLIENT_SECRET', ''),
    },
    linear: {
      apiKey: getOptionalEnv('LINEAR_API_KEY', ''),
      teamId: getOptionalEnv('LINEAR_TEAM_ID', ''),
      projectId: getOptionalEnv('LINEAR_PROJECT_ID', ''),
    },
  };
}

/**
 * Validate all client-side configuration
 */
function validateClientConfig() {
  return {
    supabase: {
      url: validateUrl(getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'), 'NEXT_PUBLIC_SUPABASE_URL'),
      anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },
  };
}

/**
 * Validate shared configuration (available on both client and server)
 */
function validateSharedConfig() {
  const baseUrl = resolveBaseUrl();

  return {
    baseUrl,
    isProduction: process.env.NODE_ENV === 'production',
    isVercel: Boolean(process.env.VERCEL),
    isDevelopment: process.env.NODE_ENV === 'development',
  };
}

// Export validated configurations lazily
// Validation only happens when config is first accessed, not at module load
// This allows builds to succeed even without all env vars present

let _serverConfig: ReturnType<typeof validateServerConfig> | null = null;
let _clientConfig: ReturnType<typeof validateClientConfig> | null = null;
let _sharedConfig: ReturnType<typeof validateSharedConfig> | null = null;

export const serverConfig = new Proxy({} as ReturnType<typeof validateServerConfig>, {
  get(_, prop) {
    if (!_serverConfig) _serverConfig = validateServerConfig();
    return _serverConfig[prop as keyof typeof _serverConfig];
  }
});

export const clientConfig = new Proxy({} as ReturnType<typeof validateClientConfig>, {
  get(_, prop) {
    if (!_clientConfig) _clientConfig = validateClientConfig();
    return _clientConfig[prop as keyof typeof _clientConfig];
  }
});

export const sharedConfig = new Proxy({} as ReturnType<typeof validateSharedConfig>, {
  get(_, prop) {
    if (!_sharedConfig) _sharedConfig = validateSharedConfig();
    return _sharedConfig[prop as keyof typeof _sharedConfig];
  }
});

// Optional configuration (with defaults)
export const optionalConfig = {
  googleAiApiKey: getOptionalEnv('GOOGLE_AI_API_KEY', ''),
  googleAiModel: getOptionalEnv('GOOGLE_AI_MODEL', 'gemini-2.0-flash'),
  openRouterApiKey: getOptionalEnv('OPENROUTER_API_KEY', ''),
  braveApiKey: getOptionalEnv('BRAVE_API_KEY', ''),
  businessName: getOptionalEnv('BUSINESS_NAME', 'Your Business'),
  businessAbn: getOptionalEnv('BUSINESS_ABN', ''),
  yourName: getOptionalEnv('YOUR_NAME', 'User'),
};

/**
 * Validate all configuration and return status
 * Useful for health checks and startup validation
 */
export function validateConfiguration(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Try to access all configs to trigger validation
    void serverConfig;
    void clientConfig;
    void sharedConfig;

    // Check for optional but recommended variables
    if (!optionalConfig.googleAiApiKey) {
      warnings.push('GOOGLE_AI_API_KEY not set - AI-powered reports will not work');
    }

    if (!optionalConfig.braveApiKey) {
      warnings.push('BRAVE_API_KEY not set - tax rates will use fallback values instead of fetching from ATO');
    }

    if (!optionalConfig.businessAbn) {
      warnings.push('BUSINESS_ABN not set - reports will not include ABN');
    }

    if (!serverConfig.xero.clientId) {
      warnings.push('XERO_CLIENT_ID not set - Xero connections will not be available until configured');
    }

    if (!serverConfig.linear.projectId) {
      warnings.push('LINEAR_PROJECT_ID not set - issues will be created without project assignment');
    }

    return { valid: true, errors, warnings };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      errors.push(error.message);
    } else {
      errors.push(`Unexpected configuration error: ${error}`);
    }
    return { valid: false, errors, warnings };
  }
}

/**
 * Log configuration status (safe for production - no secrets)
 */
export function logConfigurationStatus(): void {
  log.info('Configuration status', {
    environment: sharedConfig.isProduction ? 'Production' : 'Development',
    platform: sharedConfig.isVercel ? 'Vercel' : 'Local',
    baseUrl: sharedConfig.baseUrl,
    supabaseUrl: clientConfig.supabase.url,
    xeroClientId: serverConfig.xero.clientId ? serverConfig.xero.clientId.substring(0, 8) + '...' : 'Not configured',
    linearTeamId: serverConfig.linear.teamId,
  });

  const validation = validateConfiguration();

  if (validation.warnings.length > 0) {
    console.warn('\nWarnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (validation.errors.length > 0) {
    console.error('\nErrors:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  } else {
    log.info('All required configuration valid');
  }
}
