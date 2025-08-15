
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './hooks/useTheme';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
  } else {
    // Clean up any existing service workers in development
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
