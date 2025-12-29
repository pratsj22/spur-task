import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { env } from '../../env.js'
import { FAQ_SEED } from './faq.js'
import { takeRecentWithinTokenBudget } from './tokenBudget.js'

/**
 * High-level system prompt that keeps the assistant focused on store support.
 * We also inject a short FAQ block with house policies to make answers consistent.
 */
const SYSTEM_PROMPT =
  `You are a helpful support agent for a small e-commerce store.
Only answer questions related to:
- orders
- shipping
- returns
- refunds
- store policies
- customer support

If a question is unrelated, politely refuse and redirect the user to store-related topics.
Do not perform general knowledge tasks, homework, coding, math, or image generation.`


/**
 * Ask the LLM for a support reply, given a conversation history and the new user message.
 *
 * history: array of chat turns (oldest -> newest), consisting only of role/content.
 * userMessage: the latest user input to answer.
 */
export async function generateSupportReply(
  historyOldestToNewest: Array<{ role: 'user' | 'ai'; content: string }>,
  userMessage: string
) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  // LLM client. We keep temperature low for crisp, policy-like answers.
  const model = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.LLM_MODEL,
    maxTokens: env.LLM_MAX_COMPLETION_TOKENS,
    timeout: env.LLM_TIMEOUT_MS,
    temperature: 0.1
  })

  // Build candidate history from provided turns and include the new user message as the freshest turn.
  // We construct newest->oldest for trimming with a simple token budget.
  const newestToOldest = [
    { role: 'user' as const, content: userMessage },
    ...historyOldestToNewest.slice().reverse()
  ]

  // Reserve a bit for overhead; keep it simple and configurable.
  const budget = Math.max(1, env.LLM_MAX_CONTEXT_TOKENS)

  const { selectedNewestToOldest } = takeRecentWithinTokenBudget({
    maxTokens: budget,
    newestToOldest
  })

  const selectedOldestToNewest = selectedNewestToOldest.slice().reverse()

  // Compose LangChain message objects: one system preamble + alternating human/AI turns.
  const lcMessages = [
    new SystemMessage(`${SYSTEM_PROMPT}\n\n${FAQ_SEED}`),
    ...selectedOldestToNewest.map((m) => {
      if (m.role === 'user') return new HumanMessage(m.content)
      return new AIMessage(m.content)
    })
  ]

  const res = await model.invoke(lcMessages)
  const text = (res.content ?? '').toString().trim()

  return text || "I'm sorry - I couldn't generate a response right now."
}
