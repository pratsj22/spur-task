const SESSION_ID_KEY = 'spur_chat_session_id'

export function getOrCreateSessionId() {
  const existing = localStorage.getItem(SESSION_ID_KEY)
  if (existing) return existing

  const id = crypto.randomUUID()
  localStorage.setItem(SESSION_ID_KEY, id)
  return id
}
