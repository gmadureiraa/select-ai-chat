import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd, MetaAdsParsedCSV } from "@/types/metaAds";
import { toast } from "sonner";

// Fetch campaigns for a client
export function useMetaAdsCampaigns(clientId: string) {
  return useQuery({
    queryKey: ["meta-ads-campaigns", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ads_campaigns")
        .select("*")
        .eq("client_id", clientId)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data as MetaAdsCampaign[];
    },
    enabled: !!clientId,
  });
}

// Fetch ad sets for a client
export function useMetaAdsAdSets(clientId: string) {
  return useQuery({
    queryKey: ["meta-ads-adsets", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ads_adsets")
        .select("*")
        .eq("client_id", clientId)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data as MetaAdsAdSet[];
    },
    enabled: !!clientId,
  });
}

// Fetch ads for a client
export function useMetaAdsAds(clientId: string) {
  return useQuery({
    queryKey: ["meta-ads-ads", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ads_ads")
        .select("*")
        .eq("client_id", clientId)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data as MetaAdsAd[];
    },
    enabled: !!clientId,
  });
}

// Import Meta Ads CSV data
export function useImportMetaAdsCSV(clientId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (parsed: MetaAdsParsedCSV) => {
      const dataWithClientId = parsed.data.map(item => ({
        ...item,
        client_id: clientId
      }));
      
      let error: any = null;
      let count = 0;
      
      if (parsed.type === 'campaigns') {
        const result = await supabase
          .from('meta_ads_campaigns')
          .upsert(dataWithClientId as any, {
            onConflict: 'client_id,campaign_name,start_date,end_date'
          });
        error = result.error;
        count = dataWithClientId.length;
      } else if (parsed.type === 'adsets') {
        const result = await supabase
          .from('meta_ads_adsets')
          .upsert(dataWithClientId as any, {
            onConflict: 'client_id,adset_name,start_date,end_date'
          });
        error = result.error;
        count = dataWithClientId.length;
      } else if (parsed.type === 'ads') {
        const result = await supabase
          .from('meta_ads_ads')
          .upsert(dataWithClientId as any, {
            onConflict: 'client_id,ad_name,start_date,end_date'
          });
        error = result.error;
        count = dataWithClientId.length;
      }
      
      if (error) throw error;
      
      // Log import to history
      await supabase.from("import_history").insert({
        client_id: clientId,
        platform: 'meta_ads',
        records_count: count,
        status: 'success',
        metadata: {
          type: parsed.type,
          dateRange: parsed.dateRange
        }
      });
      
      return { count, type: parsed.type };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns", clientId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-adsets", clientId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-ads", clientId] });
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      
      const typeLabels = {
        campaigns: 'campanhas',
        adsets: 'conjuntos de anúncios',
        ads: 'anúncios'
      };
      
      toast.success(`${result.count} ${typeLabels[result.type]} importados com sucesso!`);
    },
    onError: (error) => {
      console.error("Erro ao importar Meta Ads:", error);
      toast.error("Erro ao importar dados do Meta Ads");
    }
  });
}

// Delete all Meta Ads data for a client
export function useDeleteMetaAdsData(clientId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (type?: 'campaigns' | 'adsets' | 'ads') => {
      if (type) {
        const tableName = type === 'campaigns' ? 'meta_ads_campaigns' 
          : type === 'adsets' ? 'meta_ads_adsets' 
          : 'meta_ads_ads';
        
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("client_id", clientId);
        
        if (error) throw error;
      } else {
        // Delete all
        await Promise.all([
          supabase.from("meta_ads_campaigns").delete().eq("client_id", clientId),
          supabase.from("meta_ads_adsets").delete().eq("client_id", clientId),
          supabase.from("meta_ads_ads").delete().eq("client_id", clientId),
        ]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns", clientId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-adsets", clientId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-ads", clientId] });
      toast.success("Dados removidos com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao remover dados:", error);
      toast.error("Erro ao remover dados");
    }
  });
}
