import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [{ name: 'queen-animation-studio', apply: 'serve', transformIndexHtml() { return [{ tag: 'script', attrs: { type: 'module', src: '/src/dev/panel.ts' }, injectTo: 'body' }]; } }],
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
});
