import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  registration: ServiceWorkerRegistration | null;
  isUpdateAvailable: boolean;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    registration: null,
    isUpdateAvailable: false,
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('[useServiceWorker] Service Worker not supported');
      return;
    }

    setState((prev) => ({ ...prev, isSupported: true }));

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[useServiceWorker] Service Worker registered:', registration.scope);
        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[useServiceWorker] New version available');
                setState((prev) => ({ ...prev, isUpdateAvailable: true }));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[useServiceWorker] Registration failed:', error);
      });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[useServiceWorker] Controller changed, reloading...');
      window.location.reload();
    });
  }, []);

  const update = useCallback(() => {
    if (state.registration) {
      state.registration.update();
    }
  }, [state.registration]);

  const skipWaiting = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (state.registration) {
        state.registration.showNotification(title, {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          ...options,
        });
      }
    },
    [state.registration]
  );

  return {
    ...state,
    update,
    skipWaiting,
    showNotification,
  };
}
