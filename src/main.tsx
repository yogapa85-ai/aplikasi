import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForSwUpdate = async () => {
        if (!navigator.onLine) return;
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { 'cache-control': 'no-cache' },
          });
          if (resp.status === 200) {
            await registration.update();
          }
        } catch {
          // Ignore transient offline errors
        }
      };

      void checkForSwUpdate();

      window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void checkForSwUpdate();
        }
      }, 45000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void checkForSwUpdate();
        }
      });

      window.addEventListener('online', () => {
        void checkForSwUpdate();
      });
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
