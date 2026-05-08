// =====================================================
// useClientContext — TanStack Query data hook
// =====================================================
// Reads ALL relevant rows for a given client_id and shapes them into the
// `ClientContext` payload consumed by the 3 viral apps:
//   - Sequência Viral (BriefingPanel pre-fill)
//   - Reels Viral (ClientContextSidebar)
//   - Radar Viral (NicheBar default)
//
// Mirrors the shape of `getClientContextServer` in
// `api/_lib/shared/client-context.ts` so client and server share semantics.
//
// IMPORTANT: This is the data hook. The mutation-style "generate identity guide
// via Gemini" hook is `useClientContextGenerator` (different file) — they have
// the same legacy name in the codebase, but very different responsibilities.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Database } from "@/integrations/supabase/types";

// ─── Types (mirror api/_lib/shared/client-context.ts) ───────────────────

export interface ClientRow {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  identity_guide: string | null;
  context_notes: string | null;
  voice_profile: Json | null;
  social_media: Json | null;
  tags: Json | null;
  workspace_id: string;
  user_id: string | null;
  avatar_url: string | null;
}

export type ClientPreferenceRow =
  Database["public"]["Tables"]["client_preferences"]["Row"];
export type ClientWebsiteRow =
  Database["public"]["Tables"]["client_websites"]["Row"];
export type ClientDocumentRow =
  Database["public"]["Tables"]["client_documents"]["Row"];
export type ClientVisualReferenceRow =
  Database["public"]["Tables"]["client_visual_references"]["Row"];
export type ClientContentLibraryRow =
  Database["public"]["Tables"]["client_content_library"]["Row"];
export type ClientReferenceLibraryRow =
  Database["public"]["Tables"]["client_reference_library"]["Row"];
export type ClientViralCompetitorRow =
  Database["public"]["Tables"]["client_viral_competitors"]["Row"];
export type ClientViralKeywordRow =
  Database["public"]["Tables"]["client_viral_keywords"]["Row"];

export interface ClientContext {
  client: ClientRow;
  tone: string | null;
  pillars: string[];
  persona: {
    age: string | null;
    pain: string | null;
    goal: string | null;
  };
  brand: {
    do: string[];
    dont: string[];
  };
  audience: string[];
  websites: ClientWebsiteRow[];
  documents: ClientDocumentRow[];
  visualReferences: ClientVisualReferenceRow[];
  contentLibrary: ClientContentLibraryRow[];
  referenceLibrary: ClientReferenceLibraryRow[];
  competitors: ClientViralCompetitorRow[];
  keywords: ClientViralKeywordRow[];
  preferences: ClientPreferenceRow[];
}

interface DecodeRaw {
  client: ClientRow | null;
  prefs: ClientPreferenceRow[];
  websites: ClientWebsiteRow[];
  documents: ClientDocumentRow[];
  visualReferences: ClientVisualReferenceRow[];
  contentLibrary: ClientContentLibraryRow[];
  referenceLibrary: ClientReferenceLibraryRow[];
  competitors: ClientViralCompetitorRow[];
  keywords: ClientViralKeywordRow[];
}

/**
 * Pure decoder — symmetrical with the server-side decoder. Translates raw
 * key/value rows from `client_preferences` into the typed `ClientContext`.
 */
export function decodeClientContext(raw: DecodeRaw): ClientContext | null {
  if (!raw.client) return null;

  const tone =
    raw.prefs.find((p) => p.preference_type === "tone")?.preference_value ??
    null;
  const pillars = raw.prefs
    .filter((p) => p.preference_type === "content_pillar")
    .map((p) => p.preference_value);
  const persona = {
    age:
      raw.prefs.find((p) => p.preference_type === "persona_age")
        ?.preference_value ?? null,
    pain:
      raw.prefs.find((p) => p.preference_type === "persona_pain")
        ?.preference_value ?? null,
    goal:
      raw.prefs.find((p) => p.preference_type === "persona_goal")
        ?.preference_value ?? null,
  };
  const brand = {
    do: raw.prefs
      .filter((p) => p.preference_type === "brand_do")
      .map((p) => p.preference_value),
    dont: raw.prefs
      .filter((p) => p.preference_type === "brand_dont")
      .map((p) => p.preference_value),
  };
  const audience = raw.prefs
    .filter((p) => p.preference_type === "target_audience")
    .map((p) => p.preference_value);

  return {
    client: raw.client,
    tone,
    pillars,
    persona,
    brand,
    audience,
    websites: raw.websites,
    documents: raw.documents,
    visualReferences: raw.visualReferences,
    contentLibrary: raw.contentLibrary,
    referenceLibrary: raw.referenceLibrary,
    competitors: raw.competitors,
    keywords: raw.keywords,
    preferences: raw.prefs,
  };
}

interface ClientPartialRow {
  id: string;
  name: string;
  description: string | null;
  identity_guide: string | null;
  context_notes: string | null;
  voice_profile: Json | null;
  social_media: Json | null;
  tags: Json | null;
  workspace_id: string;
  user_id: string | null;
  avatar_url: string | null;
}

function deriveIndustry(tags: Json | null): string | null {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return null;
  const t = tags as Record<string, unknown>;
  const segment = t.segment;
  const industry = t.industry;
  if (typeof segment === "string" && segment.trim()) return segment;
  if (typeof industry === "string" && industry.trim()) return industry;
  return null;
}

/**
 * Loads the full multi-tenant context for a single client. Use `clientId=null`
 * to disable the query (returns `{ data: undefined, isLoading: false }`).
 *
 * Fires 8 parallel `supabase.from(…)` reads against the Neon Data API. RLS
 * already restricts access to clients the caller's workspace_member can see.
 */
export function useClientContext(clientId: string | null) {
  return useQuery<ClientContext | null>({
    queryKey: ["client-context", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 min
    queryFn: async (): Promise<ClientContext | null> => {
      if (!clientId) return null;

      const [
        clientRes,
        prefsRes,
        websitesRes,
        docsRes,
        visualRefsRes,
        contentLibraryRes,
        referenceLibraryRes,
        competitorsRes,
        keywordsRes,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, name, description, identity_guide, context_notes, voice_profile, social_media, tags, workspace_id, user_id, avatar_url"
          )
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("client_preferences")
          .select("*")
          .eq("client_id", clientId)
          .order("confidence", { ascending: false, nullsFirst: false }),
        supabase
          .from("client_websites")
          .select("*")
          .eq("client_id", clientId)
          .limit(10),
        supabase
          .from("client_documents")
          .select("*")
          .eq("client_id", clientId)
          .limit(20),
        supabase
          .from("client_visual_references")
          .select("*")
          .eq("client_id", clientId)
          .limit(20),
        supabase
          .from("client_content_library")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("client_reference_library")
          .select("*")
          .eq("client_id", clientId)
          .limit(20),
        supabase
          .from("client_viral_competitors")
          .select("*")
          .eq("client_id", clientId),
        supabase
          .from("client_viral_keywords")
          .select("*")
          .eq("client_id", clientId),
      ]);

      const partial = clientRes.data as ClientPartialRow | null;
      const client: ClientRow | null = partial
        ? {
            id: partial.id,
            name: partial.name,
            description: partial.description,
            industry: deriveIndustry(partial.tags),
            identity_guide: partial.identity_guide,
            context_notes: partial.context_notes,
            voice_profile: partial.voice_profile,
            social_media: partial.social_media,
            tags: partial.tags,
            workspace_id: partial.workspace_id,
            user_id: partial.user_id,
            avatar_url: partial.avatar_url,
          }
        : null;

      return decodeClientContext({
        client,
        prefs: (prefsRes.data ?? []) as ClientPreferenceRow[],
        websites: (websitesRes.data ?? []) as ClientWebsiteRow[],
        documents: (docsRes.data ?? []) as ClientDocumentRow[],
        visualReferences: (visualRefsRes.data ?? []) as ClientVisualReferenceRow[],
        contentLibrary: (contentLibraryRes.data ?? []) as ClientContentLibraryRow[],
        referenceLibrary: (referenceLibraryRes.data ?? []) as ClientReferenceLibraryRow[],
        competitors: (competitorsRes.data ?? []) as ClientViralCompetitorRow[],
        keywords: (keywordsRes.data ?? []) as ClientViralKeywordRow[],
      });
    },
  });
}
