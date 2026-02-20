export type ChatEvent = {
  type: 'thinking' | 'tool' | 'text' | 'error';
  content?: string;
  error?: string;
  tool_name?: string;
  tool_id?: string;
  status?: string;
  params?: Record<string, unknown>;
};

export interface MessageStep {
  id: string;
  type: 'thinking' | 'tool' | 'text';
  content: string;
  tool_name?: string;
  tool_id?: string;
  params?: Record<string, unknown>;
  status?: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  event_type?: 'thinking' | 'tool' | 'text';
  tool_name?: string;
  tool_id?: string;
  status?: string;
  params?: Record<string, unknown>;
  steps?: MessageStep[];
}
