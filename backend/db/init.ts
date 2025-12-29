import { pool } from './pool.js'
import pg from 'pg'
import { env } from '../env.js'
import { log } from '../logger.js'
import { URL } from 'node:url'

/**
 * Create tables and indexes if they don't already exist.
 *
 * This runs at server startup so local devs don't need a separate migration
 * step. In production you'd typically move this to migrations, but keeping
 * it here makes the assessment easy to run.
 */
export async function initDb() {
  async function ensureDatabaseExists() {
    try {
      const url = new URL(env.DATABASE_URL)
      const targetDb = url.pathname.replace(/^\//, '')
      if (!targetDb) return

      // Connect to maintenance DB (postgres) on same host/port/user
      url.pathname = '/postgres'
      const client = new pg.Client({ connectionString: url.toString() })
      await client.connect()
      try {
        const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb])
        if (rows.length === 0) {
          // Safely quote identifier (database name)
          const ident = '"' + targetDb.replace(/"/g, '""') + '"'
          await client.query(`CREATE DATABASE ${ident}`)
          log('info', 'db.created', { database: targetDb })
        }
      } finally {
        await client.end().catch(() => {})
      }
    } catch (err) {
      log('warn', 'db.ensure_database_failed', { error: String(err) })
    }
  }

  async function createTables() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY,
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender text NOT NULL CHECK (sender IN ('user', 'ai')),
      text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at_id_desc
      ON messages (conversation_id, created_at DESC, id DESC);
  `)
  }

  try {
    await createTables()
  } catch (err: any) {
    // Postgres error code 3D000 = invalid_catalog_name (DB does not exist)
    if (err && typeof err === 'object' && err.code === '3D000') {
      log('warn', 'db.missing', { message: 'Database does not exist, attempting to create.' })
      await ensureDatabaseExists()
      // retry once
      await createTables()
      return
    }
    throw err
  }
}
