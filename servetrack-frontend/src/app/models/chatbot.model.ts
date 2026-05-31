export interface ChatVisualization {
  type: 'doughnut' | 'pie' | 'bar' | 'line';
  title?: string;
  data: { labels: string[]; values: number[] };
  colors?: string[];
}

export interface ChatbotAction {
  type: 'navigate' | 'action';
  label: string;
  icon?: string;
  url?: string;
  params?: Record<string, unknown>;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  isRetrying?: boolean;
  retryAttempt?: number;
  copied?: boolean;
  visualization?: ChatVisualization;
  action?: ChatbotAction;
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
