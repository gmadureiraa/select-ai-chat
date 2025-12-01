import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityType =
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "template_created"
  | "template_updated"
  | "template_deleted"
  | "conversation_created"
  | "message_sent"
  | "image_generated"
  | "image_deleted"
  | "automation_created"
  | "automation_updated"
  | "automation_deleted"
  | "automation_executed"
  | "reverse_engineering_analysis"
  | "reverse_engineering_generation"
  | "document_uploaded"
  | "website_scraped"
  | "metrics_fetched";

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

export const useActivities = () => {
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery({
    queryKey: ["user-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as UserActivity[];
    },
  });

  const logActivity = useMutation({
    mutationFn: async ({
      activityType,
      entityType,
      entityId,
      entityName,
      description,
      metadata = {},
    }: {
      activityType: ActivityType;
      entityType?: string;
      entityId?: string;
      entityName?: string;
      description: string;
      metadata?: Record<string, any>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const { data, error } = await supabase.from("user_activities").insert({
        user_id: userData.user.id,
        activity_type: activityType,
        entity_type: entityType || null,
        entity_id: entityId || null,
        entity_name: entityName || null,
        description,
        metadata,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-activities"] });
    },
  });

  return {
    activities,
    isLoading,
    logActivity,
  };
};
