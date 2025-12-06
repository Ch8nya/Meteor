/**
 * useMeteor - The AI Brain Hook
 * 
 * Manages the complete lifecycle of the Ministral 3B model:
 * 1. WebGPU compatibility check
 * 2. Model download with progress tracking
 * 3. Text generation with streaming
 * 
 * Based on Mistral's official WebGPU demo:
 * https://huggingface.co/spaces/mistralai/Ministral_3B_WebGPU
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  AutoProcessor,
  AutoModelForImageTextToText,
  TextStreamer,
  env,
} from '@huggingface/transformers';

// Configure transformers.js for Chrome extension environment
env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

// Point to local WASM files (copied by vite-plugin-static-copy)
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
}

// Model configuration - Official Mistral ONNX model
const MODEL_ID = 'mistralai/Ministral-3-3B-Instruct-2512-ONNX';

// Model states
export type MeteorStatus = 
  | 'idle'           // Initial state
  | 'checking'       // Checking WebGPU compatibility
  | 'downloading'    // Downloading model weights
  | 'loading'        // Loading model into memory
  | 'ready'          // Model loaded and ready
  | 'generating'     // Currently generating text
  | 'error';         // Something went wrong

export interface MeteorState {
  status: MeteorStatus;
  progress: number;           // 0-100 for download progress
  progressText: string;       // Human readable progress
  error: string | null;       // Error message if any
  isReady: boolean;           // Convenience flag
  isGenerating: boolean;      // Convenience flag
}

export interface MeteorActions {
  initialize: () => Promise<void>;
  generate: (prompt: string, onToken: (token: string) => void) => Promise<string>;
  abort: () => void;
}

export interface UseMeteorReturn extends MeteorState, MeteorActions {}

export function useMeteor(): UseMeteorReturn {
  const [status, setStatus] = useState<MeteorStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Check WebGPU compatibility
   */
  const checkWebGPU = useCallback(async (): Promise<boolean> => {
    if (!navigator.gpu) {
      throw new Error(
        'WebGPU is not supported in this browser. ' +
        'Please use Chrome 113+ or Edge with hardware acceleration enabled.'
      );
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error(
        'No WebGPU adapter found. ' +
        'Please ensure hardware acceleration is enabled in your browser settings.'
      );
    }

    return true;
  }, []);

  /**
   * Initialize the model
   */
  const initialize = useCallback(async () => {
    if (status === 'ready' || status === 'loading' || status === 'downloading') {
      return; // Already initialized or in progress
    }

    try {
      setStatus('checking');
      setError(null);
      setProgress(0);

      // Check WebGPU compatibility
      await checkWebGPU();
      setProgressText('WebGPU detected ✓');

      setStatus('downloading');
      setProgressText('Preparing to download model...');

      // Track overall progress across all files
      const fileProgress: Record<string, number> = {};
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const progressCallback = (event: any) => {
        if (event.status === 'progress' && event.progress !== undefined && event.file) {
          fileProgress[event.file] = event.progress;
          
          // Calculate average progress across all tracked files
          const values = Object.values(fileProgress);
          const avgProgress = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
          
          setProgress(Math.round(avgProgress));
          setProgressText(`Downloading: ${Math.round(avgProgress)}%`);
        } else if (event.status === 'done' && event.file) {
          fileProgress[event.file] = 100;
        }
      };

      // Load processor (handles tokenization for Ministral)
      setProgressText('Loading processor...');
      processorRef.current = await AutoProcessor.from_pretrained(MODEL_ID, {
        progress_callback: progressCallback,
      });

      setStatus('loading');
      setProgressText('Loading model into GPU memory...');

      // Load model with WebGPU - using AutoModelForImageTextToText for mistral3 architecture
      modelRef.current = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
        device: 'webgpu',
        dtype: {
          embed_tokens: 'fp16',
          vision_encoder: 'q4',
          decoder_model_merged: 'q4f16',
        },
        progress_callback: progressCallback,
      });

      setStatus('ready');
      setProgress(100);
      setProgressText('Model loaded and ready!');
      
      console.log('[Meteor] Model initialized successfully');

    } catch (err) {
      console.error('[Meteor] Initialization failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error during initialization');
    }
  }, [status, checkWebGPU]);

  /**
   * Generate text from a prompt
   */
  const generate = useCallback(async (
    prompt: string,
    onToken: (token: string) => void
  ): Promise<string> => {
    if (!processorRef.current || !modelRef.current) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    if (status !== 'ready') {
      throw new Error(`Cannot generate: model is ${status}`);
    }

    setStatus('generating');
    abortControllerRef.current = new AbortController();

    try {
      // Format as chat messages for Ministral
      const messages = [
        { role: 'user', content: prompt }
      ];

      // Apply chat template to format the prompt correctly
      const formattedPrompt = processorRef.current.apply_chat_template(messages, {
        add_generation_prompt: true,
        tokenize: false,
      });

      // For text-only input, use the tokenizer directly from the processor
      // Don't pass image parameter - just tokenize the text
      const inputs = processorRef.current.tokenizer(formattedPrompt, {
        return_tensors: 'pt',
        padding: true,
        truncation: true,
      });

      let generatedText = '';

      // Create streamer for token-by-token output
      const streamer = new TextStreamer(processorRef.current.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token: string) => {
          generatedText += token;
          onToken(token);
        },
      });

      // Generate response
      await modelRef.current.generate({
        ...inputs,
        max_new_tokens: 1024,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true,
        streamer,
      });

      setStatus('ready');
      return generatedText;

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('ready');
        return ''; // Aborted, not an error
      }
      
      console.error('[Meteor] Generation failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error during generation');
      throw err;
    }
  }, [status]);

  /**
   * Abort current generation
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (status === 'generating') {
      setStatus('ready');
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return {
    status,
    progress,
    progressText,
    error,
    isReady: status === 'ready',
    isGenerating: status === 'generating',
    initialize,
    generate,
    abort,
  };
}
