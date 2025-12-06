/**
 * ChatView - Main chat interface
 * 
 * Displays messages and provides the primary action button
 * for summarizing the current page, plus a chat input for questions.
 */

import { useRef, useEffect, useState } from 'react';
import { FileText, Loader2, Sparkles, Send, AlertCircle, RefreshCw } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSummarize: () => void;
  onSendMessage: (message: string) => void;
  onRefreshPage: () => Promise<unknown>;
  currentPageTitle: string | null;
  hasPageContent: boolean;
  isLoadingPage: boolean;
}

export function ChatView({ 
  messages, 
  isGenerating, 
  onSummarize,
  onSendMessage,
  onRefreshPage,
  currentPageTitle,
  hasPageContent,
  isLoadingPage,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSend = () => {
    if (inputValue.trim() && !isGenerating) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      <div className="flex-shrink-0 p-4 border-t border-meteor-border/50 space-y-3">
        {/* Current page indicator */}
        <div className="flex items-center gap-2 text-xs text-meteor-muted px-1">
          <FileText className="w-3 h-3" />
          <span className="truncate flex-1">
            {isLoadingPage ? 'Loading page...' : currentPageTitle || 'No page loaded'}
          </span>
          {isLoadingPage ? (
            <Loader2 className="w-3 h-3 animate-spin text-meteor-accent" />
          ) : hasPageContent ? (
            <span className="text-green-500 text-[10px]">● ready</span>
          ) : (
            <button 
              onClick={() => onRefreshPage().catch(() => {})}
              className="text-meteor-accent hover:text-meteor-accent-glow flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Load</span>
            </button>
          )}
        </div>

        {/* Quick action: Summarize - always available as a button */}
        {!hasMessages && hasPageContent && (
          <button
            onClick={onSummarize}
            disabled={isGenerating}
            className={`
              w-full py-2.5 px-4 rounded-xl font-medium text-sm
              flex items-center justify-center gap-2
              transition-all duration-200
              bg-meteor-surface border border-meteor-border/50 text-meteor-text
              hover:bg-meteor-border/30 hover:border-meteor-accent/30
              disabled:opacity-50 disabled:cursor-not-allowed
              active:scale-[0.98]
            `}
          >
            <FileText className="w-4 h-4 text-meteor-accent" />
            <span>Summarize This Page</span>
          </button>
        )}

        {/* Chat input */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
              isLoadingPage 
                ? "Loading page..." 
                : hasPageContent 
                  ? "Ask anything about this page..." 
                  : "Click 'Load' above to read this page"
            }
              disabled={isGenerating || !hasPageContent}
              rows={1}
              className={`
                w-full px-4 py-3 rounded-xl text-sm resize-none
                bg-meteor-surface border border-meteor-border/50
                text-meteor-text placeholder-meteor-muted/50
                focus:outline-none focus:border-meteor-accent/50 focus:ring-1 focus:ring-meteor-accent/25
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              `}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isGenerating || !inputValue.trim() || !hasPageContent}
            className={`
              p-3 rounded-xl transition-all duration-200
              ${isGenerating || !inputValue.trim() || !hasPageContent
                ? 'bg-meteor-surface text-meteor-muted cursor-not-allowed'
                : 'bg-meteor-accent text-white hover:bg-meteor-accent-glow active:scale-95'
              }
            `}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-meteor-muted/40">
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
        <Sparkles className="w-8 h-8 text-meteor-accent/70" />
      </div>
      <h3 className="font-medium text-meteor-text mb-2">Ask Me Anything</h3>
      <p className="text-sm text-meteor-muted max-w-xs leading-relaxed">
        I've read this page. Ask questions, request a summary, or explore the content. All processing happens locally.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <span className="px-3 py-1.5 text-xs bg-meteor-surface rounded-full text-meteor-muted">
          "What's the main topic?"
        </span>
        <span className="px-3 py-1.5 text-xs bg-meteor-surface rounded-full text-meteor-muted">
          "Any pricing info?"
        </span>
        <span className="px-3 py-1.5 text-xs bg-meteor-surface rounded-full text-meteor-muted">
          "Key takeaways?"
        </span>
      </div>
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
