export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ChatSession {
  session_id: string;
  messages: ChatMessage[];
}

export interface ChatApiResponse {
  success: boolean;
  message: string;
  session_id: string;
  metadata?: Record<string, unknown>;
}
