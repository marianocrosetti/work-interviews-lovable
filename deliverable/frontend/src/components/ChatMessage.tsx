import React, { useState } from 'react';
import { LoaderCircle, ChevronDown, ChevronRight, Clock, WrenchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage as ChatMessageType, MessageStep } from '@/types/chat';
import { useUserSettings } from '@/context/UserSettingsContext';

// Simple helper to convert basic markdown code blocks to HTML
function formatCodeBlocks(text: string): string {
  // Replace ```language\ncode\n``` with <pre><code>code</code></pre>
  const formattedText = text.replace(
    /```(\w*)\n([\s\S]*?)\n```/g,
    (_, language, code) => 
      `<pre class="bg-slate-800 rounded-md p-3 overflow-x-auto my-2"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  );

  // Replace inline `code` with <code>code</code>
  return formattedText.replace(
    /`([^`]+)`/g,
    (_, code) => `<code class="bg-slate-800 px-1 py-0.5 rounded text-xs">${code}</code>`
  );
}

// Helper to format tool parameters in a more readable way
const formatToolParams = (params: Record<string, unknown>): JSX.Element => {
  return (
    <div className="mt-2 text-xs text-slate-400 border-l border-slate-600 pl-2">
      <div>Parameters:</div>
      <div className="mt-1 bg-slate-800 p-2 rounded overflow-x-auto">
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="mb-1">
            <span className="text-blue-300">{key}:</span> 
            {typeof value === 'string' ? (
              <span className="ml-1 text-slate-200">{value}</span>
            ) : (
              <span className="ml-1 text-slate-200">{JSON.stringify(value)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Get status badge based on the tool's status
function getStatusBadge(status: string | undefined) {
  if (!status) return null;
  
  const statusMap: Record<string, { color: string, label: string }> = {
    'started': { color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50', label: 'Started' },
    'partial': { color: 'bg-blue-500/20 text-blue-400 border border-blue-500/50', label: 'In Progress' },
    'executing': { color: 'bg-blue-500/20 text-blue-400 border border-blue-500/50', label: 'Executing' },
    'completed': { color: 'bg-green-500/20 text-green-400 border border-green-500/50', label: 'Completed' },
    'failed': { color: 'bg-red-500/20 text-red-400 border border-red-500/50', label: 'Failed' }
  };

  const { color, label } = statusMap[status] || { color: 'bg-slate-500/20 text-slate-400 border border-slate-500/50', label: status };
  
  return (
    <span className={cn("ml-2 px-2 py-0.5 rounded text-xs", color)}>
      {label}
    </span>
  );
}

// Component to render a message step
const MessageStepItem: React.FC<{
  step: MessageStep;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}> = ({ step, isCollapsed = false, toggleCollapse }) => {
  const { settings } = useUserSettings();
  const isThinking = step.type === 'thinking';
  const isTool = step.type === 'tool';
  const isText = step.type === 'text';
  
  // Format text content with basic markdown for code blocks
  const formattedContent = isText ? formatCodeBlocks(step.content) : step.content;
  
  // Timestamp formatting
  const formattedTime = settings.showTimestamps 
    ? step.timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    : '';
  
  return (
    <div className={cn(
      "border-l-2 pl-3 py-1 mb-2 relative",
      isThinking ? "border-yellow-500" : 
      isTool ? "border-blue-500" : 
      "border-green-500"
    )}>
      {/* Step timestamp indicator */}
      <div className={cn(
        "absolute -left-2 -top-1 w-4 h-4 rounded-full border-2 border-slate-900",
        isThinking ? "bg-yellow-500" : 
        isTool ? "bg-blue-500" : 
        "bg-green-500"
      )}></div>
      
      {/* Step header */}
      <div className="flex items-center text-xs text-slate-400 mb-1">
        {settings.showTimestamps && (
          <>
            <Clock size={12} className="mr-1" />
            <span className="mr-2">{formattedTime}</span>
          </>
        )}
        <span className={cn(
          "font-medium",
          isThinking ? "text-yellow-500" : 
          isTool ? "text-blue-500" : 
          "text-green-500"
        )}>
          {isThinking ? "Thinking" : isTool ? `Tool: ${step.tool_name}` : "Response"}
        </span>
        
        {/* Status badge for tools */}
        {isTool && getStatusBadge(step.status)}
        
        {/* Collapse toggle for thinking steps */}
        {isThinking && toggleCollapse && (
          <button 
            onClick={toggleCollapse}
            className="ml-auto text-slate-400 hover:text-white"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {/* Collapse toggle for tool steps with parameters */}
        {isTool && step.params && settings.showToolParameters && (
          <button 
            onClick={toggleCollapse}
            className="ml-auto text-slate-400 hover:text-white"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      
      {/* Step content */}
      {(!isThinking || !isCollapsed) && (
        <div className={cn("text-sm", isThinking ? "text-slate-300" : "text-white")}>
          {isThinking && (
            <div className="flex items-center gap-2 text-yellow-500 font-light italic">
              {isCollapsed ? null : <LoaderCircle className="animate-spin" size={14} />}
              <span>Thinking...</span>
            </div>
          )}
          
          {isTool && (
            <div>
              <div className="flex items-center text-xs text-blue-400 mb-1">
                <WrenchIcon size={14} className="mr-1" />
                <span>{step.tool_name}</span>
              </div>
              
              <p className="text-sm">{step.content}</p>
              
              {/* Tool parameters (collapsible) */}
              {settings.showToolParameters && step.params && !isCollapsed && formatToolParams(step.params)}
            </div>
          )}
          
          {isText && (
            <div className="whitespace-pre-wrap">
              {step.content ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                  className="markdown prose prose-invert text-white max-w-none prose-p:my-1 prose-pre:my-2"
                />
              ) : (
                <div className="text-slate-400 italic">Empty response</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ChatMessageProps {
  message: ChatMessageType;
  streaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, streaming = false }) => {
  const isUser = message.type === 'user';
  const { settings } = useUserSettings();
  
  // Initial state for collapsing - use settings for default
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>(() => {
    if (message.steps) {
      return message.steps.reduce((acc, step) => {
        // Collapse thinking steps by default if the setting is enabled
        if (step.type === 'thinking' && settings.collapseThinkingByDefault) {
          acc[step.id] = true;
        }
        return acc;
      }, {} as Record<string, boolean>);
    }
    return {};
  });
  
  // Toggle collapse state for a specific step
  const toggleStepCollapse = (stepId: string) => {
    setCollapsedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };
  
  // For user messages, just show the content
  if (isUser) {
    return (
      <div className="flex justify-end my-4">
        <div className="rounded-lg px-4 py-2 max-w-[85%] bg-blue-600 text-white">
          <p className="text-sm">{message.content}</p>
          {settings.showTimestamps && (
            <div className="text-xs opacity-70 mt-1 text-right">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // For assistant messages, show steps or regular content
  const hasSteps = message.steps && message.steps.length > 0;
  
  return (
    <div className="flex my-4">
      <div className="rounded-lg px-4 py-3 max-w-[85%] bg-slate-700 text-white">
        {/* Avatar for assistant */}
        <div className="flex items-center mb-3">
          <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-xs font-bold">AI</span>
          </div>
          <span className="ml-2 text-sm text-slate-300">Assistant</span>
        </div>
        
        {/* Show steps for assistant messages if available */}
        {hasSteps ? (
          <div className="mt-2 border-t border-slate-600 pt-2">
            {message.steps.map((step) => (
              <MessageStepItem 
                key={step.id} 
                step={step}
                isCollapsed={collapsedSteps[step.id]}
                toggleCollapse={() => toggleStepCollapse(step.id)}
              />
            ))}
            
            {/* Show spinner if still streaming */}
            {streaming && (
              <div className="flex items-center gap-2 text-slate-400 mt-2">
                <LoaderCircle className="animate-spin" size={14} />
                <span className="text-xs">Still thinking...</span>
              </div>
            )}
          </div>
        ) : (
          // Fallback for messages without steps
          <div className="whitespace-pre-wrap text-sm">
            {message.event_type === 'thinking' ? (
              <div className="flex items-center gap-2">
                <LoaderCircle className="animate-spin" size={16} />
                <span>Thinking...</span>
              </div>
            ) : (
              message.content ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: formatCodeBlocks(message.content) }}
                  className={cn("markdown prose prose-invert text-white max-w-none prose-p:my-1 prose-pre:my-2", streaming && "markdown-streaming")}
                />
              ) : (
                <div className="text-slate-400 italic">Empty response</div>
              )
            )}
          </div>
        )}
        
        {/* Timestamp */}
        {settings.showTimestamps && (
          <div className="text-xs opacity-70 mt-3 text-right border-t border-slate-600 pt-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}; 