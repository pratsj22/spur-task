import { type Request, type Response } from 'express'
import { allowRequest } from '../services/rateLimit.js'
import { log } from '../logger.js'

/**
 * Basic rate limiter for POST /message. If a sessionId is present, we limit per-session
 * in a short window to prevent rapid-fire messages. Otherwise we fallback to an IP-based limit.
 * Returns 429 with a friendly error when over limit.
 */
export function rateLimitMessage(req: Request, res: Response, next: () => void) {
  const requestId = (res.locals.requestId as string | undefined) ?? undefined
  const ip = req.ip
  const maybeSessionId = typeof req.body?.sessionId === 'string' ? String(req.body.sessionId) : undefined

  // Fallback semantics: if sessionId exists -> enforce per-session; else enforce per-IP
  if (maybeSessionId) {
    const perSession = allowRequest({ key: `msg:sess:${maybeSessionId}`, windowMs: 10_000, max: 5 })
    if (!perSession.allowed) {
      if (perSession.retryAfterMs) res.setHeader('Retry-After', Math.ceil(perSession.retryAfterMs / 1000))
      log('warn', 'rate_limit.blocked', { requestId, route: 'POST /message', scope: 'session', sessionId: maybeSessionId, retryAfterMs: perSession.retryAfterMs })
      return res.status(429).json({ error: 'The system is overloaded. Please wait a moment before sending more messages.' })
    }
    return next()
  }

  const perIp = allowRequest({ key: `msg:ip:${ip}`, windowMs: 60_000, max: 20 })
  if (!perIp.allowed) {
    if (perIp.retryAfterMs) res.setHeader('Retry-After', Math.ceil(perIp.retryAfterMs / 1000))
    log('warn', 'rate_limit.blocked', { requestId, route: 'POST /message', scope: 'ip', ip, retryAfterMs: perIp.retryAfterMs })
    return res.status(429).json({ error: 'The system is overloaded. Please try again shortly.' })
  }
  return next()
}

/**
 * Lightweight rate limiter for GET /history. IP-based and a bit more permissive
 * to allow scrolling/pagination without getting in the way.
 */
export function rateLimitHistory(req: Request, res: Response, next: () => void) {
  const requestId = (res.locals.requestId as string | undefined) ?? undefined
  const ip = req.ip
  const perIp = allowRequest({ key: `hist:ip:${ip}`, windowMs: 60_000, max: 120 })
  if (!perIp.allowed) {
    if (perIp.retryAfterMs) res.setHeader('Retry-After', Math.ceil(perIp.retryAfterMs / 1000))
    log('warn', 'rate_limit.blocked', { requestId, route: 'GET /history', scope: 'ip', ip, retryAfterMs: perIp.retryAfterMs })
    return res.status(429).json({ error: 'The system is overloaded. Please try again shortly.' })
  }
  return next()
}
