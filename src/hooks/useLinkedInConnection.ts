import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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

  const initiateOAuth = () => {
    const clientId = "770mfkfvrdwpao";
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-oauth-callback`;
    const state = `${user?.id}|${window.location.origin}/social-publisher`;
    const scope = "openid profile w_member_social";
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`;
    
    console.log("LinkedIn OAuth URL:", authUrl);
    
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
