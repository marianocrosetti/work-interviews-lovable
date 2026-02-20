import { useState, useCallback, useRef, useEffect } from 'react';
import { chatApi } from '@/api';
import { ChatMessage, ChatEvent, MessageStep } from '@/types/chat';
import { usePreviewContext } from '@/context/PreviewContext';

// Store messages per project
const projectMessagesCache: Record<string, ChatMessage[]> = {};

// Function to clear chat history for a specific project
export function clearChatHistory(projectId?: string) {
  if (projectId) {
    // Clear only the specified project
    if (projectMessagesCache[projectId]) {
      console.log(`Clearing chat history for project ${projectId}`);
      projectMessagesCache[projectId] = [];
    }
  } else {
    // Clear all projects if no project ID specified
    console.log('Clearing all chat history');
    Object.keys(projectMessagesCache).forEach(key => {
      projectMessagesCache[key] = [];
    });
  }
}

export function useChat(projectId: string) {
  const previousProjectIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { triggerRefresh } = usePreviewContext();

  // Initialize or update messages when project changes
  useEffect(() => {
    if (!projectId || projectId === 'undefined') {
      console.log("useChat - Invalid projectId:", projectId);
      setMessages([]);
      previousProjectIdRef.current = null;
      return;
    }

    // Check if project has changed
    if (previousProjectIdRef.current !== projectId) {
      console.log(`useChat - Project changed from ${previousProjectIdRef.current} to ${projectId}`);
      
      // Load cached messages or initialize new array for this project
      const cachedMessages = projectMessagesCache[projectId] || [];
      console.log(`useChat - Loading ${cachedMessages.length} messages for project:`, projectId);
      
      setMessages(cachedMessages);
      previousProjectIdRef.current = projectId;
    }
  }, [projectId]);

  // Update cache when messages change
  useEffect(() => {
    if (projectId && projectId !== 'undefined') {
      console.log(`useChat - Updating cache for project ${projectId} with ${messages.length} messages`);
      projectMessagesCache[projectId] = [...messages];
    }
  }, [projectId, messages]);

  // Clear messages for the current project
  const clearMessages = useCallback(() => {
    if (projectId && projectId !== 'undefined') {
      console.log(`useChat - Clearing messages for project ${projectId}`);
      projectMessagesCache[projectId] = [];
      setMessages([]);
    }
  }, [projectId]);

  const processEvent = useCallback((event: ChatEvent, assistantMessageId: string) => {
    setMessages(prev => {
      const prevMessages = [...prev];
      const lastIndex = prevMessages.findIndex(m => m.id === assistantMessageId);
      
      if (lastIndex === -1) return prev;

      const updatedMessage = { ...prevMessages[lastIndex] };
      
      // Initialize steps array if it doesn't exist
      if (!updatedMessage.steps) {
        updatedMessage.steps = [];
      }

      // Create a new step based on the event
      const newStep: MessageStep = {
        id: `${assistantMessageId}-step-${updatedMessage.steps.length}`,
        type: event.type as 'thinking' | 'tool' | 'text',
        content: event.content || '',
        timestamp: new Date(),
        status: event.status
      };

      if (event.tool_name) {
        newStep.tool_name = event.tool_name;
      }
      if (event.tool_id) {
        newStep.tool_id = event.tool_id;
      }
      if (event.params) {
        newStep.params = event.params;
      }

      switch (event.type) {
        case 'thinking':
          // Update the main message to show thinking status
          updatedMessage.content = 'Thinking...';
          updatedMessage.event_type = 'thinking';
          updatedMessage.status = event.status;
          
          // Only add a new thinking step if it's different from the last one
          if (updatedMessage.steps.length === 0 || 
              updatedMessage.steps[updatedMessage.steps.length - 1].type !== 'thinking') {
            updatedMessage.steps.push(newStep);
          } else {
            // Update the existing thinking step
            const lastIndex = updatedMessage.steps.length - 1;
            updatedMessage.steps[lastIndex].content = 'Thinking...';
            updatedMessage.steps[lastIndex].timestamp = new Date();
          }
          break;

        case 'tool':
          // Update the message content to show tool usage
          updatedMessage.content = `Using ${event.tool_name}...`;
          updatedMessage.event_type = 'tool';
          updatedMessage.tool_name = event.tool_name;
          updatedMessage.tool_id = event.tool_id;
          updatedMessage.status = event.status;
          updatedMessage.params = event.params;
          
          if (event.content) {
            updatedMessage.content = event.content;
          }
          
          // Always add a new step for tools
          updatedMessage.steps.push(newStep);
          
          // Trigger refresh when file operations are complete
          if (event.status === 'completed' || event.status === 'failed') {
            const fileTools = ['write_file', 'edit_file', 'delete_file', 'reapply', 'run_terminal_cmd'];
            if (event.tool_name && fileTools.includes(event.tool_name)) {
              // Wait a short moment for file operations to complete
              setTimeout(() => triggerRefresh(), 500);
            }
          }
          break;

        case 'text':
          if (event.content) {
            // Always add text content to the current message
            if (updatedMessage.event_type === 'text') {
              // If the last step is text, update it
              const lastTextStepIndex = updatedMessage.steps.findIndex(step => step.type === 'text');
              if (lastTextStepIndex >= 0) {
                // Make sure we don't lose any content
                if (!updatedMessage.steps[lastTextStepIndex].content.includes(event.content)) {
                  updatedMessage.steps[lastTextStepIndex].content += event.content;
                }
                // Update the main message content as well
                updatedMessage.content = updatedMessage.steps[lastTextStepIndex].content;
              } else {
                // No text step exists yet, create a new one
                updatedMessage.steps.push(newStep);
                updatedMessage.content = event.content;
              }
            } else {
              // First text content
              updatedMessage.content = event.content;
              updatedMessage.event_type = 'text';
              updatedMessage.steps.push(newStep);
            }
          }
          break;

        case 'error':
          updatedMessage.content = `Error: ${event.error || 'Unknown error'}`;
          updatedMessage.event_type = 'text';
          updatedMessage.status = 'error';
          
          // Add error as a step
          newStep.content = `Error: ${event.error || 'Unknown error'}`;
          updatedMessage.steps.push(newStep);
          break;
      }

      prevMessages[lastIndex] = updatedMessage;
      projectMessagesCache[projectId] = prevMessages;
      return prevMessages;
    });
  }, [projectId, triggerRefresh]);

  const sendMessage = useCallback(async (message: string) => {
    if (!projectId || projectId === 'undefined') {
      console.error("Cannot send message: Invalid projectId", projectId);
      return;
    }

    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      type: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => {
      const updated = [...prev, userMessage];
      projectMessagesCache[projectId] = updated;
      return updated;
    });

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      content: 'Thinking...',
      type: 'assistant',
      event_type: 'thinking',
      timestamp: new Date()
    };
    
    setMessages(prev => {
      const updated = [...prev, assistantMessage];
      projectMessagesCache[projectId] = updated;
      return updated;
    });
    
    setIsStreaming(true);

    try {
      console.log("Starting chat stream for projectId:", projectId);
      
      for await (const event of chatApi.chat(projectId, message)) {
        processEvent(event, assistantMessageId);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      setMessages(prev => {
        const updated = [
          ...prev,
          {
            id: Date.now().toString(),
            content: `Error: ${errorMessage}`,
            type: 'assistant' as const,
            timestamp: new Date()
          }
        ];
        projectMessagesCache[projectId] = updated;
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, processEvent]);

  return {
    messages,
    sendMessage,
    isStreaming,
    clearMessages
  };
}
