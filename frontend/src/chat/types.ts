export type ChatSender = 'user' | 'ai'

export type ChatMessage = {
  id: string
  conversation_id: string
  sender: ChatSender
  text: string
  created_at: string
}

export type HistoryResponse = {
  messages: ChatMessage[]
  nextCursor: string | null
}

export type SendMessageResponse = {
  reply: string
  sessionId: string
}
