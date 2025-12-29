# Spur Support Chat - Full‑Stack Assessment

A small web app that simulates a customer support chat where an AI agent answers user questions using a real LLM API.

This repo contains:
- backend/ - TypeScript Express API with persistence and LLM integration
- frontend/ - React + Vite chat UI

## How to run locally

Prereqs: Node 20+, a running PostgreSQL instance.

1) Backend
- Copy backend/.env.example to backend/.env and fill values
- Install deps: npm install (in backend)
- Start dev: npm run dev
  - Server listens on PORT (default 3001)

2) Frontend
- Copy frontend/.env.example to frontend/.env
- Install deps: npm install (in frontend)
- Start dev: npm run dev
  - App runs on http://localhost:5173 and talks to the backend via VITE_API_BASE_URL

### PostgreSQL setup
- Provide a DATABASE_URL in backend/.env. On first boot the backend will auto-create tables via a lightweight init script.
- Example Docker (optional):
  docker run --name spur-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

## Environment variables

Backend (backend/.env):
- PORT: API port, default 3001
- CORS_ORIGIN: Allowed origin for CORS, default http://localhost:5173
- LOG_FILE: Log file path, default logs/backend.log
- DATABASE_URL: PostgreSQL connection string (required)
- CHAT_PAGE_SIZE: History pagination size, default 10
- OPENAI_API_KEY: API key for OpenAI (required)
- LLM_MODEL: Model name (default gpt-4.1-mini)
- LLM_MAX_CONTEXT_TOKENS: Soft cap for included context
- LLM_MAX_COMPLETION_TOKENS: Max tokens for a reply
- LLM_TIMEOUT_MS: LLM call timeout
- RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX_REQUESTS: in-memory rate limit config
- MAX_MESSAGE_CHARS: input length limit

Frontend (frontend/.env):
- VITE_API_BASE_URL: e.g. http://localhost:3001

## API Overview

- POST /api/v1/chat/message
  - Body: { message: string, sessionId: string (uuid) }
  - Returns: { reply: string, sessionId: string }
  - Behavior:
    - Validates visible text (rejects empty / invisible Unicode input)
    - Enforces per-session rate limiting (LLM-protected endpoint)
    - Persists user message
    - Calls the LLM
    - Persists AI reply
    - Returns a friendly error on LLM failure (user message remains persisted)

- GET /api/v1/chat/history
  - Query: { sessionId: string (uuid), cursor?: string, limit?: number }
  - Returns: { messages: Array<...>, nextCursor: string | null }
  - Behavior:
    - Cursor-based pagination for stable infinite scrolling
    - Loosely rate-limited per IP to tolerate fast virtualized scroll bursts


## Data model & persistence

Tables are created automatically on boot:
- conversations(id, created_at)
- messages(id, conversation_id, sender['user'|'ai'], text, created_at)

Conversations are keyed by a client-generated UUID stored in localStorage (sessionId). History supports pagination via a stable cursor.

## Frontend UX

- Floating chat widget with expand / collapse behavior
- Virtualized message list using react-virtuoso to avoid rendering large histories
- Cursor-based history loading when scrolling upward
- Distinct user / AI message bubbles
- Enter-to-send, disabled send during in-flight requests
- Agent typing indicator rendered inline as a message
- Auto-scroll to latest on send

## LLM integration

- Implemented with LangChain’s ChatOpenAI client (OpenAI GPT‑5 Mini).
- Why LangChain: future agentic patterns and easy model switching; only SDK/model wiring changes while the message format stays the same.
- System prompt seeds a store support persona and embeds a small FAQ for shipping/returns/support hours.
- Context is trimmed with a simple token budget heuristic.
- Guardrails are prompt-based:
  - The agent is instructed to focus on store-related questions.
  - Out-of-domain requests may be gently redirected, but hard enforcement is not implemented at the model level.
- LLM errors (timeouts, invalid keys, provider failures) are caught and surfaced as a friendly user-facing message.

### Channel‑agnostic service

- The core function is `generateSupportReply(history, userMessage)`.
- It accepts a simple, DB‑agnostic `history` array of `{ role: 'user' | 'ai', content: string }` (oldest → newest), plus the new `userMessage` string.
- This means you can reuse the same support agent for any channel (web chat, WhatsApp webhook, Instagram, SMS):
  - Map your channel’s recent messages to the `{role, content}` shape.
  - Call `generateSupportReply(history, userMessage)`.
  - Send the returned `reply` through that channel and persist messages using the repo functions.
  - No changes needed to the LLM service when adding new channels.

## Guardrails & robustness

- Input validation with zod
- Server-side rejection of messages that contain no visible characters
  (e.g., zero-width or directional Unicode marks)
- Length limits with clear error messages
- In-memory rate limiting with different strategies per endpoint:
  - POST /chat/message: strict per-session limits (LLM cost protection)
  - GET /chat/history: loose per-IP limits to tolerate virtualized scrolling
- Rate limiting is enforced before validation to protect against malformed or abusive requests
- Graceful handling of database and LLM failures
- Backend logging to logs/backend.log

## Architecture overview

Backend layers:
- Routes (Express): validation, rate limiting, orchestrate flow
- Services: LLM wrapper (`generateSupportReply(history, userMessage)` is channel‑agnostic), token budgeting
- Repos: SQL queries via a tiny tagged template helper
- DB: pg Pool and simple init script (no migrations for simplicity)

Frontend structure:
- chat/ChatWidget.tsx: main widget and UX logic
- chat/api.ts: typed API client with error forwarding
- chat/storage.ts: session id management via localstorage

## Notes and decisions

- LangChain was chosen to make future agentic use-cases (tools, multi-step workflows) straightforward and to swap providers with minimal surface area changes.
- Redis:
  - Redis was intentionally not introduced.
  - The app runs as a single-node service; in-memory rate limiting and PostgreSQL reads are sufficient.
  - Redis would become useful only with horizontal scaling or shared rate limiting across instances.
- RAG:
  - Not implemented; the FAQ is small and embedded in the prompt.
  - With larger knowledge bases, a retrieval step (e.g., pgvector) would be added before the LLM call.

## If I had more time

- Add provider factory to switch between OpenAI/Anthropic/Gemini via env without code changes
- Streaming responses to the UI (SSE) for better perceived latency
- Persistent + distributed rate limiting
- Introduce RAG with a vector database (e.g., pgvector/Pinecone) to scale domain knowledge and ground responses with retrieved context
