/**
 * Meteor Side Panel App
 * 
 * The "Brain" of the extension. This React app:
 * 1. Initializes the AI model on mount
 * 2. Manages the summarization flow
 * 3. Streams responses to the UI
 * 4. Maintains conversation state with page context
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useMeteor } from '../hooks/useMeteor';
import { BootstrapView, ChatView, ErrorBanner } from '../components';
import type { ChatMessage, MeteorPageContent } from '../types';
import { isPageError } from '../types';

// System prompt for the AI
const SYSTEM_PROMPT = `You are Meteor, a helpful AI assistant running locally in the user's browser. You help users understand and analyze web page content. Be concise, accurate, and helpful. Format responses with markdown when appropriate.`;

// Build conversation prompt with context
function buildPrompt(
  pageContent: MeteorPageContent | null,
  messages: ChatMessage[],
  currentQuery: string
): string {
  let prompt = SYSTEM_PROMPT + '\n\n';

  // Add page context if available
  if (pageContent) {
    prompt += `=== CURRENT PAGE ===\n`;
    prompt += `Title: ${pageContent.title}\n`;
    prompt += `URL: ${pageContent.url}\n`;
    prompt += `Content:\n${pageContent.content}\n`;
    prompt += `=== END PAGE ===\n\n`;
  }

  // Add conversation history (last 6 messages for context window management)
  const recentMessages = messages.slice(-6);
  if (recentMessages.length > 0) {
    prompt += `=== CONVERSATION HISTORY ===\n`;
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant' && !msg.isStreaming) {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }
    prompt += `=== END HISTORY ===\n\n`;
  }

  // Add current query
  prompt += `User's current request: ${currentQuery}\n\n`;
  prompt += `Please respond helpfully based on the page content and conversation history.`;

  return prompt;
}

function App() {
  const meteor = useMeteor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPageTitle, setCurrentPageTitle] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  
  // Store page content for context in conversations
  const pageContentRef = useRef<MeteorPageContent | null>(null);

  // Initialize model on mount
  useEffect(() => {
    meteor.initialize();
  }, []);

  /**
   * Request page content from the active tab
   */
  const getPageContent = useCallback(async (): Promise<MeteorPageContent | null> => {
    setIsLoadingPage(true);
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Check if we can inject into this tab
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        throw new Error('Cannot read browser pages. Navigate to a website.');
      }

      // Send message to content script with timeout
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { type: 'METEOR_READ_PAGE' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Page load timeout. Try refreshing the page.')), 5000)
        )
      ]);

      if (isPageError(response)) {
        throw new Error(response.error);
      }

      const pageResponse = response as MeteorPageContent;
      setCurrentPageTitle(pageResponse.title);
      pageContentRef.current = pageResponse;
      setPageLoaded(true);
      return pageResponse;

    } catch (error) {
      console.error('[Meteor] Failed to get page content:', error);
      setPageLoaded(false);
      throw error;
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  // Auto-load page content when panel opens and model is ready
  useEffect(() => {
    if (meteor.isReady && !pageContentRef.current) {
      getPageContent().catch(err => {
        console.log('[Meteor] Auto-load page failed:', err);
        // Don't show error - user can manually trigger later
      });
    }
  }, [meteor.isReady, getPageContent]);

  /**
   * Send a message and get AI response
   */
  const sendMessage = useCallback(async (userMessage: string, isSummarize = false) => {
    if (!meteor.isReady || meteor.isGenerating) return;

    setActionError(null);

    try {
      // Get page content if we don't have it yet
      if (!pageContentRef.current) {
        await getPageContent();
      }

      const pageContent = pageContentRef.current;
      if (!pageContent) {
        throw new Error('Could not load page content');
      }

      // Create user message
      const displayMessage = isSummarize 
        ? `Summarize this page: ${pageContent.title}`
        : userMessage;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayMessage,
        timestamp: Date.now(),
      };

      // Create assistant message placeholder
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);

      // Build the full prompt with context
      const queryText = isSummarize 
        ? 'Please provide a clear, comprehensive summary of this page. Highlight the key points and main ideas.'
        : userMessage;

      const fullPrompt = buildPrompt(pageContent, [...messages, userMsg], queryText);

      // Generate response with streaming
      await meteor.generate(fullPrompt, (token) => {
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
      console.error('[Meteor] Message failed:', error);
      setActionError(
        error instanceof Error 
          ? error.message 
          : 'Failed to process message. Please try again.'
      );
      // Remove the failed assistant message
      setMessages(prev => prev.filter(m => !m.isStreaming));
    }
  }, [meteor, messages, getPageContent]);

  /**
   * Handle summarize button click
   */
  const handleSummarize = useCallback(() => {
    sendMessage('', true);
  }, [sendMessage]);

  /**
   * Handle custom message from chat input
   */
  const handleSendMessage = useCallback((message: string) => {
    sendMessage(message, false);
  }, [sendMessage]);

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
            onSendMessage={handleSendMessage}
            onRefreshPage={getPageContent}
            currentPageTitle={currentPageTitle}
            hasPageContent={pageLoaded}
            isLoadingPage={isLoadingPage}
          />
        </>
      )}
    </div>
  );
}

export default App;
