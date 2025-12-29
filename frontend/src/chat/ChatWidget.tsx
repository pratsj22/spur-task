import { useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { ChatMessage } from './types'
import { getOrCreateSessionId } from './storage'
import { fetchHistory, sendMessage } from './api'

const MAX_MESSAGE_CHARS = 2000
const FIRST_INDEX = 100_000
//virtuoso asks for a higher first index for better scroll positioning

type DraftState = {
  text: string
  error: string | null
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8a10.2 10.2 0 0 1-3.642-.667L3 21l1.58-4.08A7.63 7.63 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconExpand() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


export default function ChatWidget() {
  const sessionId = useMemo(() => getOrCreateSessionId(), [])

  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const [draft, setDraft] = useState<DraftState>({ text: '', error: null })

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [firstItemIndex, setFirstItemIndex] = useState(FIRST_INDEX)

  const suggested = [
    "What's your return policy?",
    'How long does shipping take?',
    'What are your support hours?'
  ]

  const typingMessage: ChatMessage | null = isSending
    ? {
      id: '__typing__',
      conversation_id: sessionId,
      sender: 'ai',
      text: 'Agent is typing…',
      created_at: new Date().toISOString()
    }
    : null

  const renderedMessages = typingMessage
    ? [...messages, typingMessage]
    : messages


  async function loadInitial() {
    setIsLoadingHistory(true)
    try {
      const res = await fetchHistory({ sessionId })
      setMessages(res.messages)
      setNextCursor(res.nextCursor)
      setHasMore(res.messages.length > 0)
      setFirstItemIndex(0)

      // force scroll AFTER first render
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: res.messages.length - 1,
          align: 'end',
          behavior: 'auto'
        })
      })
    } catch {
      setRequestError('Failed to load chat history')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  async function loadOlder() {
    if (!hasMore || !nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const res = await fetchHistory({ sessionId, cursor: nextCursor })
      if (res.messages.length === 0) {
        setHasMore(false)
        return
      }
      setFirstItemIndex((i) => i - res.messages.length)
      setMessages((prev) => [...res.messages, ...prev])
      setNextCursor(res.nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadInitial()
    }
  }, [isOpen])


  useEffect(() => {
    const t = draft.text.trim()
    if (!t) {
      setDraft((d) => ({ ...d, error: null }))
    } else if (t.length > MAX_MESSAGE_CHARS) {
      setDraft((d) => ({
        ...d,
        error: `Max ${MAX_MESSAGE_CHARS} characters`
      }))
    } else {
      setDraft((d) => ({ ...d, error: null }))
    }
  }, [draft.text])


  async function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isSending || trimmed.length > MAX_MESSAGE_CHARS) return

    setIsSending(true)
    setRequestError(null)

    const optimisticUser: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: sessionId,
      sender: 'user',
      text: trimmed,
      created_at: new Date().toISOString()
    }

    setMessages((prev) => [...prev, optimisticUser])
    setDraft({ text: '', error: null })

    try {
      const res = await sendMessage({ sessionId, message: trimmed })
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          conversation_id: res.sessionId,
          sender: 'ai',
          text: res.reply,
          created_at: new Date().toISOString()
        }
      ])
      // ALWAYS scroll when USER sends a message
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length+1,
          align: 'end',
          behavior: 'auto'
        })
      })
    } catch(err:any) {
      console.log(err);
      console.log(err.error);
      
      setRequestError(err.error??'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }
  const panelClass = isExpanded
    ? 'h-[85vh] w-[min(720px,calc(100vw-2rem))]'
    : 'h-[520px] w-[min(380px,calc(100vw-2rem))]'

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg"
          onClick={() => setIsOpen(true)}
        >
          <IconChat />
        </button>
      ) : (
        <div className={`${panelClass} rounded-2xl border border-zinc-200 bg-white shadow-xl flex flex-col`}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Support</div>
              <div className="text-xs text-zinc-500">
                Ask about shipping, returns, orders
              </div>
            </div>
            <div className="flex gap-5">
              <button onClick={() => setIsExpanded((v) => !v)} title="Expand">
                <IconExpand />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsExpanded(false)
                }}
                title="Close"
              >
                <IconX />
              </button>
            </div>
          </div>

          <div className="flex-1 py-2">
            {isLoadingHistory ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Loading…
              </div>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                data={renderedMessages}
                firstItemIndex={firstItemIndex}
                startReached={loadOlder}
                followOutput={atBottom ? 'auto' : false}
                atBottomStateChange={setAtBottom}
                itemContent={(_, m) => (
                  <div className="px-4 py-2">
                    <div className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender === 'user'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-900'
                          }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  </div>
                )}
                components={{
                  EmptyPlaceholder: () => (
                    <div className="px-4 py-6">
                      <div className="text-sm font-medium">Hi! How can I help?</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggested.map((q) => (
                          <button
                            key={q}
                            className="rounded-full border border-zinc-200 px-3 py-1 text-xs"
                            onClick={() => setDraft({ text: q, error: null })}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                }}
              />
            )}
          </div>

          <div className="border-t border-zinc-200 px-4 py-4">
            {requestError && (
              <div className="mb-2 text-xs text-red-600">{requestError}</div>
            )}

            <div className="flex gap-2">
              <textarea
                value={draft.text}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, text: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend(draft.text)
                  }
                }}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-3 text-sm"
                placeholder="Type a message…"
              />
              <button
                disabled={isSending || !!draft.error || !draft.text.trim()}
                onClick={() => void handleSend(draft.text)}
                className="rounded-xl bg-zinc-900 px-4 text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>

            {draft.error && (
              <div className="mt-1 text-xs text-red-600">{draft.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
