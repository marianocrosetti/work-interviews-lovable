import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Send } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useToast } from '@/hooks/use-toast';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatSettings } from '@/components/ChatSettings';

interface ChatPanelProps {
  projectId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ projectId }) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { messages, sendMessage, isStreaming } = useChat(projectId);

  useEffect(() => {
    console.log(`ChatPanel - Displaying ${messages.length} messages for projectId: ${projectId}`);
  }, [projectId, messages.length]);

  const handleSendMessage = () => {
    if (input.trim() || selectedImage) {
      sendMessage(input);
      setInput('');
      setSelectedImage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasValidProjectId = !!projectId && projectId !== 'undefined';

  return (
    <div className="flex flex-col h-full border-r border-slate-700">
      {hasValidProjectId ? (
        <>
          {/* Chat header with settings */}
          <div className="sticky top-0 z-40 p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center h-[60px] shadow-md">
            <h2 className="text-base font-medium text-white">Chat</h2>
            <ChatSettings />
          </div>
          
          <div className="flex-1 overflow-y-auto bg-slate-900 p-4">
            {messages.length > 0 ? (
              messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  streaming={isStreaming && message.id === messages[messages.length - 1].id && message.type === 'assistant'} 
                />
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Start a conversation for this project
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 bg-slate-800 border-t border-slate-700">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? "Assistant is thinking..." : "Ask anything..."}
                className="w-full p-3 pr-24 bg-slate-700 text-white rounded resize-none border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                rows={3}
                disabled={isStreaming}
              />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePaperclipClick}
                  disabled={isStreaming}
                >
                  <Paperclip size={16} />
                </Button>
                <Button 
                  className="h-8 w-8"
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !selectedImage) || isStreaming}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
            {selectedImage && (
              <div className="mt-2 p-2 bg-slate-700 rounded flex items-center justify-between">
                <span className="text-sm text-slate-300 truncate">{selectedImage.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImage(null)}
                  className="text-slate-400 hover:text-white"
                  disabled={isStreaming}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-500">
          Select a project to start chatting
        </div>
      )}
    </div>
  );
}

export default ChatPanel;
