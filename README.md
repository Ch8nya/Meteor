# Meteor - Local AI Browser Assistant

Run **Ministral 3B** entirely locally in your browser using WebGPU. Summarize pages, analyze text — all private, all local. No data leaves your device.

![Meteor Banner](./docs/banner.png)

## ✨ Features

- **100% Local**: The entire AI model runs in your browser. No API calls, no cloud processing.
- **WebGPU Accelerated**: Leverages your GPU for fast inference.
- **Privacy First**: Your data never leaves your device.
- **Page Summarization**: Instantly summarize any webpage with one click.

## 🚀 Quick Start

### Prerequisites

- **Chrome 113+** or **Edge** with hardware acceleration enabled
- A GPU with WebGPU support (most modern GPUs work)
- ~3GB free disk space (for model cache)

### Installation

1. **Clone and install dependencies:**

```bash
cd meteor
npm install
```

2. **Generate extension icons:**

```bash
npm run generate-icons
```

Or manually add 16x16, 48x48, and 128x128 PNG icons to the `icons/` folder.

3. **Build the extension:**

```bash
# Development mode with HMR
npm run dev

# Production build
npm run build
```

4. **Load in Chrome:**

   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder (after building) or project root (for dev)

5. **Open the Side Panel:**

   - Click the Meteor extension icon
   - Wait for the model to download (~2.5GB, happens once)
   - Start summarizing!

## 🏗️ Architecture

### The "Fat Side Panel" Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    SIDE PANEL (Brain)                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │  React App + Transformers.js + WebGPU Runtime       ││
│  │  • Holds model weights in memory                     ││
│  │  • Processes all AI inference                        ││
│  │  • Manages UI state                                  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Messages
                          ▼
┌─────────────────────────────────────────────────────────┐
│              SERVICE WORKER (Nervous System)             │
│  • Lightweight event handler                             │
│  • Opens Side Panel on icon click                        │
│  • NO AI processing here                                 │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Messages
                          ▼
┌─────────────────────────────────────────────────────────┐
│                CONTENT SCRIPT (Eyes)                     │
│  • Injects into web pages                                │
│  • Scrapes and sanitizes DOM                             │
│  • Returns clean text to Side Panel                      │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. User clicks "Summarize This Page"
2. Side Panel → Content Script: `METEOR_READ_PAGE`
3. Content Script scrapes DOM, removes noise, truncates to 15K chars
4. Content Script → Side Panel: Page content
5. Side Panel wraps content in prompt template
6. WebGPU model generates response, streams tokens to UI

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite + CRXJS |
| AI Engine | Transformers.js 3.x |
| Inference | WebGPU + ONNX Runtime |
| Styling | Tailwind CSS |
| Model | Ministral 3B (Q4 Quantized) |

## 📁 Project Structure

```
meteor/
├── src/
│   ├── background/       # Service worker (lightweight)
│   │   └── index.ts
│   ├── content/          # Content script (page scraper)
│   │   └── index.ts
│   ├── sidepanel/        # React app (AI brain)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.html
│   │   └── index.css
│   ├── hooks/
│   │   └── useMeteor.ts  # AI model lifecycle hook
│   ├── components/
│   │   ├── BootstrapView.tsx
│   │   ├── ChatView.tsx
│   │   └── MessageBubble.tsx
│   └── types/
│       └── index.ts
├── icons/                # Extension icons
├── manifest.json         # Chrome extension manifest
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## ⚙️ Configuration

### Model Settings (in `useMeteor.ts`)

```typescript
// Quantization for optimal performance/quality balance
dtype: {
  embed_tokens: 'fp16',        // Token embeddings at half precision
  vision_encoder: 'q4',        // Vision (unused in text-only mode)
  decoder_model_merged: 'q4f16' // Main model at 4-bit with fp16 compute
}
```

### Content Extraction (in `content/index.ts`)

```typescript
const MAX_CONTENT_LENGTH = 15000; // Prevents WebGPU OOM
const NOISY_TAGS = ['script', 'style', 'nav', 'footer', 'svg', ...];
```

## 🐛 Troubleshooting

### "WebGPU is not supported"

1. Ensure you're using Chrome 113+ or Edge
2. Go to `chrome://settings/` → System → Enable "Use hardware acceleration"
3. Restart the browser

### Model fails to load / Tab crashes

1. Close other tabs to free GPU memory
2. The model needs ~3GB VRAM
3. Try restarting Chrome

### Content script not working

- Cannot read `chrome://` or `chrome-extension://` pages
- Some sites block content scripts (banking, etc.)

## 🔒 Privacy

- **No network requests**: After initial model download, zero network activity
- **No telemetry**: No analytics, no tracking
- **Local storage only**: Model cached in browser's IndexedDB
- **Open source**: Audit the code yourself

## 📝 License

MIT

## 🙏 Acknowledgments

- [Transformers.js](https://huggingface.co/docs/transformers.js) by Hugging Face
- [Mistral AI](https://mistral.ai/) for Ministral 3B
- [CRXJS](https://crxjs.dev/) for excellent Vite integration

