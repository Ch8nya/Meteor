import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    // Copy ONNX runtime files from transformers.js package (matching versions)
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm',
          dest: 'wasm'
        },
        {
          src: 'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs',
          dest: 'wasm'
        }
      ]
    })
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
})
