import type { HistoryResponse, SendMessageResponse } from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001'

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init)
  const contentType = res.headers.get('content-type') ?? ''

  let body: unknown = null
  if (contentType.includes('application/json')) {
    body = await res.json().catch(() => null)
  } else {
    body = await res.text().catch(() => null)
  }

  if (!res.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body ? String((body as any).error) : 'Request failed'
    // Throw a structured error to allow UI to show backend-provided messages
    throw {
      error: message,
      status: res.status,
      statusText: res.statusText,
      details: body
    } as const
  }

  return body as T
}

export async function fetchHistory(args: { sessionId: string; cursor?: string }) {
  const url = new URL(API_BASE_URL + '/api/v1/chat/history')
  url.searchParams.set('sessionId', args.sessionId)
  if (args.cursor) url.searchParams.set('cursor', args.cursor)

  return await fetchJson<HistoryResponse>(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })
}

export async function sendMessage(args: {
  sessionId: string
  message: string
}) {
  return await fetchJson<SendMessageResponse>(API_BASE_URL + '/api/v1/chat/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      message: args.message,
      sessionId: args.sessionId
    })
  })
}
