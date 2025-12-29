import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { env } from '../env.js'
import { log } from '../logger.js'
import {
  ensureConversation,
  getOlderMessages,
  getRecentMessages,
  insertMessage
} from '../repos/chatRepo.js'
import { generateSupportReply } from '../services/llm/supportAgent.js'
import { rateLimitMessage, rateLimitHistory } from '../middleware/rateLimitMiddleware.js'

function errorMeta(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { error: String(err) }
}

/**
 * Chat API router
 *
 * Exposes two endpoints under /api/v1/chat:
 * - POST /message: accept a user message, persist it, call the LLM, persist the AI reply, return the text.
 * - GET /history: fetch conversation history with simple cursor-based pagination.
 */
const router = Router()

// Shape of POST /message body. sessionId is required (uuid string).
const postMessageSchema = z.object({
  message: z.string().trim().min(1),
  sessionId: z.string().uuid()
})


/**
 * POST /message
 * Validates input, creates the conversation if needed, saves the user message,
 * fetches recent history, asks the LLM for a reply, saves the AI message, and
 * returns the text back to the client.
 */
router.post('/message', rateLimitMessage, async (req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string | undefined) ?? undefined
  const startedAt = Date.now()

  const parsed = postMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    log('warn', 'chat.message.validation_failed', {
      requestId,
      issues: parsed.error.issues
    })
    return res.status(400).json({ error: 'Invalid request' })
  }

  const { message, sessionId } = parsed.data
  const cleanMessage = message.replace(/[\u200B-\u200F\uFEFF]/g, '').trim()
  if(cleanMessage.length === 0) {
    return res.status(400).json({ error: 'Message is empty' })
  }

  if (cleanMessage.length > env.MAX_MESSAGE_CHARS) {
    log('warn', 'chat.message.too_long', {
      requestId,
      sessionId,
      messageLength: cleanMessage.length,
      maxMessageChars: env.MAX_MESSAGE_CHARS
    })
    return res.status(413).json({ error: 'Message is too long' })
  }

  try {
    log('info', 'chat.message.start', {
      requestId,
      sessionId,
      messageLength: cleanMessage.length,
      messagePreview: cleanMessage.slice(0, 120)
    })

    const tEnsure = Date.now()
    await ensureConversation(sessionId)
    log('info', 'chat.message.ensure_conversation.ok', {
      requestId,
      sessionId,
      durationMs: Date.now() - tEnsure
    })


    const tRecent = Date.now()
    const recentMessages = await getRecentMessages(sessionId, env.CHAT_PAGE_SIZE)
    log('info', 'chat.message.get_recent.ok', {
      requestId,
      sessionId,
      limit: env.CHAT_PAGE_SIZE,
      returned: recentMessages.length,
      durationMs: Date.now() - tRecent
    })
    
    const tInsertUser = Date.now()
    await insertMessage({ conversationId: sessionId, sender: 'user', text: cleanMessage })
    log('info', 'chat.message.insert_user.ok', {
      requestId,
      sessionId,
      durationMs: Date.now() - tInsertUser
    })

    try {
      const tLlm = Date.now()
      // Map DB rows to channel-agnostic chat history. 
      const history = recentMessages.map((m) => ({ role: m.sender as 'user' | 'ai', content: m.text }))
      const replyText = await generateSupportReply(history, cleanMessage)
      log('info', 'chat.message.llm.ok', {
        requestId,
        sessionId,
        durationMs: Date.now() - tLlm,
        replyLength: replyText.length
      })

      const tInsertAi = Date.now()
      await insertMessage({ conversationId: sessionId, sender: 'ai', text: replyText })
      log('info', 'chat.message.insert_ai.ok', {
        requestId,
        sessionId,
        durationMs: Date.now() - tInsertAi
      })

      log('info', 'chat.message.finish', {
        requestId,
        sessionId,
        durationMs: Date.now() - startedAt
      })
      return res.json({ reply: replyText, sessionId })
    } catch (err) {
      log('error', 'chat.message.llm_failed', {
        requestId,
        sessionId,
        durationMs: Date.now() - startedAt,
        ...errorMeta(err)
      })
      return res.status(502).json({
        error: "I'm sorry - I'm having trouble responding right now. Please try again in a moment."
      })
    }
  } catch (err) {
    log('error', 'chat.message.failed', {
      requestId,
      sessionId,
      durationMs: Date.now() - startedAt,
      ...errorMeta(err)
    })
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


/**
 * Parse a cursor string of the form "<ISO date>|<uuid>" (or just date) into a structured object.
 * We accept a few date formats and normalize to ISO8601 for safety.
 */
function parseCursor(cursor: string | undefined) {
  if (!cursor) return null

  const parts = cursor.split('|')

  // Helper: normalize various date string formats to ISO8601 if possible
  const toIso = (raw: string) => {
    const trimmed = raw.trim()
    // Accept already-ISO strings
    const isoCheck = z.string().datetime().safeParse(trimmed)
    if (isoCheck.success) return trimmed
    // Try broad date parsing (e.g., "Sun Dec 28 2025 23:22:34 GMT+0530 (India Standard Time)")
    const ms = Date.parse(trimmed)
    if (!Number.isNaN(ms)) return new Date(ms).toISOString()
    return null
  }

  if (parts.length === 1) {
    const createdAtIso = toIso(parts[0]!)
    if (!createdAtIso) return null
    return { createdAt: createdAtIso, id: undefined as string | undefined }
  }

  if (parts.length === 2) {
    const createdAtIso = toIso(parts[0]!)
    const id = parts[1]!.trim()
    if (!createdAtIso) return null
    const ok = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).safeParse({ createdAt: createdAtIso, id })
    if (!ok.success) return null
    return { createdAt: createdAtIso, id }
  }

  return null
}

// Query validation for GET /history
const historyQuerySchema = z.object({
  sessionId: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
})

/**
 * GET /history
 * Returns a page of messages for a given sessionId. If a cursor is provided, we
 * fetch messages older than that (created_at,id). Messages are always returned
 * oldest->newest. nextCursor points to the oldest message in this page.
 */
router.get('/history', rateLimitHistory, async (req: Request, res: Response) => {
  const requestId = (res.locals.requestId as string | undefined) ?? undefined
  const startedAt = Date.now()

  const parsed = historyQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    log('warn', 'chat.history.validation_failed', {
      requestId,
      issues: parsed.error.issues
    })
    return res.status(400).json({ error: 'Invalid request' })
  }

  const { sessionId, cursor, limit } = parsed.data
  const parsedCursor = parseCursor(cursor)
  if (cursor && !parsedCursor) {
    log('warn', 'chat.history.cursor_invalid', { requestId, sessionId, cursor })
    return res.status(400).json({ error: 'Invalid request' })
  }
  const pageSize = limit ?? env.CHAT_PAGE_SIZE

  try {
    log('info', 'chat.history.start', {
      requestId,
      sessionId,
      cursor: cursor ?? null,
      pageSize
    })

    const tFetch = Date.now()
    const messages = parsedCursor
      ? await getOlderMessages({
          conversationId: sessionId,
          cursorCreatedAt: parsedCursor.createdAt,
          cursorId: parsedCursor.id,
          limit: pageSize
        })
      : await getRecentMessages(sessionId, pageSize)

    log('info', 'chat.history.fetch.ok', {
      requestId,
      sessionId,
      fetched: messages.length,
      durationMs: Date.now() - tFetch
    })

    const nextCursor = messages.length > 0 ? `${messages[0]!.created_at}|${messages[0]!.id}` : null

    log('info', 'chat.history.finish', {
      requestId,
      sessionId,
      nextCursor: nextCursor ? 'present' : null,
      durationMs: Date.now() - startedAt
    })

    return res.json({ messages, nextCursor })
  } catch (err) {
    log('error', 'chat.history.failed', {
      requestId,
      sessionId,
      durationMs: Date.now() - startedAt,
      ...errorMeta(err)
    })
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

export default router
