import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Simple hash function for state validation (client-side)
async function generateStateHash(userId: string, timestamp: number): Promise<string> {
  const data = `${userId}:${timestamp}:linkedin_oauth`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export function useLinkedInConnection() {
  const { user } = useAuth();

  const { data: isConnected, isLoading, refetch } = useQuery({
    queryKey: ['linkedin-connection', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from('linkedin_tokens')
        .select('expires_at')
        .eq('user_id', user.id)
        .single();

      if (error || !data) return false;
      
      // Check if token is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return false;
      }
      
      return true;
    },
    enabled: !!user,
  });

  const initiateOAuth = async () => {
    if (!user?.id) {
      console.error("User not authenticated");
      return;
    }

    const clientId = "770mfkfvrdwpao";
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-oauth-callback`;
    const scope = "openid profile w_member_social";
    
    // Generate timestamp for state expiration
    const timestamp = Date.now();
    // Generate hash for state validation
    const hash = await generateStateHash(user.id, timestamp);
    
    // State format: userId|timestamp|hash|redirectUrl
    // The hash prevents state tampering, timestamp prevents replay attacks
    const state = `${user.id}|${timestamp}|${hash}|${window.location.origin}/social-publisher`;
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`;
    
    console.log("LinkedIn OAuth initiated");
    
    // Open in new window to avoid iframe restrictions
    window.open(authUrl, "_blank", "width=600,height=700");
  };

  const disconnect = async () => {
    if (!user) return;
    
    await supabase
      .from('linkedin_tokens')
      .delete()
      .eq('user_id', user.id);
    
    refetch();
  };

  return {
    isConnected: !!isConnected,
    isLoading,
    initiateOAuth,
    disconnect,
    refetch,
  };
}
