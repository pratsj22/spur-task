import { createWriteStream, mkdirSync } from 'node:fs'
import path from 'node:path'
import { env } from './env.js'

let stream: ReturnType<typeof createWriteStream> | null = null

function formatValue(v: unknown) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.includes(' ') ? JSON.stringify(v) : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function formatMeta(meta: Record<string, unknown> | undefined) {
  if (!meta) return ''
  const parts: string[] = []
  for (const [k, v] of Object.entries(meta)) {
    const fv = formatValue(v)
    if (!fv) continue
    parts.push(`${k}=${fv}`)
  }
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function getStream() {
  if (stream) return stream

  const logFile = env.LOG_FILE
  const dir = path.dirname(logFile)
  mkdirSync(dir, { recursive: true })

  stream = createWriteStream(logFile, { flags: 'a' })
  stream.on('error', (err) => {
    try {
      process.stderr.write(`logger stream error: ${String(err)}\n`)
    } catch {
      // ignore
    }
  })

  return stream
}

/**
 * Minimal, dependency-free logger that writes structured lines to a file.
 *
 * Format:
 *   ISO_TIMESTAMP LEVEL MESSAGE key=value key2=value2
 *
 * It’s intentionally simple, but good enough for tracing requests and
 * collecting lightweight diagnostics without pulling in a full logging lib.
 */
export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
) {
  const ts = new Date().toISOString()
  const line = `${ts} ${level.toUpperCase()} ${message}${formatMeta(meta)}\n`
  getStream().write(line)
}
