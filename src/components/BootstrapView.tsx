/**
 * BootstrapView - Shown during model download/initialization
 * 
 * Displays progress bar and status for the ~2.5GB model download.
 * This only happens once - subsequent loads use the cached model.
 */

import { Sparkles, Cpu } from 'lucide-react';

interface BootstrapViewProps {
  progress: number;
  progressText: string;
  error: string | null;
}

export function BootstrapView({ progress, progressText, error }: BootstrapViewProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
          <Cpu className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold mb-3 text-meteor-text">
          Initialization Failed
        </h2>
        <p className="text-meteor-muted max-w-sm mb-6 leading-relaxed">
          {error}
        </p>
        <div className="text-sm text-meteor-muted/60 max-w-xs space-y-2">
          <p>💡 <strong>Tips:</strong></p>
          <ul className="text-left space-y-1">
            <li>• Close other tabs to free up memory</li>
            <li>• Enable hardware acceleration in settings</li>
            <li>• Use Chrome 113+ or Edge browser</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      {/* Animated icon */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-meteor-accent/20 to-meteor-accent/5 flex items-center justify-center animate-pulse-slow">
          <Sparkles className="w-10 h-10 text-meteor-accent" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-meteor-accent/20 blur-xl animate-glow" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold mb-2 text-meteor-text">
        Setting up Meteor
      </h1>
      
      {/* Subtitle */}
      <p className="text-meteor-muted text-center mb-8 max-w-xs leading-relaxed">
        Downloading AI brain (~2.5GB).
        <br />
        <span className="text-sm opacity-70">This happens once.</span>
      </p>

      {/* Progress bar container */}
      <div className="w-full max-w-xs">
        {/* Progress bar */}
        <div className="h-2 bg-meteor-surface rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-gradient-to-r from-meteor-accent to-meteor-accent-glow rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress text */}
        <p className="text-sm text-meteor-muted text-center">
          {progressText || 'Initializing...'}
        </p>
      </div>

      {/* Privacy note */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="flex items-center justify-center gap-2 text-xs text-meteor-muted/50">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>100% Local • No data leaves your device</span>
        </div>
      </div>
    </div>
  );
}

