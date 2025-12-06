/**
 * Meteor Side Panel App
 * 
 * The "Brain" of the extension. This React app:
 * 1. Initializes the AI model on mount
 * 2. Manages the summarization flow
 * 3. Streams responses to the UI
 */

import { useEffect, useState, useCallback } from 'react';
import { useMeteor } from '../hooks/useMeteor';
import { BootstrapView, ChatView, ErrorBanner } from '../components';
import type { ChatMessage, MeteorPageContent } from '../types';
import { isPageError } from '../types';

// Prompt template for summarization
const SUMMARIZE_PROMPT = (title: string, content: string) => `You are a helpful AI assistant. Please provide a clear, concise summary of the following web page content.

**Page Title:** ${title}

**Content:**
${content}

Please summarize the key points in a well-organized format. Use bullet points for main ideas and keep it concise but comprehensive.`;

function App() {
  const meteor = useMeteor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPageTitle, setCurrentPageTitle] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Initialize model on mount
  useEffect(() => {
    meteor.initialize();
  }, []);

  /**
   * Request page content from the active tab
   */
  const getPageContent = useCallback(async (): Promise<MeteorPageContent | null> => {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Check if we can inject into this tab
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        throw new Error('Cannot read content from browser pages. Please navigate to a website.');
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { 
        type: 'METEOR_READ_PAGE' 
      });

      if (isPageError(response)) {
        throw new Error(response.error);
      }

      setCurrentPageTitle(response.title);
      return response;

    } catch (error) {
      console.error('[Meteor] Failed to get page content:', error);
      throw error;
    }
  }, []);

  /**
   * Handle summarize button click
   */
  const handleSummarize = useCallback(async () => {
    if (!meteor.isReady || meteor.isGenerating) return;

    setActionError(null);

    try {
      // Get page content
      const pageContent = await getPageContent();
      if (!pageContent) return;

      // Create user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: `Summarize: ${pageContent.title}`,
        timestamp: Date.now(),
      };

      // Create assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);

      // Generate summary with streaming
      const prompt = SUMMARIZE_PROMPT(pageContent.title, pageContent.content);
      
      await meteor.generate(prompt, (token) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content += token;
          }
          return updated;
        });
      });

      // Mark as done streaming
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false;
        }
        return updated;
      });

    } catch (error) {
      console.error('[Meteor] Summarization failed:', error);
      setActionError(
        error instanceof Error 
          ? error.message 
          : 'Failed to summarize page. Please try again.'
      );
    }
  }, [meteor, getPageContent]);

  // Determine which view to show
  const isBootstrapping = 
    meteor.status === 'idle' || 
    meteor.status === 'checking' || 
    meteor.status === 'downloading' || 
    meteor.status === 'loading';

  return (
    <div className="h-screen w-full bg-meteor-bg overflow-hidden">
      {isBootstrapping || meteor.status === 'error' ? (
        <BootstrapView 
          progress={meteor.progress}
          progressText={meteor.progressText}
          error={meteor.error}
        />
      ) : (
        <>
          {actionError && <ErrorBanner message={actionError} />}
          <ChatView
            messages={messages}
            isGenerating={meteor.isGenerating}
            onSummarize={handleSummarize}
            currentPageTitle={currentPageTitle}
          />
        </>
      )}
    </div>
  );
}

export default App;

