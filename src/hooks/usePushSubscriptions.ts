import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PushSubscriptionDevice {
  id: string;
  endpoint: string;
  device_info: {
    userAgent?: string;
    language?: string;
    platform?: string;
  } | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Parse user agent into a friendly device label.
 * E.g. "Chrome em macOS", "Safari em iPhone".
 */
export function getDeviceLabel(deviceInfo: PushSubscriptionDevice["device_info"]): string {
  if (!deviceInfo?.userAgent) return "Dispositivo desconhecido";

  const ua = deviceInfo.userAgent;
  const platform = deviceInfo.platform || "";

  // Browser detection
  let browser = "Navegador";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/OPR\//.test(ua) || /Opera\//.test(ua)) browser = "Opera";

  // OS detection
  let os = "Dispositivo";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/.test(ua) || platform === "MacIntel") os = "macOS";
  else if (/Windows/.test(ua) || /Win32|Win64/.test(platform)) os = "Windows";
  else if (/Linux/.test(ua) || /Linux/.test(platform)) os = "Linux";

  return `${browser} em ${os}`;
}

export function usePushSubscriptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: subscriptions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["push-subscriptions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as PushSubscriptionDevice[];

      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, device_info, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("[usePushSubscriptions] Error fetching subscriptions:", error);
        return [];
      }

      return (data || []) as PushSubscriptionDevice[];
    },
    enabled: !!user?.id,
  });

  const removeSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Try to also unsubscribe locally if this is the current device
      const sub = subscriptions.find((s) => s.id === subscriptionId);
      if (sub && "serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const localSub = await (registration as any).pushManager.getSubscription();
          if (localSub && localSub.endpoint === sub.endpoint) {
            await localSub.unsubscribe();
          }
        } catch (err) {
          // Non-fatal; we still remove from DB
          console.warn("[usePushSubscriptions] Could not unsubscribe locally:", err);
        }
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("id", subscriptionId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-subscriptions"] });
      toast({
        title: "Dispositivo removido",
        description: "Esse dispositivo não receberá mais notificações push.",
      });
    },
    onError: (error) => {
      console.error("[usePushSubscriptions] Error removing subscription:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o dispositivo.",
        variant: "destructive",
      });
    },
  });

  return {
    subscriptions,
    isLoading,
    removeSubscription,
    refetch,
  };
}
