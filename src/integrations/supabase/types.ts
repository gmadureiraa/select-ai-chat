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
      ai_agents: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          escalation_agent_id: string | null
          id: string
          knowledge: Json | null
          memory_enabled: boolean | null
          metadata: Json | null
          model: string | null
          name: string
          system_prompt: string
          temperature: number | null
          tools: Json | null
          updated_at: string | null
          variables: Json | null
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          escalation_agent_id?: string | null
          id?: string
          knowledge?: Json | null
          memory_enabled?: boolean | null
          metadata?: Json | null
          model?: string | null
          name: string
          system_prompt?: string
          temperature?: number | null
          tools?: Json | null
          updated_at?: string | null
          variables?: Json | null
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          escalation_agent_id?: string | null
          id?: string
          knowledge?: Json | null
          memory_enabled?: boolean | null
          metadata?: Json | null
          model?: string | null
          name?: string
          system_prompt?: string
          temperature?: number | null
          tools?: Json | null
          updated_at?: string | null
          variables?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_escalation_agent_id_fkey"
            columns: ["escalation_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_workflow_connections: {
        Row: {
          connection_type: string | null
          created_at: string | null
          id: string
          label: string | null
          source_node_id: string
          target_node_id: string
          workflow_id: string
        }
        Insert: {
          connection_type?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          source_node_id: string
          target_node_id: string
          workflow_id: string
        }
        Update: {
          connection_type?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          source_node_id?: string
          target_node_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_connections_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_connections_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "ai_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_connections_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflow_nodes: {
        Row: {
          agent_id: string | null
          config: Json | null
          created_at: string | null
          id: string
          position_x: number | null
          position_y: number | null
          type: string
          workflow_id: string
        }
        Insert: {
          agent_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          type: string
          workflow_id: string
        }
        Update: {
          agent_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_nodes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_workflow_nodes_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflow_runs: {
        Row: {
          completed_at: string | null
          error: string | null
          execution_log: Json | null
          id: string
          result: Json | null
          started_at: string | null
          status: string | null
          trigger_data: Json | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          execution_log?: Json | null
          id?: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
          trigger_data?: Json | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          execution_log?: Json | null
          id?: string
          result?: Json | null
          started_at?: string | null
          status?: string | null
          trigger_data?: Json | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflows: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          trigger_config: Json | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          trigger_config?: Json | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          trigger_config?: Json | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          extracted_content: string | null
          file_path: string
          file_type: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          extracted_content?: string | null
          file_path: string
          file_type: string
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          extracted_content?: string | null
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
      client_social_credentials: {
        Row: {
          access_token: string | null
          access_token_secret: string | null
          account_id: string | null
          account_name: string | null
          api_key: string | null
          api_secret: string | null
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_valid: boolean | null
          last_validated_at: string | null
          metadata: Json | null
          oauth_access_token: string | null
          oauth_refresh_token: string | null
          platform: string
          updated_at: string
          validation_error: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_secret?: string | null
          account_id?: string | null
          account_name?: string | null
          api_key?: string | null
          api_secret?: string | null
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_valid?: boolean | null
          last_validated_at?: string | null
          metadata?: Json | null
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          platform: string
          updated_at?: string
          validation_error?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_secret?: string | null
          account_id?: string | null
          account_name?: string | null
          api_key?: string | null
          api_secret?: string | null
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_valid?: boolean | null
          last_validated_at?: string | null
          metadata?: Json | null
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          platform?: string
          updated_at?: string
          validation_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_social_credentials_client_id_fkey"
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
      client_visual_references: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          is_primary: boolean | null
          metadata: Json | null
          reference_type: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          metadata?: Json | null
          reference_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          metadata?: Json | null
          reference_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_visual_references_client_id_fkey"
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
          avatar_url: string | null
          brand_assets: Json | null
          context_notes: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          function_templates: Json | null
          id: string
          identity_guide: string | null
          name: string
          social_media: Json | null
          tags: Json | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          brand_assets?: Json | null
          context_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          function_templates?: Json | null
          id?: string
          identity_guide?: string | null
          name: string
          social_media?: Json | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          brand_assets?: Json | null
          context_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          function_templates?: Json | null
          id?: string
          identity_guide?: string | null
          name?: string
          social_media?: Json | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      favorite_messages: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          message_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          message_id: string
          note?: string | null
          user_id?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      global_knowledge: {
        Row: {
          category: Database["public"]["Enums"]["knowledge_category"]
          content: string
          created_at: string
          embedding: string | null
          id: string
          key_takeaways: Json | null
          metadata: Json | null
          page_count: number | null
          source_file: string | null
          source_url: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["knowledge_category"]
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          key_takeaways?: Json | null
          metadata?: Json | null
          page_count?: number | null
          source_file?: string | null
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["knowledge_category"]
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          key_takeaways?: Json | null
          metadata?: Json | null
          page_count?: number | null
          source_file?: string | null
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_knowledge_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      import_history: {
        Row: {
          client_id: string
          file_name: string | null
          id: string
          imported_at: string
          metadata: Json | null
          platform: string
          records_count: number
          status: string
          user_id: string
        }
        Insert: {
          client_id: string
          file_name?: string | null
          id?: string
          imported_at?: string
          metadata?: Json | null
          platform: string
          records_count?: number
          status?: string
          user_id?: string
        }
        Update: {
          client_id?: string
          file_name?: string | null
          id?: string
          imported_at?: string
          metadata?: Json | null
          platform?: string
          records_count?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          analyzed_at: string | null
          caption: string | null
          client_id: string
          comments: number | null
          created_at: string
          engagement_rate: number | null
          id: string
          impressions: number | null
          likes: number | null
          metadata: Json | null
          permalink: string | null
          post_id: string | null
          post_type: string | null
          posted_at: string | null
          reach: number | null
          saves: number | null
          shares: number | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          analyzed_at?: string | null
          caption?: string | null
          client_id: string
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metadata?: Json | null
          permalink?: string | null
          post_id?: string | null
          post_type?: string | null
          posted_at?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          analyzed_at?: string | null
          caption?: string | null
          client_id?: string
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metadata?: Json | null
          permalink?: string | null
          post_id?: string | null
          post_type?: string | null
          posted_at?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          column_id: string
          content_library_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          labels: Json | null
          media_urls: Json | null
          metadata: Json | null
          platform: string | null
          position: number
          scheduled_post_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          column_id: string
          content_library_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: Json | null
          media_urls?: Json | null
          metadata?: Json | null
          platform?: string | null
          position?: number
          scheduled_post_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          column_id?: string
          content_library_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: Json | null
          media_urls?: Json | null
          metadata?: Json | null
          platform?: string | null
          position?: number
          scheduled_post_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_content_library_id_fkey"
            columns: ["content_library_id"]
            isOneToOne: false
            referencedRelation: "client_content_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_scheduled_post_id_fkey"
            columns: ["scheduled_post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string | null
          column_type: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          position: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          column_type?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          position?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          column_type?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          position?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      performance_goals: {
        Row: {
          client_id: string
          created_at: string | null
          current_value: number | null
          end_date: string | null
          id: string
          metric_name: string
          notes: string | null
          period: string | null
          platform: string
          start_date: string | null
          status: string | null
          target_value: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          current_value?: number | null
          end_date?: string | null
          id?: string
          metric_name: string
          notes?: string | null
          period?: string | null
          platform: string
          start_date?: string | null
          status?: string | null
          target_value: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          current_value?: number | null
          end_date?: string | null
          id?: string
          metric_name?: string
          notes?: string | null
          period?: string | null
          platform?: string
          start_date?: string | null
          status?: string | null
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_goals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_items: {
        Row: {
          added_to_library: boolean | null
          assigned_to: string | null
          client_id: string | null
          column_id: string | null
          content: string | null
          content_library_id: string | null
          content_type: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          error_message: string | null
          external_post_id: string | null
          id: string
          labels: Json | null
          media_urls: Json | null
          metadata: Json | null
          platform: string | null
          position: number | null
          priority: string | null
          published_at: string | null
          retry_count: number | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          added_to_library?: boolean | null
          assigned_to?: string | null
          client_id?: string | null
          column_id?: string | null
          content?: string | null
          content_library_id?: string | null
          content_type?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          labels?: Json | null
          media_urls?: Json | null
          metadata?: Json | null
          platform?: string | null
          position?: number | null
          priority?: string | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          added_to_library?: boolean | null
          assigned_to?: string | null
          client_id?: string | null
          column_id?: string | null
          content?: string | null
          content_library_id?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          labels?: Json | null
          media_urls?: Json | null
          metadata?: Json | null
          platform?: string | null
          position?: number | null
          priority?: string | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_items_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_items_content_library_id_fkey"
            columns: ["content_library_id"]
            isOneToOne: false
            referencedRelation: "client_content_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      research_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          item_id: string | null
          position_x: number | null
          position_y: number | null
          project_id: string
          resolved: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          item_id?: string | null
          position_x?: number | null
          position_y?: number | null
          project_id: string
          resolved?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          item_id?: string | null
          position_x?: number | null
          position_y?: number | null
          project_id?: string
          resolved?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
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
      research_project_shares: {
        Row: {
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["share_permission"]
          project_id: string
          shared_by: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          project_id: string
          shared_by?: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          project_id?: string
          shared_by?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_project_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_project_versions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string | null
          project_id: string
          snapshot: Json
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
          project_id: string
          snapshot: Json
          user_id?: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
          project_id?: string
          snapshot?: Json
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
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
      scheduled_posts: {
        Row: {
          client_id: string
          content: string
          content_type: string
          created_at: string
          created_by: string
          error_message: string | null
          external_post_id: string | null
          id: string
          media_urls: Json | null
          metadata: Json | null
          platform: string
          published_at: string | null
          retry_count: number | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          content: string
          content_type?: string
          created_at?: string
          created_by: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          media_urls?: Json | null
          metadata?: Json | null
          platform: string
          published_at?: string | null
          retry_count?: number | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          content?: string
          content_type?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          media_urls?: Json | null
          metadata?: Json | null
          platform?: string
          published_at?: string | null
          retry_count?: number | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_clients: number
          max_members: number
          name: string
          price_monthly: number
          price_yearly: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          tokens_monthly: number
          trial_days: number | null
          type: Database["public"]["Enums"]["plan_type"]
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_clients?: number
          max_members?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tokens_monthly?: number
          trial_days?: number | null
          type: Database["public"]["Enums"]["plan_type"]
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_clients?: number
          max_members?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tokens_monthly?: number
          trial_days?: number | null
          type?: Database["public"]["Enums"]["plan_type"]
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          type: Database["public"]["Enums"]["token_transaction_type"]
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          type: Database["public"]["Enums"]["token_transaction_type"]
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          type?: Database["public"]["Enums"]["token_transaction_type"]
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      workflow_templates: {
        Row: {
          category: string
          connections: Json
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_featured: boolean | null
          name: string
          nodes: Json
          thumbnail_url: string | null
          updated_at: string
          workflow_config: Json
        }
        Insert: {
          category?: string
          connections?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          name: string
          nodes?: Json
          thumbnail_url?: string | null
          updated_at?: string
          workflow_config?: Json
        }
        Update: {
          category?: string
          connections?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          name?: string
          nodes?: Json
          thumbnail_url?: string | null
          updated_at?: string
          workflow_config?: Json
        }
        Relationships: []
      }
      workspace_access_requests: {
        Row: {
          id: string
          message: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          message?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          message?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_access_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invite_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invite_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invite_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invite_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invite_clients_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "workspace_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_member_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          workspace_member_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          workspace_member_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          workspace_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_member_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_member_clients_workspace_member_id_fkey"
            columns: ["workspace_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_rejected_users: {
        Row: {
          id: string
          reason: string | null
          rejected_at: string
          rejected_by: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          reason?: string | null
          rejected_at?: string
          rejected_by: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          reason?: string | null
          rejected_at?: string
          rejected_by?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_rejected_users_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_tokens: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          tokens_used_this_period: number
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          tokens_used_this_period?: number
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          tokens_used_this_period?: number
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      youtube_tokens: {
        Row: {
          access_token: string
          channel_id: string | null
          channel_title: string | null
          client_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          channel_id?: string | null
          channel_title?: string | null
          client_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          channel_id?: string | null
          channel_title?: string | null
          client_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          click_rate: number | null
          client_id: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          impressions: number | null
          metadata: Json | null
          published_at: string | null
          subscribers_gained: number | null
          thumbnail_url: string | null
          title: string
          total_views: number | null
          updated_at: string | null
          video_id: string
          watch_hours: number | null
        }
        Insert: {
          click_rate?: number | null
          client_id: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          impressions?: number | null
          metadata?: Json | null
          published_at?: string | null
          subscribers_gained?: number | null
          thumbnail_url?: string | null
          title: string
          total_views?: number | null
          updated_at?: string | null
          video_id: string
          watch_hours?: number | null
        }
        Update: {
          click_rate?: number | null
          client_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          impressions?: number | null
          metadata?: Json | null
          published_at?: string | null
          subscribers_gained?: number | null
          thumbnail_url?: string | null
          title?: string
          total_views?: number | null
          updated_at?: string | null
          video_id?: string
          watch_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_videos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_client: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
      }
      can_delete_in_specific_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      can_delete_in_workspace: { Args: { p_user_id: string }; Returns: boolean }
      can_modify_data: { Args: { p_user_id: string }; Returns: boolean }
      can_view_workspace_ai_usage: {
        Args: { p_target_user_id: string; p_user_id: string }
        Returns: boolean
      }
      client_workspace_accessible: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
      }
      client_workspace_can_delete: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
      }
      conversation_workspace_accessible: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      create_workspace_with_subscription: {
        Args: { p_name: string; p_owner_id: string; p_slug: string }
        Returns: string
      }
      debit_workspace_tokens: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_user_id?: string
          p_workspace_id: string
        }
        Returns: {
          error: string
          new_balance: number
          success: boolean
        }[]
      }
      get_all_workspaces_admin: {
        Args: never
        Returns: {
          clients_count: number
          created_at: string
          id: string
          members_count: number
          name: string
          owner_email: string
          owner_id: string
          slug: string
        }[]
      }
      get_user_role_in_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      get_user_workspace_id: { Args: { p_user_id: string }; Returns: string }
      get_user_workspace_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      get_user_workspace_slug: { Args: { p_user_id: string }; Returns: string }
      get_workspace_clients_admin: {
        Args: { p_workspace_id: string }
        Returns: {
          client_id: string
          client_name: string
          created_at: string
          description: string
        }[]
      }
      get_workspace_details_admin: {
        Args: { p_workspace_id: string }
        Returns: {
          current_period_end: string
          owner_email: string
          plan_name: string
          plan_status: string
          tokens_balance: number
          tokens_used: number
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      get_workspace_member_tokens_admin: {
        Args: { p_workspace_id: string }
        Returns: {
          email: string
          full_name: string
          tokens_used: number
          user_id: string
        }[]
      }
      get_workspace_members_admin: {
        Args: { p_workspace_id: string }
        Returns: {
          email: string
          full_name: string
          joined_at: string
          member_id: string
          role: string
          user_id: string
        }[]
      }
      has_project_access: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      has_project_edit_access: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      initialize_kanban_columns: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      is_enterprise_workspace: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_member_of_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_slug_available: { Args: { p_slug: string }; Returns: boolean }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_viewer_role: { Args: { p_user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
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
      search_knowledge_semantic: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
          workspace_id_filter: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          source_url: string
          summary: string
          title: string
        }[]
      }
      workflow_workspace_accessible: {
        Args: { p_user_id: string; p_workflow_id: string }
        Returns: boolean
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
        | "x_article"
        | "linkedin_post"
      knowledge_category:
        | "copywriting"
        | "storytelling"
        | "hooks"
        | "psychology"
        | "structure"
        | "engagement"
        | "other"
        | "marketing_strategy"
        | "growth_hacking"
        | "social_media"
        | "seo"
        | "branding"
        | "analytics"
        | "audience"
      plan_type: "free" | "starter" | "pro" | "enterprise"
      share_permission: "view" | "edit" | "admin"
      subscription_status: "active" | "canceled" | "past_due" | "trialing"
      token_transaction_type:
        | "subscription_credit"
        | "purchase"
        | "usage"
        | "refund"
        | "bonus"
        | "adjustment"
      workspace_role: "owner" | "admin" | "member" | "viewer"
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
        "x_article",
        "linkedin_post",
      ],
      knowledge_category: [
        "copywriting",
        "storytelling",
        "hooks",
        "psychology",
        "structure",
        "engagement",
        "other",
        "marketing_strategy",
        "growth_hacking",
        "social_media",
        "seo",
        "branding",
        "analytics",
        "audience",
      ],
      plan_type: ["free", "starter", "pro", "enterprise"],
      share_permission: ["view", "edit", "admin"],
      subscription_status: ["active", "canceled", "past_due", "trialing"],
      token_transaction_type: [
        "subscription_credit",
        "purchase",
        "usage",
        "refund",
        "bonus",
        "adjustment",
      ],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
