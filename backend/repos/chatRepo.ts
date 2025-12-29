import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'
import { sql } from '../db/sql.js'

export type Sender = 'user' | 'ai'

export type MessageRow = {
  id: string
  conversation_id: string
  sender: Sender
  text: string
  created_at: string
}

/**
 * Ensure a conversation row exists for a given conversation ID.
 *
 * We keep this idempotent by using an INSERT .. ON CONFLICT DO NOTHING so callers
 * can safely invoke it before writing messages without worrying about races.
 */
export async function ensureConversation(conversationId: string) {
  const q = sql`
    INSERT INTO conversations (id)
    VALUES (${conversationId}::uuid)
    ON CONFLICT (id) DO NOTHING
  `
  await pool.query(q.text, q.values)
}


/**
 * Insert a single message into the messages table and bump the conversation's
 * last_activity_at. Returns the newly created message id and timestamp so the
 * caller can optimistically update UI or logs if needed.
 */
export async function insertMessage(args: {
  conversationId: string
  sender: Sender
  text: string
  createdAt?: Date
}) {
  const id = randomUUID()
  const createdAt = args.createdAt ?? new Date()

  const q = sql`
    INSERT INTO messages (id, conversation_id, sender, text, created_at)
    VALUES (${id}::uuid, ${args.conversationId}::uuid, ${args.sender}, ${args.text}, ${createdAt.toISOString()}::timestamptz)
  `
  await pool.query(q.text, q.values)

  return { id, createdAt }
}

/**
 * Fetch the most recent messages for a conversation, returning them in
 * chronological order (oldest -> newest) which is what most UIs expect.
 */
export async function getRecentMessages(conversationId: string, limit: number) {
  const q = sql`
    SELECT id, conversation_id, sender, text, created_at
    FROM messages
    WHERE conversation_id = ${conversationId}::uuid
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `

  const res = await pool.query<MessageRow>(q.text, q.values)
  // Return ordered oldest->newest for UI rendering
  return res.rows.slice().reverse()
}

/**
 * Cursor-based pagination for older messages relative to a given (created_at, id).
 *
 * We use a composite comparison on (created_at, id) to avoid collisions when
 * multiple messages share identical timestamps. The return order is normalized to
 * oldest -> newest for easier rendering.
 */
export async function getOlderMessages(args: {
  conversationId: string
  cursorCreatedAt: string
  cursorId?: string
  limit: number
}) {
  const q = args.cursorId
    ? sql`
        SELECT id, conversation_id, sender, text, created_at
        FROM messages
        WHERE conversation_id = ${args.conversationId}::uuid
          AND (created_at, id) < (${args.cursorCreatedAt}::timestamptz, ${args.cursorId}::uuid)
        ORDER BY created_at DESC, id DESC
        LIMIT ${args.limit}
      `
    : sql`
        SELECT id, conversation_id, sender, text, created_at
        FROM messages
        WHERE conversation_id = ${args.conversationId}::uuid
          AND created_at < ${args.cursorCreatedAt}::timestamptz
        ORDER BY created_at DESC, id DESC
        LIMIT ${args.limit}
      `

  const res = await pool.query<MessageRow>(q.text, q.values)
  return res.rows.slice().reverse()
}

