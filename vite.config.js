import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/local-flashcards/' : '/',
  build: {
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'styles.css';
          }

          return 'assets/[name][extname]';
        }
      }
    }
  }
}));
