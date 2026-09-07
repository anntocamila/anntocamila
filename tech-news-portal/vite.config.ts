import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The repo is published as a GitHub Pages *project* site, so assets live under
// /anntocamila/. Local dev and preview keep the root base.
// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/anntocamila/' : '/',
  plugins: [react()],
})
