import 'dotenv/config'
import { z } from 'zod'
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  LOG_FILE: z.string().default('logs/backend.log'),

  DATABASE_URL: z.string().min(1),

  CHAT_PAGE_SIZE: z.coerce.number().int().positive().max(100).default(10),

  OPENAI_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4.1-mini'),
  LLM_MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(2000),
  LLM_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().default(400),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),

  MAX_MESSAGE_CHARS: z.coerce.number().int().positive().max(10000).default(2000)
})

export const env = envSchema.parse(process.env)

