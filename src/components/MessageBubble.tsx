/**
 * MessageBubble - Individual chat message display
 * 
 * Handles both user and assistant messages with appropriate styling.
 * Supports markdown rendering for assistant responses.
 */

import ReactMarkdown from 'react-markdown';
import { User, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div 
      className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div 
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser 
            ? 'bg-meteor-border' 
            : 'bg-gradient-to-br from-meteor-accent/20 to-meteor-accent/5'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-meteor-muted" />
        ) : (
          <Sparkles className="w-4 h-4 text-meteor-accent" />
        )}
      </div>

      {/* Message content */}
      <div 
        className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}
      >
        <div 
          className={`inline-block rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-meteor-accent text-white rounded-tr-sm' 
              : 'bg-meteor-surface text-meteor-text rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className={`prose text-sm ${message.isStreaming ? 'typing-cursor' : ''}`}>
              <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-meteor-muted/50 mt-1 px-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

