import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

interface WebPushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
}

export function useWebPushSubscription() {
  const { user } = useAuth();
  const { workspace } = useWorkspaceContext();
  const [state, setState] = useState<WebPushState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: "default",
  });

  // Check support and current subscription status
  useEffect(() => {
    const checkStatus = async () => {
      const isSupported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!isSupported) {
        setState({
          isSupported: false,
          isSubscribed: false,
          isLoading: false,
          permission: "denied",
        });
        return;
      }

      const permission = Notification.permission;

      // Check if already subscribed
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          isLoading: false,
          permission,
        });
      } catch (error) {
        console.error("[useWebPushSubscription] Error checking status:", error);
        setState({
          isSupported: true,
          isSubscribed: false,
          isLoading: false,
          permission,
        });
      }
    };

    checkStatus();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !workspace) {
      console.error("[useWebPushSubscription] No user or workspace");
      return false;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({ ...prev, isLoading: false, permission }));
        return false;
      }

      // Get VAPID public key from server
      const { data: keyData, error: keyError } = await supabase.functions.invoke(
        "get-vapid-public-key"
      );

      if (keyError || !keyData?.publicKey) {
        console.error("[useWebPushSubscription] Error getting VAPID key:", keyError);
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      // Convert VAPID key to Uint8Array
      const vapidPublicKey = urlBase64ToUint8Array(keyData.publicKey);

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      } as PushSubscriptionOptionsInit);

      console.log("[useWebPushSubscription] Push subscription created");

      // Extract keys
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error("Missing subscription keys");
      }

      // Save subscription to database
      const { error: saveError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            workspace_id: workspace.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            device_info: {
              userAgent: navigator.userAgent,
              language: navigator.language,
              platform: navigator.platform,
            },
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (saveError) {
        console.error("[useWebPushSubscription] Error saving subscription:", saveError);
        throw saveError;
      }

      console.log("[useWebPushSubscription] Subscription saved to database");

      setState({
        isSupported: true,
        isSubscribed: true,
        isLoading: false,
        permission: "granted",
      });

      return true;
    } catch (error) {
      console.error("[useWebPushSubscription] Error subscribing:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, workspace]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setState({
        isSupported: true,
        isSubscribed: false,
        isLoading: false,
        permission: Notification.permission,
      });

      return true;
    } catch (error) {
      console.error("[useWebPushSubscription] Error unsubscribing:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
