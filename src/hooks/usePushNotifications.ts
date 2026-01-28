import { useState, useEffect, useCallback } from 'react';

interface PushNotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
  isServiceWorkerReady: boolean;
  subscription: PushSubscription | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSupported: false,
    isServiceWorkerReady: false,
    subscription: null,
  });

  useEffect(() => {
    const checkSupport = async () => {
      const notificationSupported = 'Notification' in window;
      const serviceWorkerSupported = 'serviceWorker' in navigator;
      const pushSupported = 'PushManager' in window;

      setState((prev) => ({
        ...prev,
        isSupported: notificationSupported && serviceWorkerSupported && pushSupported,
        permission: notificationSupported ? Notification.permission : 'denied',
      }));

      // Check if service worker is registered and ready
      if (serviceWorkerSupported) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const existingSubscription = await registration.pushManager.getSubscription();
          setState((prev) => ({
            ...prev,
            isServiceWorkerReady: true,
            subscription: existingSubscription,
          }));
        } catch (error) {
          console.error('[usePushNotifications] Error checking SW status:', error);
        }
      }
    };

    checkSupport();
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.isSupported) return 'denied';

    try {
      const result = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission: result }));
      return result;
    } catch (error) {
      console.error('[usePushNotifications] Error requesting permission:', error);
      return 'denied';
    }
  }, [state.isSupported]);

  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions & { data?: Record<string, unknown> }) => {
      if (state.permission !== 'granted' || !state.isSupported) return null;

      try {
        // Use Service Worker for notifications when available (better PWA support)
        if (state.isServiceWorkerReady && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: options?.tag || `kai-${Date.now()}`,
            requireInteraction: false,
            ...options,
          });
          return null; // SW handles the notification
        }

        // Fallback to native Notification API
        const notification = new Notification(title, {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (error) {
        console.error('[usePushNotifications] Error showing notification:', error);
        return null;
      }
    },
    [state.permission, state.isSupported, state.isServiceWorkerReady]
  );

  const showNotificationIfHidden = useCallback(
    (title: string, options?: NotificationOptions & { data?: Record<string, unknown> }) => {
      // Only show native notification if document is hidden (tab in background or PWA minimized)
      if (document.hidden || document.visibilityState === 'hidden') {
        return showNotification(title, options);
      }
      return null;
    },
    [showNotification]
  );

  // Send message to Service Worker to show notification
  const sendToServiceWorker = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (!state.isServiceWorkerReady || !('serviceWorker' in navigator)) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options,
        });
      } catch (error) {
        console.error('[usePushNotifications] Error sending to SW:', error);
      }
    },
    [state.isServiceWorkerReady]
  );

  return {
    permission: state.permission,
    isSupported: state.isSupported,
    isServiceWorkerReady: state.isServiceWorkerReady,
    subscription: state.subscription,
    requestPermission,
    showNotification,
    showNotificationIfHidden,
    sendToServiceWorker,
  };
}
