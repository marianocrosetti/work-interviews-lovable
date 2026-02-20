
import { ChatEvent } from '@/types/chat';
import { API_BASE_URL, API_CONFIG } from './config';

export const chatApi = {
  chat: async function*(projectId: string, message: string): AsyncGenerator<ChatEvent> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
        body: JSON.stringify({
          project_id: projectId,
          message: message,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event = JSON.parse(line.slice(6)) as ChatEvent;
            yield event;
          }
        }
      }
    } catch (error) {
      console.error('Chat API call failed:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },
};
