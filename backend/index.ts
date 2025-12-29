import express, { type Request, type Response } from 'express'
import cors from 'cors'
import chatRoutes from './routes/chatRoute.js'
import { env } from './env.js'
import { initDb } from './db/init.js'
import crypto from 'crypto'
import { log } from './logger.js'

const app = express()

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: false
  })
)

app.use(express.json({ limit: '256kb' }))

app.use((req: Request, res: Response, next) => {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID()
  res.setHeader('x-request-id', requestId)
  res.locals.requestId = requestId

  const baseMeta = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  }

  log('info', 'request.start', {
    ...baseMeta,
    query: req.query,
    contentType: req.headers['content-type']
  })

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    log('info', 'request.finish', {
      ...baseMeta,
      status: res.statusCode,
      durationMs
    })
  })

  next()
})

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

app.use('/api/v1/chat', chatRoutes)

await initDb()

app.listen(env.PORT, () => {
  log('info', 'server.listening', { port: env.PORT })
})