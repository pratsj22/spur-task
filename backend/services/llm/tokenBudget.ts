/**
 * Pick as many recent messages as will fit within a rough token budget.
 *
 * This uses a simple heuristic (~4 chars per token) which is good enough
 * for short support chats. If needed later, we can swap in a proper
 * tokenizer without changing callers.
 */
export function takeRecentWithinTokenBudget(args: {
  maxTokens: number
  newestToOldest: Array<{ role: 'user' | 'ai'; content: string }>
}) {
  const selected: Array<{ role: 'user' | 'ai'; content: string }> = []
  let used = 0

  for (const m of args.newestToOldest) {
    // simple heuristic: ~4 chars per token for English.
    // can introduce token counting library in future
    const tokens = Math.ceil(m.content.length / 4)
    if (used + tokens > args.maxTokens) break
    selected.push(m)
    used += tokens
  }

  return { selectedNewestToOldest: selected, usedTokens: used }
}
