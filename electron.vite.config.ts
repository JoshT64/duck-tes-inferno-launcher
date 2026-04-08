import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { defineConfig as defineViteConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { config } from 'dotenv'

// Load .env file
config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
    define: {
      'process.env.GITHUB_TOKEN': JSON.stringify(process.env.GITHUB_TOKEN || '')
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
