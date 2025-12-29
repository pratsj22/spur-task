type Entry = { count: number; resetAt: number }

const buckets = new Map<string, Entry>()

/**
 * Simple in-memory sliding-window rate limiter keyed by a string.
 *
 * This is intentionally lightweight and process-local. If you scale the app
 * horizontally, consider moving this to a shared store like Redis so that
 * limits apply consistently across instances.
 */
export function allowRequest(args: { key: string; windowMs: number; max: number }) {
  const now = Date.now()
  const entry = buckets.get(args.key)

  if (!entry || entry.resetAt <= now) {
    buckets.set(args.key, { count: 1, resetAt: now + args.windowMs })
    return { allowed: true }
  }

  if (entry.count >= args.max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count += 1
  return { allowed: true }
}
