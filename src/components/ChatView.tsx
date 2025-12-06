/**
 * ChatView - Main chat interface
 * 
 * Displays messages and provides the primary action button
 * for summarizing the current page.
 */

import { useRef, useEffect } from 'react';
import { FileText, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSummarize: () => void;
  currentPageTitle: string | null;
}

export function ChatView({ 
  messages, 
  isGenerating, 
  onSummarize,
  currentPageTitle 
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-meteor-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-meteor-accent/20 to-meteor-accent/5 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-meteor-accent" />
          </div>
          <div>
            <h1 className="font-semibold text-meteor-text text-sm">Meteor AI</h1>
            <p className="text-xs text-meteor-muted">Local • Private • Fast</p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasMessages ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Action area */}
      <div className="flex-shrink-0 p-4 border-t border-meteor-border/50">
        {/* Current page indicator */}
        {currentPageTitle && (
          <div className="flex items-center gap-2 text-xs text-meteor-muted mb-3 px-1">
            <FileText className="w-3 h-3" />
            <span className="truncate">{currentPageTitle}</span>
          </div>
        )}

        {/* Summarize button */}
        <button
          onClick={onSummarize}
          disabled={isGenerating}
          className={`
            w-full py-3 px-4 rounded-xl font-medium text-sm
            flex items-center justify-center gap-2
            transition-all duration-200
            ${isGenerating 
              ? 'bg-meteor-surface text-meteor-muted cursor-not-allowed' 
              : 'bg-gradient-to-r from-meteor-accent to-meteor-accent-glow text-white hover:shadow-lg hover:shadow-meteor-accent/25 active:scale-[0.98]'
            }
          `}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>Summarize This Page</span>
            </>
          )}
        </button>

        {/* Privacy badge */}
        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-meteor-muted/40">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
          <span>Processing locally on your device</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-meteor-surface flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-meteor-muted/50" />
      </div>
      <h3 className="font-medium text-meteor-text mb-2">Ready to Summarize</h3>
      <p className="text-sm text-meteor-muted max-w-xs leading-relaxed">
        Click the button below to get an AI-powered summary of the current page.
      </p>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-300">{message}</p>
    </div>
  );
}

