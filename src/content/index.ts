/**
 * Meteor Content Script
 * 
 * The "Eyes" of the extension - injects into web pages.
 * Its job is to:
 * 1. Listen for commands from the Side Panel
 * 2. Scrape and clean page content
 * 3. Return sanitized text back to the sender
 */

// Message types for type safety
interface MeteorReadPageRequest {
  type: 'METEOR_READ_PAGE';
}

interface MeteorPageContent {
  title: string;
  url: string;
  content: string;
  timestamp: number;
}

// Maximum characters to extract (token safety - prevents WebGPU OOM)
const MAX_CONTENT_LENGTH = 15000;

/**
 * Sanitizes the DOM by removing noise elements
 */
function sanitizeClone(clone: HTMLElement): void {
  const noisyTags = ['script', 'style', 'nav', 'footer', 'svg', 'noscript', 'iframe', 'aside', 'header'];
  
  noisyTags.forEach(tag => {
    const elements = clone.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // Remove hidden elements
  const allElements = clone.querySelectorAll('*');
  allElements.forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      el.remove();
    }
  });

  // Remove common ad/tracking class patterns
  const adPatterns = ['ad', 'advertisement', 'promo', 'banner', 'cookie', 'popup', 'modal'];
  adPatterns.forEach(pattern => {
    clone.querySelectorAll(`[class*="${pattern}"], [id*="${pattern}"]`).forEach(el => el.remove());
  });
}

/**
 * Extracts and cleans text content from the page
 */
function extractPageContent(): MeteorPageContent {
  // Clone the body to avoid modifying the actual DOM
  const bodyClone = document.body.cloneNode(true) as HTMLElement;
  
  // Remove noisy elements
  sanitizeClone(bodyClone);
  
  // Extract text
  let content = bodyClone.innerText || '';
  
  // Clean up whitespace
  content = content
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
    .trim();
  
  // Truncate for token safety
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated for processing...]';
  }
  
  return {
    title: document.title || 'Untitled Page',
    url: window.location.href,
    content,
    timestamp: Date.now(),
  };
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((
  message: MeteorReadPageRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MeteorPageContent | { error: string }) => void
) => {
  if (message.type === 'METEOR_READ_PAGE') {
    try {
      const pageContent = extractPageContent();
      console.log('[Meteor] Page scraped:', {
        title: pageContent.title,
        contentLength: pageContent.content.length,
      });
      sendResponse(pageContent);
    } catch (error) {
      console.error('[Meteor] Scraping failed:', error);
      sendResponse({ 
        error: error instanceof Error ? error.message : 'Unknown scraping error' 
      });
    }
  }
  
  // Return true to indicate async response
  return true;
});

console.log('[Meteor] Content script loaded');

