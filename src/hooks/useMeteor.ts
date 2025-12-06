/**
 * useMeteor - The AI Brain Hook
 * 
 * Manages the complete lifecycle of the LLM model:
 * 1. WebGPU compatibility check
 * 2. Model download with progress tracking
 * 3. Text generation with streaming
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  AutoTokenizer, 
  AutoModelForCausalLM,
  TextStreamer,
  env,
  type PreTrainedTokenizer,
  type PreTrainedModel,
} from '@huggingface/transformers';

// Configure transformers.js for Chrome extension environment
env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

// Point to local WASM files
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
}

// Model configuration - Llama 3.2 3B (fully supported by transformers.js)
const MODEL_ID = 'onnx-community/Llama-3.2-3B-Instruct-ONNX';

// Model states
export type MeteorStatus = 
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

export interface MeteorState {
  status: MeteorStatus;
  progress: number;
  progressText: string;
  error: string | null;
  isReady: boolean;
  isGenerating: boolean;
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

  const tokenizerRef = useRef<PreTrainedTokenizer | null>(null);
  const modelRef = useRef<PreTrainedModel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const initialize = useCallback(async () => {
    if (status === 'ready' || status === 'loading' || status === 'downloading') {
      return;
    }

    try {
      setStatus('checking');
      setError(null);
      setProgress(0);

      // Skip WebGPU check for WASM testing
      setProgressText('Using WASM backend (CPU)');

      setStatus('downloading');
      setProgressText('Preparing to download model...');

      const fileProgress: Record<string, number> = {};
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const progressCallback = (event: any) => {
        if (event.status === 'progress' && event.progress !== undefined && event.file) {
          fileProgress[event.file] = event.progress;
          const values = Object.values(fileProgress);
          const avgProgress = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
          setProgress(Math.round(avgProgress));
          setProgressText(`Downloading: ${Math.round(avgProgress)}%`);
        } else if (event.status === 'done' && event.file) {
          fileProgress[event.file] = 100;
        }
      };

      setProgressText('Loading tokenizer...');
      tokenizerRef.current = await AutoTokenizer.from_pretrained(MODEL_ID, {
        progress_callback: progressCallback,
      });

      setStatus('loading');
      setProgressText('Loading model into GPU memory...');

      // Test with WASM/CPU backend to isolate if WebGPU is the issue
      modelRef.current = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
        device: 'wasm',  // CPU fallback - slower but more compatible
        dtype: 'q4',
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

  const generate = useCallback(async (
    prompt: string,
    onToken: (token: string) => void
  ): Promise<string> => {
    if (!tokenizerRef.current || !modelRef.current) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    if (status !== 'ready') {
      throw new Error(`Cannot generate: model is ${status}`);
    }

    setStatus('generating');
    abortControllerRef.current = new AbortController();

    try {
      const messages = [{ role: 'user', content: prompt }];

      const formattedPrompt = tokenizerRef.current.apply_chat_template(messages, {
        add_generation_prompt: true,
        tokenize: false,
      });

      const inputs = tokenizerRef.current(formattedPrompt, {
        return_tensors: 'pt',
        padding: true,
        truncation: true,
      });

      let generatedText = '';

      const streamer = new TextStreamer(tokenizerRef.current, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token: string) => {
          generatedText += token;
          onToken(token);
        },
      });

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
        return '';
      }
      
      console.error('[Meteor] Generation failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error during generation');
      throw err;
    }
  }, [status]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (status === 'generating') {
      setStatus('ready');
    }
  }, [status]);

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
