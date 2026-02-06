/**
 * Structured Logger
 *
 * Zero-dependency structured logger for production observability.
 * - JSON output in production (Vercel parses structured JSON from stdout)
 * - Pretty-print in development
 * - Log levels: debug/info/warn/error, filtered by LOG_LEVEL env var
 * - Module prefix per instance (e.g. `ai:batch-processor`)
 * - Structured context support
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLevel(): number {
  const env = (typeof process !== 'undefined' && process.env?.LOG_LEVEL) || 'debug'
  return LOG_LEVELS[env as LogLevel] ?? LOG_LEVELS.debug
}

function isProduction(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
}

export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void
  info(msg: string, context?: Record<string, unknown>): void
  warn(msg: string, context?: Record<string, unknown>): void
  error(msg: string, error?: Error | unknown, context?: Record<string, unknown>): void
}

export function createLogger(module: string): Logger {
  const minLevel = getMinLevel()

  function emit(level: LogLevel, msg: string, context?: Record<string, unknown>, err?: Error | unknown) {
    if (LOG_LEVELS[level] < minLevel) return

    const entry: Record<string, unknown> = {
      level: level.toUpperCase(),
      module,
      msg,
      ts: new Date().toISOString(),
    }

    if (context && Object.keys(context).length > 0) {
      Object.assign(entry, context)
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = err.message
        entry.stack = err.stack
      } else {
        entry.error = String(err)
      }
    }

    if (isProduction()) {
      // Single-line JSON for Vercel log parsing
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
      console[method](JSON.stringify(entry))
    } else {
      // Pretty-print for development
      const prefix = `[${level.toUpperCase()}] [${module}]`
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
      if (context && Object.keys(context).length > 0) {
        console[method](prefix, msg, context)
      } else {
        console[method](prefix, msg)
      }
      if (err) {
        console[method](prefix, 'Error:', err)
      }
    }
  }

  return {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, err, context) => emit('error', msg, context, err),
  }
}
