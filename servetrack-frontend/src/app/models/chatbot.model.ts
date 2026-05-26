export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  isRetrying?: boolean;
  retryAttempt?: number;
  copied?: boolean;
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
