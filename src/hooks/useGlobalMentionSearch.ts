import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MentionType = "format" | "assignee" | "content" | "reference";

export interface MentionItem {
  id: string;
  title: string;
  type: MentionType;
  category: string;
  icon?: string;
  description?: string;
}

// Available content formats
const FORMAT_MENTIONS: MentionItem[] = [
  { id: "newsletter", title: "Newsletter", type: "format", category: "Formatos", icon: "📰", description: "E-mail informativo" },
  { id: "carousel", title: "Carrossel", type: "format", category: "Formatos", icon: "🎠", description: "Múltiplos slides" },
  { id: "post", title: "Post", type: "format", category: "Formatos", icon: "📝", description: "Publicação única" },
  { id: "reels", title: "Reels", type: "format", category: "Formatos", icon: "🎬", description: "Vídeo curto" },
  { id: "stories", title: "Stories", type: "format", category: "Formatos", icon: "📱", description: "Conteúdo 24h" },
  { id: "thread", title: "Thread", type: "format", category: "Formatos", icon: "🧵", description: "Sequência de posts" },
  { id: "blog", title: "Blog", type: "format", category: "Formatos", icon: "📄", description: "Artigo longo" },
  { id: "video-script", title: "Roteiro de Vídeo", type: "format", category: "Formatos", icon: "🎥", description: "Script para vídeo" },
];

interface UseGlobalMentionSearchProps {
  workspaceId?: string | null;
  clientId?: string | null;
}

interface UseGlobalMentionSearchResult {
  search: (query: string) => Promise<MentionItem[]>;
  suggestions: MentionItem[];
  isLoading: boolean;
  formats: MentionItem[];
}

export function useGlobalMentionSearch({
  workspaceId,
  clientId,
}: UseGlobalMentionSearchProps): UseGlobalMentionSearchResult {
  const [suggestions, setSuggestions] = useState<MentionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assignees, setAssignees] = useState<MentionItem[]>([]);
  const [contentItems, setContentItems] = useState<MentionItem[]>([]);
  const [referenceItems, setReferenceItems] = useState<MentionItem[]>([]);

  // Fetch assignees (workspace members)
  useEffect(() => {
    if (!workspaceId) return;

    const fetchAssignees = async () => {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId);

      if (members) {
        // Get profiles for these users
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .in("id", userIds);

        if (profiles) {
          const mentionItems: MentionItem[] = profiles.map(profile => ({
            id: profile.id,
            title: profile.full_name || profile.email || "Usuário",
            type: "assignee" as MentionType,
            category: "Responsáveis",
            icon: "👤",
            description: profile.email || undefined,
          }));
          setAssignees(mentionItems);
        }
      }
    };

    fetchAssignees();
  }, [workspaceId]);

  // Fetch content library items
  useEffect(() => {
    if (!clientId) return;

    const fetchContent = async () => {
      const { data: content } = await supabase
        .from("client_content_library")
        .select("id, title, content_type")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (content) {
        const mentionItems: MentionItem[] = content.map(item => ({
          id: item.id,
          title: item.title,
          type: "content" as MentionType,
          category: "Biblioteca de Conteúdo",
          icon: "📚",
          description: item.content_type,
        }));
        setContentItems(mentionItems);
      }
    };

    fetchContent();
  }, [clientId]);

  // Fetch reference library items
  useEffect(() => {
    if (!clientId) return;

    const fetchReferences = async () => {
      const { data: references } = await supabase
        .from("client_reference_library")
        .select("id, title, reference_type")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (references) {
        const mentionItems: MentionItem[] = references.map(item => ({
          id: item.id,
          title: item.title,
          type: "reference" as MentionType,
          category: "Referências",
          icon: "🔗",
          description: item.reference_type,
        }));
        setReferenceItems(mentionItems);
      }
    };

    fetchReferences();
  }, [clientId]);

  const search = useCallback(async (query: string): Promise<MentionItem[]> => {
    setIsLoading(true);
    const lowerQuery = query.toLowerCase();

    // Combine all mention sources
    const allItems = [
      ...FORMAT_MENTIONS,
      ...assignees,
      ...contentItems,
      ...referenceItems,
    ];

    // Filter by query
    const filtered = allItems.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery)
    );

    // Group by category and limit results
    const grouped: Record<string, MentionItem[]> = {};
    filtered.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      if (grouped[item.category].length < 5) {
        grouped[item.category].push(item);
      }
    });

    // Flatten and return
    const results = Object.values(grouped).flat();
    setSuggestions(results);
    setIsLoading(false);

    return results;
  }, [assignees, contentItems, referenceItems]);

  return {
    search,
    suggestions,
    isLoading,
    formats: FORMAT_MENTIONS,
  };
}

/**
 * Create a mention string for the chat input
 */
export function createMentionString(item: MentionItem): string {
  return `@[${item.title}](${item.type}:${item.id})`;
}

/**
 * Parse mentions from text
 */
export function parseMentionsFromText(text: string): Array<{
  type: MentionType;
  id: string;
  title: string;
  fullMatch: string;
}> {
  const regex = /@\[([^\]]+)\]\((format|assignee|content|reference):([a-f0-9-]+)\)/g;
  const mentions: Array<{
    type: MentionType;
    id: string;
    title: string;
    fullMatch: string;
  }> = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      title: match[1],
      type: match[2] as MentionType,
      id: match[3],
      fullMatch: match[0],
    });
  }

  return mentions;
}
