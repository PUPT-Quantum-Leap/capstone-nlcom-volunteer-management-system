export interface ChatVisualization {
  type: 'bar' | 'pie' | 'line' | 'doughnut' | 'polarArea' | 'radar' | 'scatter' | 'bubble';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
    }[];
  };
  options?: any;
}

export interface ChatbotAction {
  label: string;
  action_type: 'navigate' | 'api_call' | 'dispatch_event' | 'open_modal';
  payload: Record<string, any>;
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
  actions?: ChatbotAction[];
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
