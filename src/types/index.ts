/**
 * Shared types for Meteor extension
 */

// Message types for communication between components
export interface MeteorReadPageRequest {
  type: 'METEOR_READ_PAGE';
}

export interface MeteorPageContent {
  title: string;
  url: string;
  content: string;
  timestamp: number;
}

export interface MeteorPageError {
  error: string;
}

export type MeteorPageResponse = MeteorPageContent | MeteorPageError;

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

// UI State
export type ViewState = 'bootstrapping' | 'ready' | 'generating';

// Helper to check if response is an error
export function isPageError(response: MeteorPageResponse): response is MeteorPageError {
  return 'error' in response;
}

