import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';

import { startRouter } from './core/router';
import { createShell } from './app/shell';
import { initTheme } from './ui/theme';
import { initToasts, toast } from './ui/toast';

initTheme();

const root = document.getElementById('app') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
const { outlet } = createShell(root);
initToasts();
startRouter(outlet);

// Last-resort error reporting: keep the app usable and tell the user something failed.
let lastErrorAt = 0;
function reportError(err: unknown): void {
  console.error(err);
  const now = Date.now();
  if (now - lastErrorAt < 3000) return;
  lastErrorAt = now;
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/ResizeObserver loop/i.test(msg)) return;
  toast(msg && msg.length < 160 ? `Something went wrong: ${msg}` : 'Something went wrong. If it keeps happening, try reloading the page.', { tone: 'error' });
}
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as unknown;
  if (reason instanceof DOMException && reason.name === 'AbortError') return;
  reportError(reason);
});
window.addEventListener('error', (e) => {
  if (e.error) reportError(e.error);
});

// Stop the browser from opening files dropped outside a drop zone.
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
