import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-copy the logo image from Downloads to the public directory
const srcImg = 'c:\\Users\\51y8\\Downloads\\Image_20260520_111253.png';
const publicDir = path.resolve(__dirname, 'public');
const destImg = path.resolve(publicDir, 'logo.png');

if (fs.existsSync(srcImg)) {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  // Only copy if it doesn't already exist to avoid loop locking
  if (!fs.existsSync(destImg)) {
    fs.copyFileSync(srcImg, destImg);
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
