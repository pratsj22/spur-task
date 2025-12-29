import pg from 'pg'
import { env } from '../env.js'

const { Pool } = pg

/**
 * Shared Postgres connection pool.
 *
 * All queries in the app go through this pool. The connection string comes from
 * DATABASE_URL so it works both locally and on hosted Postgres.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL
})
