export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          created_at: string
          edge_function: string
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          model_name: string
          output_tokens: number | null
          provider: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          edge_function: string
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model_name: string
          output_tokens?: number | null
          provider: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          edge_function?: string
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model_name?: string
          output_tokens?: number | null
          provider?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_id: string | null
          completed_at: string | null
          duration_ms: number | null
          error: string | null
          id: string
          result: string | null
          started_at: string
          status: string
        }
        Insert: {
          automation_id?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          result?: string | null
          started_at?: string
          status: string
        }
        Update: {
          automation_id?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          result?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json | null
          client_id: string | null
          created_at: string
          data_sources: Json | null
          description: string | null
          email_recipients: string[] | null
          id: string
          is_active: boolean
          last_run_at: string | null
          model: string
          name: string
          next_run_at: string | null
          prompt: string
          schedule_config: Json
          schedule_days: string[] | null
          schedule_time: string | null
          schedule_type: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          actions?: Json | null
          client_id?: string | null
          created_at?: string
          data_sources?: Json | null
          description?: string | null
          email_recipients?: string[] | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          model?: string
          name: string
          next_run_at?: string | null
          prompt: string
          schedule_config?: Json
          schedule_days?: string[] | null
          schedule_time?: string | null
          schedule_type: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          actions?: Json | null
          client_id?: string | null
          created_at?: string
          data_sources?: Json | null
          description?: string | null
          email_recipients?: string[] | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          model?: string
          name?: string
          next_run_at?: string | null
          prompt?: string
          schedule_config?: Json
          schedule_days?: string[] | null
          schedule_time?: string | null
          schedule_type?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clickup_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      client_content_library: {
        Row: {
          client_id: string
          content: string
          content_type: Database["public"]["Enums"]["content_type"]
          content_url: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          content: string
          content_type: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          content_url?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_content_library_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string | null
          file_path: string
          file_type: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          file_path: string
          file_type: string
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          file_path?: string
          file_type?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reference_library: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          reference_type: string
          source_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          reference_type: string
          source_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          reference_type?: string
          source_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_reference_library_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_templates: {
        Row: {
          clickup_list_id: string | null
          client_id: string
          created_at: string | null
          id: string
          name: string
          rules: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          clickup_list_id?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          name: string
          rules?: Json | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          clickup_list_id?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          name?: string
          rules?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_websites: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_scraped_at: string | null
          scraped_content: string | null
          scraped_markdown: string | null
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_scraped_at?: string | null
          scraped_content?: string | null
          scraped_markdown?: string | null
          url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_scraped_at?: string | null
          scraped_content?: string | null
          scraped_markdown?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_websites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          context_notes: string | null
          created_at: string | null
          description: string | null
          function_templates: Json | null
          id: string
          name: string
          social_media: Json | null
          tags: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_notes?: string | null
          created_at?: string | null
          description?: string | null
          function_templates?: Json | null
          id?: string
          name: string
          social_media?: Json | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          context_notes?: string | null
          created_at?: string | null
          description?: string | null
          function_templates?: Json | null
          id?: string
          name?: string
          social_media?: Json | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          model: string
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          model?: string
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          model?: string
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "client_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generations: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          image_url: string
          prompt: string
          template_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          image_url: string
          prompt: string
          template_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          image_url?: string
          prompt?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_generations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "client_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          image_urls: string[] | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_metrics: {
        Row: {
          click_rate: number | null
          client_id: string
          comments: number | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          likes: number | null
          metadata: Json | null
          metric_date: string
          open_rate: number | null
          platform: string
          shares: number | null
          subscribers: number | null
          total_posts: number | null
          updated_at: string | null
          views: number | null
        }
        Insert: {
          click_rate?: number | null
          client_id: string
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          metric_date?: string
          open_rate?: number | null
          platform: string
          shares?: number | null
          subscribers?: number | null
          total_posts?: number | null
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          click_rate?: number | null
          client_id?: string
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          metric_date?: string
          open_rate?: number | null
          platform?: string
          shares?: number | null
          subscribers?: number | null
          total_posts?: number | null
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      research_connections: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          project_id: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          project_id: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          project_id?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_connections_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_connections_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_conversations: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          project_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          project_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_items: {
        Row: {
          content: string | null
          created_at: string | null
          file_path: string | null
          height: number | null
          id: string
          metadata: Json | null
          position_x: number | null
          position_y: number | null
          processed: boolean | null
          project_id: string
          source_url: string | null
          thumbnail_url: string | null
          title: string | null
          type: string
          width: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_path?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          position_x?: number | null
          position_y?: number | null
          processed?: boolean | null
          project_id: string
          source_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          type: string
          width?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_path?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          position_x?: number | null
          position_y?: number | null
          processed?: boolean | null
          project_id?: string
          source_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "research_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_projects: {
        Row: {
          client_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string | null
          description: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string | null
          description: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string | null
          description?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_user_activity: {
        Args: {
          p_activity_type: Database["public"]["Enums"]["activity_type"]
          p_description?: string
          p_entity_id?: string
          p_entity_name?: string
          p_entity_type?: string
          p_metadata?: Json
        }
        Returns: string
      }
    }
    Enums: {
      activity_type:
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
        | "metrics_fetched"
        | "content_library_added"
        | "content_library_updated"
        | "content_library_deleted"
      content_type:
        | "newsletter"
        | "carousel"
        | "reel_script"
        | "video_script"
        | "blog_post"
        | "social_post"
        | "other"
        | "stories"
        | "static_image"
        | "short_video"
        | "long_video"
        | "tweet"
        | "thread"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "client_created",
        "client_updated",
        "client_deleted",
        "template_created",
        "template_updated",
        "template_deleted",
        "conversation_created",
        "message_sent",
        "image_generated",
        "image_deleted",
        "automation_created",
        "automation_updated",
        "automation_deleted",
        "automation_executed",
        "reverse_engineering_analysis",
        "reverse_engineering_generation",
        "document_uploaded",
        "website_scraped",
        "metrics_fetched",
        "content_library_added",
        "content_library_updated",
        "content_library_deleted",
      ],
      content_type: [
        "newsletter",
        "carousel",
        "reel_script",
        "video_script",
        "blog_post",
        "social_post",
        "other",
        "stories",
        "static_image",
        "short_video",
        "long_video",
        "tweet",
        "thread",
      ],
    },
  },
} as const
